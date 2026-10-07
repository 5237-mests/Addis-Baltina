import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2, Clock, Package, Truck, Home, AlertCircle, Radio } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Order, OrderStatus } from '../types';

const ORDER_STEPS: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const OrderTrackingModal: React.FC = () => {
  const {
    activeOrderForTracking,
    setActiveOrderForTracking,
    trackedOrderIds,
    t,
  } = useApp();

  const [searchId, setSearchId] = useState('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial order or search
  useEffect(() => {
    if (activeOrderForTracking && activeOrderForTracking.id) {
      setCurrentOrder(activeOrderForTracking);
      setSearchId(activeOrderForTracking.id);
    } else if (trackedOrderIds.length > 0) {
      fetchOrder(trackedOrderIds[0]);
    }
  }, [activeOrderForTracking, trackedOrderIds]);

  // Listen to live SSE updates for the order
  useEffect(() => {
    if (!currentOrder) return;

    const eventSource = new EventSource('/api/v1/events');
    eventSource.addEventListener('order:status_changed', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.orderId === currentOrder.id) {
          setCurrentOrder(payload.order);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    return () => eventSource.close();
  }, [currentOrder?.id]);

  const fetchOrder = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/orders/${id.trim()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || t('order.notFound'));
      }
      setCurrentOrder(data.data);
      setSearchId(data.data.id);
    } catch (err: any) {
      setError(err.message || t('order.notFound'));
      setCurrentOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchId);
  };

  if (!activeOrderForTracking) return null;

  const currentStepIndex = currentOrder
    ? currentOrder.status === 'CANCELLED'
      ? -1
      : ORDER_STEPS.indexOf(currentOrder.status)
    : 0;

  const getStepIcon = (step: OrderStatus, index: number) => {
    const isCompleted = index <= currentStepIndex;
    const isCurrent = index === currentStepIndex;

    switch (step) {
      case 'PENDING':
        return <Clock className={`w-4 h-4 ${isCurrent ? 'animate-pulse' : ''}`} />;
      case 'CONFIRMED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'PROCESSING':
        return <Package className="w-4 h-4" />;
      case 'READY_FOR_DELIVERY':
        return <Package className="w-4 h-4" />;
      case 'OUT_FOR_DELIVERY':
        return <Truck className={`w-4 h-4 ${isCurrent ? 'animate-bounce' : ''}`} />;
      case 'DELIVERED':
        return <Home className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
                {t('order.trackingTitle')}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>{t('order.liveUpdates')}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveOrderForTracking(null)}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Search input & Recent pills */}
          <div>
            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder={t('order.searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition"
              >
                {t('order.trackBtn')}
              </button>
            </form>

            {trackedOrderIds.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-stone-500">
                <span className="text-[11px] font-semibold">Recent:</span>
                {trackedOrderIds.slice(0, 4).map((id) => (
                  <button
                    key={id}
                    onClick={() => fetchOrder(id)}
                    className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-stone-100 dark:bg-stone-800 hover:bg-amber-500/20 text-stone-700 dark:text-stone-300 transition"
                  >
                    #{id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {currentOrder && (
            <div className="space-y-6">
              {/* Order Status Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-bold text-stone-900 dark:text-stone-100">
                      #{currentOrder.id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400">
                      {t(`status.${currentOrder.status}`)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Placed on {new Date(currentOrder.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-stone-500 uppercase font-bold">Total Amount</div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-400">
                    {currentOrder.total} ETB
                  </div>
                </div>
              </div>

              {/* Status Stepper */}
              {currentOrder.status === 'CANCELLED' ? (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center">
                  <span className="font-bold text-red-600 dark:text-red-400 text-sm">
                    {t('status.CANCELLED')}
                  </span>
                  <p className="text-xs text-stone-500 mt-1">
                    This order was cancelled and inventory has been replenished.
                  </p>
                </div>
              ) : (
                <div className="relative py-4">
                  {/* Progress Line */}
                  <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-stone-200 dark:bg-stone-800 sm:left-4 sm:right-4 sm:top-5 sm:bottom-auto sm:w-auto sm:h-1 sm:bg-stone-200 dark:sm:bg-stone-800 -z-0" />

                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 relative z-10">
                    {ORDER_STEPS.map((step, idx) => {
                      const isCompleted = idx <= currentStepIndex;
                      const isCurrent = idx === currentStepIndex;

                      return (
                        <div
                          key={step}
                          className="flex sm:flex-col items-center gap-3 sm:gap-2 text-left sm:text-center"
                        >
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition ${
                              isCurrent
                                ? 'bg-amber-600 border-amber-400 text-stone-950 shadow-md shadow-amber-500/30'
                                : isCompleted
                                ? 'bg-emerald-600 border-emerald-400 text-white'
                                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-400'
                            }`}
                          >
                            {getStepIcon(step, idx)}
                          </div>
                          <div>
                            <div
                              className={`text-xs font-bold ${
                                isCurrent
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : isCompleted
                                  ? 'text-stone-900 dark:text-stone-100'
                                  : 'text-stone-400'
                              }`}
                            >
                              {t(`status.${step}`)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery & Items Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Delivery Information */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60 text-xs space-y-2">
                  <div className="font-bold text-stone-900 dark:text-stone-100 mb-1">
                    {t('order.deliveryAddress')}
                  </div>
                  <div>
                    <span className="text-stone-500">Customer: </span>
                    <span className="font-semibold">{currentOrder.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Phone: </span>
                    <span className="font-semibold">{currentOrder.customer_phone}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Location: </span>
                    <span className="font-semibold">
                      {currentOrder.delivery_subcity}
                      {currentOrder.delivery_woreda ? `, Woreda ${currentOrder.delivery_woreda}` : ''}
                    </span>
                  </div>
                  {currentOrder.delivery_landmark && (
                    <div>
                      <span className="text-stone-500">Landmark: </span>
                      <span>{currentOrder.delivery_landmark}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-stone-500">Payment: </span>
                    <span className="font-semibold uppercase">{currentOrder.payment_method.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {/* Items breakdown */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60 text-xs space-y-2">
                  <div className="font-bold text-stone-900 dark:text-stone-100 mb-1">
                    {t('order.items')} ({currentOrder.items.length})
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {currentOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-1 border-b border-stone-200/50 dark:border-stone-700/50">
                        <span className="truncate pr-2">
                          {item.quantity}x {item.product_name}
                        </span>
                        <span className="font-mono font-semibold shrink-0">
                          {item.subtotal} ETB
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-between font-black text-sm text-stone-900 dark:text-stone-100">
                    <span>{t('cart.total')}</span>
                    <span className="text-amber-700 dark:text-amber-400">
                      {currentOrder.total} ETB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
