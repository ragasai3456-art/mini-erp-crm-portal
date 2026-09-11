import React, { useState } from 'react';
import { InventoryMovement, Product, UserRole } from '../types';
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';

interface InventoryLogViewProps {
  movements: InventoryMovement[];
  products: Product[];
  userRole?: UserRole;
  onRefresh: () => void;
}

export default function InventoryLogView({
  movements,
  products,
  userRole,
  onRefresh,
}: InventoryLogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    productId: products[0]?.id || '',
    type: 'IN' as 'IN' | 'OUT',
    changeQty: 5,
    reason: 'Routine Warehouse Intake',
  });

  const filteredMovements = movements.filter((m) => {
    const matchesSearch =
      m.product_name.toLowerCase().includes(search.toLowerCase()) ||
      m.product_sku.toLowerCase().includes(search.toLowerCase()) ||
      m.reason.toLowerCase().includes(search.toLowerCase()) ||
      m.created_by.toLowerCase().includes(search.toLowerCase());

    const matchesType = selectedType === 'All' || m.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const prod = products.find((p) => p.id === form.productId);
    if (!prod) {
      setFormError('Please select a valid product.');
      return;
    }

    if (form.changeQty <= 0) {
      setFormError('Adjustment quantity must be greater than zero.');
      return;
    }

    if (form.type === 'OUT' && prod.current_stock < form.changeQty) {
      setFormError(
        `Cannot remove ${form.changeQty} units. Only ${prod.current_stock} currently available in stock.`
      );
      return;
    }

    setLoading(true);
    try {
      await api.addStockMovement({
        productId: form.productId,
        changeQty: form.changeQty,
        type: form.type,
        reason: form.reason,
      });
      onRefresh();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record movement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="neu-flat p-6 rounded-3xl border border-white/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Stock Movement & Inventory Audit Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all inward receipts, challan dispatches, and warehouse corrections.
          </p>
        </div>

        {(userRole === 'Admin' || userRole === 'Warehouse') && (
          <button
            id="btn-record-stock-movement"
            onClick={() => {
              setForm({
                productId: products[0]?.id || '',
                type: 'IN',
                changeQty: 10,
                reason: 'Physical Stock Count Reconciliation',
              });
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Stock Adjustment</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="neu-flat p-4 rounded-2xl border border-white/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {['All', 'IN', 'OUT'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedType === t
                  ? 'neu-pressed text-indigo-700 bg-[#e0e7f2] font-bold'
                  : 'neu-button text-slate-600'
              }`}
            >
              {t === 'All' ? 'All Movements' : t === 'IN' ? 'Inward (+IN)' : 'Outward (-OUT)'}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search product, SKU, operator, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full neu-input pl-9 pr-3.5 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="neu-flat p-6 rounded-3xl border border-white/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="pb-3 pl-2">Type & Qty</th>
                <th className="pb-3">Product Name & SKU</th>
                <th className="pb-3">Reason / Context</th>
                <th className="pb-3">Authorized Operator</th>
                <th className="pb-3 pr-2 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                    No stock movements found matching filter.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-200/30 transition-colors">
                    <td className="py-3.5 pl-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          m.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {m.type === 'IN' ? (
                          <>
                            <ArrowDownToLine className="w-3.5 h-3.5" /> +{m.change_qty}
                          </>
                        ) : (
                          <>
                            <ArrowUpFromLine className="w-3.5 h-3.5" /> -{m.change_qty}
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5">
                      <div className="font-bold text-slate-900">{m.product_name}</div>
                      <span className="font-mono text-[11px] text-slate-500">{m.product_sku}</span>
                    </td>

                    <td className="py-3.5 text-slate-700 font-medium">{m.reason}</td>

                    <td className="py-3.5 text-slate-600">
                      <span className="font-semibold text-slate-800">{m.created_by}</span>
                    </td>

                    <td className="py-3.5 pr-2 text-right font-mono text-slate-500 text-[11px]">
                      {new Date(m.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-5">
              <h3 className="font-bold text-base text-slate-800">Manual Stock Adjustment</h3>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product *
                </label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800 bg-[#edf2f8]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.sku}] (Current: {p.current_stock} Units)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Movement Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'IN' | 'OUT' })}
                    className="w-full neu-input px-3 py-2 rounded-xl text-xs text-slate-800 bg-[#edf2f8] font-bold"
                  >
                    <option value="IN">+ IN (Restock / Return)</option>
                    <option value="OUT">- OUT (Damage / Scrap / Correction)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.changeQty}
                    onChange={(e) => setForm({ ...form, changeQty: Number(e.target.value) })}
                    className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Audit variance, Damaged in transit, Supplier replacement"
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-300/80">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl neu-button text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
                >
                  {loading ? 'Submitting...' : 'Record Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
