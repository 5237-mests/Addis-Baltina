import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  TrendingUp,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sliders,
  FileText,
  Search,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Order, OrderStatus, Product, AuditLog } from '../types';

export const AdminDashboard: React.FC = () => {
  const { isAdminOpen, setIsAdminOpen, t } = useApp();

  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'audit'>('orders');
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');

  // Stock adjustment modal state
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<'RESTOCK' | 'DAMAGE' | 'AUDIT_ADJUSTMENT'>('RESTOCK');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes, invRes, auditRes] = await Promise.all([
        fetch('/api/v1/admin/stats').then((r) => r.json()),
        fetch('/api/v1/orders').then((r) => r.json()),
        fetch('/api/v1/inventory').then((r) => r.json()),
        fetch('/api/v1/admin/audit-logs').then((r) => r.json()),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (ordersRes.success) setOrders(ordersRes.data);
      if (invRes.success) setProducts(invRes.data.products);
      if (auditRes.success) setAuditLogs(auditRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminOpen) {
      loadData();
    }
  }, [isAdminOpen]);

  // Handle Order status update
  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Handle Stock adjustment
  const handleSaveStockAdjustment = async () => {
    if (!adjustingProduct) return;
    try {
      const res = await fetch('/api/v1/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustingProduct.id,
          newStock: newStockValue,
          reason: adjustReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAdjustingProduct(null);
        loadData();
      }
    } catch (err) {
      console.error('Error adjusting stock:', err);
    }
  };

  if (!isAdminOpen) return null;

  const filteredOrders = orders.filter((o) => {
    if (orderFilter !== 'ALL' && o.status !== orderFilter) return false;
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-4 flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>{t('admin.title')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  Operational
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                Authoritative Inventory Control & Order Lifecycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsAdminOpen(false)}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/40">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/60 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1">
              <span>{t('admin.totalRevenue')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-stone-900 dark:text-stone-100">
              {stats?.totalRevenue || 0}{' '}
              <span className="text-xs font-normal text-stone-500">ETB</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/60 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1">
              <span>{t('admin.totalOrders')}</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-stone-900 dark:text-stone-100">
              {stats?.totalOrders || 0}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/60 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1">
              <span>{t('admin.activeOrders')}</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-black text-stone-900 dark:text-stone-100">
              {stats?.activeOrders || 0}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700/60 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-1">
              <span>{t('admin.lowStockAlerts')}</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400">
              {stats?.lowStockCount || 0}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-stone-200 dark:border-stone-800 flex gap-4 bg-white dark:bg-stone-900">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t('admin.ordersTab')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px]">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{t('admin.inventoryTab')}</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('admin.auditTab')}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search order ID, customer name, phone..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => setOrderFilter(st)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                          orderFilter === st
                            ? 'bg-amber-600 text-stone-950'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Orders Table */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-500 font-semibold border-b border-stone-200 dark:border-stone-800">
                      <tr>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Customer & Location</th>
                        <th className="p-3">Items</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-stone-500">
                            No orders found matching filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                            <td className="p-3 font-mono font-bold">
                              <div>#{ord.id}</div>
                              <span className="text-[10px] text-stone-400 font-normal">
                                {ord.source}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-stone-900 dark:text-stone-100">
                                {ord.customer_name}
                              </div>
                              <div className="text-stone-500 text-[11px]">{ord.customer_phone}</div>
                              <div className="text-stone-400 text-[10px]">
                                {ord.delivery_subcity}
                                {ord.delivery_woreda ? `, Woreda ${ord.delivery_woreda}` : ''}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="max-w-[200px] truncate text-stone-600 dark:text-stone-300">
                                {ord.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                              </div>
                            </td>
                            <td className="p-3 font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                              {ord.total} ETB
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap ${
                                  ord.status === 'DELIVERED'
                                    ? 'bg-emerald-500/20 text-emerald-600'
                                    : ord.status === 'CANCELLED'
                                    ? 'bg-rose-500/20 text-rose-600'
                                    : 'bg-amber-500/20 text-amber-600'
                                }`}
                              >
                                {ord.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <select
                                value={ord.status}
                                onChange={(e) =>
                                  handleUpdateStatus(ord.id, e.target.value as OrderStatus)
                                }
                                className="px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-[11px] font-semibold"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="CONFIRMED">CONFIRMED</option>
                                <option value="PROCESSING">PROCESSING</option>
                                <option value="READY_FOR_DELIVERY">READY FOR DELIVERY</option>
                                <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                                <option value="DELIVERED">DELIVERED</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Authoritative Stock Levels & Product Inventory
                </h3>
              </div>

              <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-500 font-semibold border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">SKU & Unit</th>
                      <th className="p-3">Current Stock</th>
                      <th className="p-3">Min Alert</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {products.map((prod) => {
                      const isLow = prod.stock <= prod.min_stock_alert;
                      return (
                        <tr key={prod.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                          <td className="p-3">
                            <div className="font-bold text-stone-900 dark:text-stone-100">
                              {prod.name_en}
                            </div>
                            <div className="text-[11px] text-stone-400">{prod.origin}</div>
                          </td>
                          <td className="p-3 font-mono">
                            {prod.sku} ({prod.unit})
                          </td>
                          <td className="p-3 font-bold text-base">
                            {prod.stock}
                          </td>
                          <td className="p-3 text-stone-500">{prod.min_stock_alert}</td>
                          <td className="p-3">
                            {prod.stock <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 font-bold text-[10px]">
                                OUT OF STOCK
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-bold text-[10px]">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 font-bold text-[10px]">
                                HEALTHY
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setAdjustingProduct(prod);
                                setNewStockValue(prod.stock);
                              }}
                              className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition"
                            >
                              {t('admin.adjustStock')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                System Audit Trail & Concurrency Logs
              </h3>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {log.action}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                          {log.performed_by}
                        </span>
                      </div>
                      <p className="text-stone-500 text-[11px]">
                        Target: {log.entity_type} #{log.entity_id} · {JSON.stringify(log.details)}
                      </p>
                    </div>
                    <span className="text-stone-400 text-[10px] shrink-0">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stock Adjustment Modal */}
        {adjustingProduct && (
          <div className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 max-w-sm w-full shadow-2xl space-y-4">
              <h3 className="font-black text-base text-stone-900 dark:text-stone-100">
                Adjust Inventory: {adjustingProduct.name_en}
              </h3>
              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                  New Stock Count (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newStockValue}
                  onChange={(e) => setNewStockValue(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-bold bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                  Reason for Adjustment
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                >
                  <option value="RESTOCK">Restock (New Batch Inflow)</option>
                  <option value="DAMAGE">Damage / Expiry Write-Off</option>
                  <option value="AUDIT_ADJUSTMENT">Physical Inventory Audit Adjustment</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStockAdjustment}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-black shadow-md transition"
                >
                  Save Stock
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
