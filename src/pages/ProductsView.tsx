import React, { useState } from 'react';
import { Product, UserRole } from '../types';
import {
  Plus,
  Search,
  AlertTriangle,
  ArrowDownToLine,
  Edit2,
  Trash2,
  Package,
  MapPin,
  X,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';
import { api } from '../services/api';

interface ProductsViewProps {
  products: Product[];
  userRole?: UserRole;
  onRefresh: () => void;
}

export default function ProductsView({ products, userRole, onRefresh }: ProductsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockInwardModalOpen, setIsStockInwardModalOpen] = useState(false);
  const [selectedProductForInward, setSelectedProductForInward] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: 'Automation',
    price: 1000,
    min_stock: 10,
    current_stock: 20,
    location: 'Bay A-01',
  });

  const [inwardForm, setInwardForm] = useState({
    changeQty: 10,
    reason: 'Vendor Replenishment Supply',
  });

  const categories = [
    'All',
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesLowStock = !lowStockOnly || p.current_stock <= p.min_stock;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      category: 'Automation',
      price: 1500,
      min_stock: 10,
      current_stock: 25,
      location: 'Bay A-01, Shelf 1',
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: p.price,
      min_stock: p.min_stock,
      current_stock: p.current_stock,
      location: p.location,
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleOpenInward = (p: Product) => {
    setSelectedProductForInward(p);
    setInwardForm({
      changeQty: Math.max(10, p.min_stock * 2 - p.current_stock),
      reason: `Warehouse Stock Restock Batch #${new Date().getFullYear()}`,
    });
    setFormError(null);
    setIsStockInwardModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!productForm.name.trim()) {
      setFormError('Product title is required');
      return;
    }
    if (!productForm.sku.trim()) {
      setFormError('Product SKU identifier is required');
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productForm);
      } else {
        await api.createProduct(productForm);
      }
      onRefresh();
      setIsProductModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForInward) return;
    setFormError(null);

    if (inwardForm.changeQty <= 0) {
      setFormError('Inward quantity must be greater than zero');
      return;
    }

    setLoading(true);
    try {
      await api.addStockMovement({
        productId: selectedProductForInward.id,
        changeQty: inwardForm.changeQty,
        type: 'IN',
        reason: inwardForm.reason,
      });
      onRefresh();
      setIsStockInwardModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record stock inward');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (userRole !== 'Admin') {
      alert('Only Admin role is permitted to remove inventory products.');
      return;
    }
    if (!confirm(`Are you sure you want to delete product '${name}'?`)) return;

    try {
      await api.deleteProduct(id);
      onRefresh();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="neu-flat p-6 rounded-3xl border border-white/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Product Catalog & Warehouse Inventory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKU specifications, bin locations, minimum safety thresholds, and stock movements.
          </p>
        </div>

        {(userRole === 'Admin' || userRole === 'Warehouse') && (
          <button
            id="btn-add-product"
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product SKU</span>
          </button>
        )}
      </div>

      {/* Filters and search */}
      <div className="neu-flat p-4 rounded-2xl border border-white/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="neu-input px-3 py-1.5 rounded-xl text-xs text-slate-700 bg-[#edf2f8] font-medium"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                Category: {cat}
              </option>
            ))}
          </select>

          <button
            id="toggle-low-stock"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              lowStockOnly
                ? 'neu-pressed bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                : 'neu-button text-slate-600'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            <span>Low Stock Alerts</span>
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-product-search"
            type="text"
            placeholder="Search SKU, item name, rack location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full neu-input pl-9 pr-3.5 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="neu-flat p-6 rounded-3xl border border-white/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="pb-3 pl-2">SKU & Item Name</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-right">Unit Price</th>
                <th className="pb-3 text-center">Stock Level</th>
                <th className="pb-3">Location</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isCritical = p.current_stock <= p.min_stock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-200/30 transition-colors">
                      <td className="py-3.5 pl-2">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{p.name}</span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-slate-500 pl-5">
                          {p.sku}
                        </span>
                      </td>

                      <td className="py-3.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 font-medium">
                          {p.category}
                        </span>
                      </td>

                      <td className="py-3.5 text-right font-bold text-slate-800 font-mono">
                        ₹{p.price.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {p.current_stock} Units
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Min Safety: {p.min_stock}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.location}</span>
                        </div>
                      </td>

                      <td className="py-3.5 pr-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(userRole === 'Admin' || userRole === 'Warehouse') && (
                            <>
                              <button
                                id={`btn-inward-${p.sku.toLowerCase()}`}
                                onClick={() => handleOpenInward(p)}
                                title="Record Inward Stock Restock"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg neu-button text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
                              >
                                <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
                                <span>Inward</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditProduct(p)}
                                title="Edit Product"
                                className="p-1.5 rounded-lg neu-button text-slate-600 hover:text-indigo-600"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {userRole === 'Admin' && (
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              title="Delete Product (Admin only)"
                              className="p-1.5 rounded-lg neu-button text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-5">
              <h3 className="font-bold text-base text-slate-800">
                {editingProduct ? 'Edit Product Item' : 'Add New Inventory SKU'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Industrial Servo Drive 750W"
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                    placeholder="DRV-750-AC"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800 font-mono disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    placeholder="Automation / Sensors"
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Safety Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={productForm.min_stock}
                    onChange={(e) => setProductForm({ ...productForm, min_stock: Number(e.target.value) })}
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Physical Stock (Warehouse Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.current_stock}
                    onChange={(e) => setProductForm({ ...productForm, current_stock: Number(e.target.value) })}
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Warehouse Location / Bin
                </label>
                <input
                  type="text"
                  value={productForm.location}
                  onChange={(e) => setProductForm({ ...productForm, location: e.target.value })}
                  placeholder="Bay B-12, Shelf 3"
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-300/80">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl neu-button text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
                >
                  {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Inward Adjustment Modal */}
      {isStockInwardModalOpen && selectedProductForInward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md neu-flat bg-[#e6ecf4] rounded-3xl p-6 border border-white/80 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-800">Warehouse Stock Inward</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedProductForInward.sku}</p>
              </div>
              <button
                onClick={() => setIsStockInwardModalOpen(false)}
                className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs">
              <p className="font-semibold text-indigo-900">{selectedProductForInward.name}</p>
              <p className="text-indigo-700 mt-0.5">
                Current Stock: <strong>{selectedProductForInward.current_stock}</strong> | Min Threshold: <strong>{selectedProductForInward.min_stock}</strong>
              </p>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleInwardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Received Quantity (+Units) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={inwardForm.changeQty}
                  onChange={(e) => setInwardForm({ ...inwardForm, changeQty: Number(e.target.value) })}
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batch Reason / Purchase Order Reference
                </label>
                <input
                  type="text"
                  required
                  value={inwardForm.reason}
                  onChange={(e) => setInwardForm({ ...inwardForm, reason: e.target.value })}
                  placeholder="e.g. Replenishment PO-9921 from OEM"
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-300/80">
                <button
                  type="button"
                  onClick={() => setIsStockInwardModalOpen(false)}
                  className="px-4 py-2 rounded-xl neu-button text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{loading ? 'Recording...' : 'Confirm Stock Inward'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
