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
  Upload,
  Cloud,
  Image as ImageIcon,
  Plus,
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

  // Cloudinary connection info
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{
    configured: boolean;
    cloud_name: string | null;
  } | null>(null);

  // Stock adjustment modal state
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<'RESTOCK' | 'DAMAGE' | 'AUDIT_ADJUSTMENT'>('RESTOCK');

  // Cloudinary Image upload modal state
  const [editingPhotoProduct, setEditingPhotoProduct] = useState<Product | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResultInfo, setUploadResultInfo] = useState<{
    provider: string;
    url: string;
    bytes?: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // New Product Modal state
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProdForm, setNewProdForm] = useState({
    category_id: 'cat-spices',
    sku: `AB-NEW-${Math.floor(100 + Math.random() * 900)}`,
    name_en: '',
    name_am: '',
    name_om: '',
    description_en: '',
    price: 380,
    stock: 20,
    unit: '500g',
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
    origin: 'Addis Ababa, Ethiopia',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes, invRes, auditRes, cloudRes] = await Promise.all([
        fetch('/api/v1/admin/stats').then((r) => r.json()),
        fetch('/api/v1/orders').then((r) => r.json()),
        fetch('/api/v1/inventory').then((r) => r.json()),
        fetch('/api/v1/admin/audit-logs').then((r) => r.json()),
        fetch('/api/v1/upload/status').then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (ordersRes.success) setOrders(ordersRes.data);
      if (invRes.success) setProducts(invRes.data.products);
      if (auditRes.success) setAuditLogs(auditRes.data);
      if (cloudRes?.success) setCloudinaryStatus(cloudRes.data);
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

  // Handle file select for Cloudinary
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadResultInfo(null);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Cloudinary upload & update product
  const handleUploadToCloudinary = async () => {
    if (!uploadPreview || !editingPhotoProduct) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: uploadPreview,
          folder: 'addis_baltina/products',
          tags: ['addis_baltina', editingPhotoProduct.sku],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to upload image to Cloudinary');
      }

      const uploadedUrl = data.data.url;
      setUploadResultInfo({
        provider: data.data.provider,
        url: uploadedUrl,
        bytes: data.data.bytes,
      });

      // Update the product's image_url
      await fetch(`/api/v1/products/${editingPhotoProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: uploadedUrl }),
      });

      loadData();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle creating a new product
  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProdForm,
          name_am: newProdForm.name_am || newProdForm.name_en,
          name_om: newProdForm.name_om || newProdForm.name_en,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreatingProduct(false);
        loadData();
      } else {
        alert(data.error?.message || 'Failed to create product');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating product');
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
            {/* Cloudinary Status Indicator */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/80 shadow-xs"
              title={
                cloudinaryStatus?.configured
                  ? `Cloudinary CDN active for cloud: ${cloudinaryStatus.cloud_name}`
                  : 'Cloudinary credentials not set in .env. Local storage fallback active.'
              }
            >
              <Cloud className={`w-3.5 h-3.5 ${cloudinaryStatus?.configured ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              {cloudinaryStatus?.configured ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Cloudinary: {cloudinaryStatus.cloud_name}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Cloudinary: Demo Mode
                </span>
              )}
            </div>

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
                <div>
                  <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    Authoritative Stock Levels & Product Inventory
                  </h3>
                  <p className="text-xs text-stone-500">
                    Manage product photos via Cloudinary image storage and adjust live inventory
                  </p>
                </div>
                <button
                  onClick={() => {
                    setNewProdForm({
                      category_id: 'cat-spices',
                      sku: `AB-SP-0${products.length + 1}`,
                      name_en: '',
                      name_am: '',
                      name_om: '',
                      description_en: '',
                      price: 400,
                      stock: 25,
                      unit: '500g',
                      image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
                      origin: 'Addis Ababa, Ethiopia',
                    });
                    setUploadPreview(null);
                    setUploadResultInfo(null);
                    setIsCreatingProduct(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('admin.addProduct')}</span>
                </button>
              </div>

              <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-500 font-semibold border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="p-3">Product & Photo</th>
                      <th className="p-3">SKU & Unit</th>
                      <th className="p-3">Current Stock</th>
                      <th className="p-3">Min Alert</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {products.map((prod) => {
                      const isLow = prod.stock <= prod.min_stock_alert;
                      return (
                        <tr key={prod.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={prod.image_url}
                                alt={prod.name_en}
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-stone-200 dark:border-stone-800"
                              />
                              <div>
                                <div className="font-bold text-stone-900 dark:text-stone-100">
                                  {prod.name_en}
                                </div>
                                <div className="text-[11px] text-stone-400">{prod.origin}</div>
                              </div>
                            </div>
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
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingPhotoProduct(prod);
                                  setUploadPreview(prod.image_url);
                                  setUploadResultInfo(null);
                                  setUploadError(null);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs transition"
                                title="Upload or change image via Cloudinary"
                              >
                                <Cloud className="w-3.5 h-3.5 text-amber-500" />
                                <span>Photo</span>
                              </button>

                              <button
                                onClick={() => {
                                  setAdjustingProduct(prod);
                                  setNewStockValue(prod.stock);
                                }}
                                className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition"
                              >
                                {t('admin.adjustStock')}
                              </button>
                            </div>
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

        {/* Cloudinary Photo Edit Modal */}
        {editingPhotoProduct && (
          <div className="fixed inset-0 z-60 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-stone-900 dark:text-stone-100">
                      Cloudinary Image Storage
                    </h3>
                    <p className="text-xs text-stone-500">
                      {editingPhotoProduct.name_en} ({editingPhotoProduct.sku})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingPhotoProduct(null);
                    setUploadPreview(null);
                    setUploadResultInfo(null);
                    setUploadError(null);
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cloudinary Connection Note */}
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                cloudinaryStatus?.configured
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
              }`}>
                <Cloud className="w-4 h-4 shrink-0" />
                <span>
                  {cloudinaryStatus?.configured
                    ? `Connected to Cloudinary account (${cloudinaryStatus.cloud_name}). Images will be saved to Cloudinary CDN.`
                    : 'Cloudinary credentials not set in .env. Images will be saved in demo mode. Configure CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME to enable Cloudinary CDN.'}
                </span>
              </div>

              {/* Image Preview & Upload Dropzone */}
              <div className="space-y-3">
                <div className="relative aspect-16/9 rounded-2xl bg-stone-100 dark:bg-stone-800 border-2 border-dashed border-stone-300 dark:border-stone-700 overflow-hidden flex flex-col items-center justify-center p-3 text-center">
                  {uploadPreview ? (
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="text-stone-500 space-y-1">
                      <ImageIcon className="w-8 h-8 mx-auto text-stone-400" />
                      <p className="text-xs font-semibold">{t('admin.dropImage')}</p>
                    </div>
                  )}
                </div>

                {/* File picker & URL input */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700 transition">
                      <Upload className="w-4 h-4 text-amber-500" />
                      <span>Choose Image File (JPG, PNG, WebP)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-400">or URL:</span>
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={uploadPreview?.startsWith('http') ? uploadPreview : ''}
                      onChange={(e) => setUploadPreview(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                {uploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                    {uploadError}
                  </div>
                )}

                {uploadResultInfo && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Uploaded Successfully to {uploadResultInfo.provider === 'cloudinary' ? 'Cloudinary CDN' : 'Local Storage'}!</span>
                    </div>
                    <div className="text-[11px] font-mono truncate text-stone-600 dark:text-stone-400">
                      URL: {uploadResultInfo.url}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setEditingPhotoProduct(null);
                    setUploadPreview(null);
                    setUploadResultInfo(null);
                    setUploadError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Close
                </button>
                <button
                  onClick={handleUploadToCloudinary}
                  disabled={isUploading || !uploadPreview}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 text-xs font-black shadow-md transition flex items-center justify-center gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{isUploading ? t('admin.uploading') : 'Upload to Cloudinary & Save'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add New Product Modal */}
        {isCreatingProduct && (
          <div className="fixed inset-0 z-60 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <h3 className="font-black text-base text-stone-900 dark:text-stone-100">
                  {t('admin.addProduct')}
                </h3>
                <button
                  onClick={() => setIsCreatingProduct(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewProduct} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                    Category
                  </label>
                  <select
                    value={newProdForm.category_id}
                    onChange={(e) => setNewProdForm({ ...newProdForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  >
                    <option value="cat-spices">Spices & Blends (ቅመማ ቅመሞች)</option>
                    <option value="cat-flours">Flours & Grains (እህሎችና ዱቄት)</option>
                    <option value="cat-pastes">Pastes & Sauces (አዋዜና ማጣፈጫ)</option>
                    <option value="cat-snacks">Traditional Snacks (የባህል መክሰሶች)</option>
                    <option value="cat-coffee">Coffee & Baltina Drinks (ቡናና መጠጦች)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                      SKU
                    </label>
                    <input
                      type="text"
                      required
                      value={newProdForm.sku}
                      onChange={(e) => setNewProdForm({ ...newProdForm, sku: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                      Unit Size
                    </label>
                    <input
                      type="text"
                      required
                      value={newProdForm.unit}
                      onChange={(e) => setNewProdForm({ ...newProdForm, unit: e.target.value })}
                      placeholder="e.g. 500g, 1kg"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                    Product Name (English)
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdForm.name_en}
                    onChange={(e) => setNewProdForm({ ...newProdForm, name_en: e.target.value })}
                    placeholder="e.g. Gurage Special Mitmita"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                      ስም (አማርኛ)
                    </label>
                    <input
                      type="text"
                      value={newProdForm.name_am}
                      onChange={(e) => setNewProdForm({ ...newProdForm, name_am: e.target.value })}
                      placeholder="የጉራጌ ልዩ ሚጥሚጣ"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                      Maqaa (Afaan Oromoo)
                    </label>
                    <input
                      type="text"
                      value={newProdForm.name_om}
                      onChange={(e) => setNewProdForm({ ...newProdForm, name_om: e.target.value })}
                      placeholder="Mitmiitaa Aadaa Addaa"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                      Price (ETB)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newProdForm.price}
                      onChange={(e) => setNewProdForm({ ...newProdForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                      Initial Stock (Units)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newProdForm.stock}
                      onChange={(e) => setNewProdForm({ ...newProdForm, stock: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-600 dark:text-stone-400 mb-1">
                    Image Storage (Cloudinary URL or Upload)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newProdForm.image_url}
                      onChange={(e) => setNewProdForm({ ...newProdForm, image_url: e.target.value })}
                      placeholder="https://res.cloudinary.com/..."
                      className="flex-1 px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    />
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64 = reader.result as string;
                            try {
                              const uploadRes = await fetch('/api/v1/upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  image: base64,
                                  folder: 'addis_baltina/products',
                                }),
                              });
                              const data = await uploadRes.json();
                              if (data.success) {
                                setNewProdForm((prev) => ({ ...prev, image_url: data.data.url }));
                              }
                            } catch (err) {
                              console.error('Image upload failed:', err);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {newProdForm.image_url && (
                    <img
                      src={newProdForm.image_url}
                      alt="Preview"
                      className="mt-2 w-full h-24 object-cover rounded-xl border border-stone-200 dark:border-stone-800"
                    />
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-black shadow-md transition"
                  >
                    Create Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
