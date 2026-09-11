import { useState } from 'react';
import { Challan, Customer, Product, UserRole } from '../types';
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  X,
  AlertTriangle,
  FileCheck2,
  Trash2,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { api } from '../services/api';

interface ChallansViewProps {
  challans: Challan[];
  customers: Customer[];
  products: Product[];
  userRole?: UserRole;
  onRefresh: () => void;
  onViewInvoice: (challan: Challan) => void;
  isOpenCreateModalImmediately?: boolean;
  onCloseCreateModalImmediately?: () => void;
}

interface NewChallanLineItem {
  product_id: string;
  qty: number;
}

export default function ChallansView({
  challans,
  customers,
  products,
  userRole,
  onRefresh,
  onViewInvoice,
  isOpenCreateModalImmediately,
  onCloseCreateModalImmediately,
}: ChallansViewProps) {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // New Challan Form Modal (Admin & Sales only)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(
    (isOpenCreateModalImmediately && (userRole === 'Admin' || userRole === 'Sales')) || false
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [lineItems, setLineItems] = useState<NewChallanLineItem[]>([
    { product_id: products[0]?.id || '', qty: 1 },
  ]);
  const [challanNotes, setChallanNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Status message after action
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const statuses = ['All', 'Draft', 'Confirmed', 'Cancelled'];

  const filteredChallans = challans.filter((ch) => {
    const matchesSearch =
      ch.challan_no.toLowerCase().includes(search.toLowerCase()) ||
      ch.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (ch.notes && ch.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = selectedStatus === 'All' || ch.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleOpenCreateModal = () => {
    if (userRole !== 'Admin' && userRole !== 'Sales') return;
    setSelectedCustomerId(customers[0]?.id || '');
    setLineItems([{ product_id: products[0]?.id || '', qty: 1 }]);
    setChallanNotes('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    if (onCloseCreateModalImmediately) onCloseCreateModalImmediately();
  };

  const handleAddLineItem = () => {
    const availableProd = products.find((p) => !lineItems.some((li) => li.product_id === p.id)) || products[0];
    setLineItems([...lineItems, { product_id: availableProd?.id || '', qty: 1 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: 'product_id' | 'qty', value: any) => {
    const next = [...lineItems];
    next[index] = {
      ...next[index],
      [field]: field === 'qty' ? Math.max(1, Number(value) || 1) : value,
    };
    setLineItems(next);
  };

  const calculatePreviewTotals = () => {
    let totalQty = 0;
    let totalAmount = 0;
    for (const item of lineItems) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        totalQty += item.qty;
        totalAmount += prod.price * item.qty;
      }
    }
    return { totalQty, totalAmount };
  };

  const handleCreateChallan = async (confirmImmediately: boolean) => {
    setFormError(null);

    if (!selectedCustomerId) {
      setFormError('Please select a customer.');
      return;
    }

    if (lineItems.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    // Check client-side stock warning if confirming immediately
    if (confirmImmediately) {
      for (const item of lineItems) {
        const prod = products.find((p) => p.id === item.product_id);
        if (prod && prod.current_stock < item.qty) {
          setFormError(
            `Insufficient stock for ${prod.name}! Requested: ${item.qty}, Available: ${prod.current_stock}. You can save as Draft instead.`
          );
          return;
        }
      }
    }

    setLoading(true);
    try {
      await api.createChallan({
        customer_id: selectedCustomerId,
        items: lineItems,
        notes: challanNotes,
        confirmImmediately,
      });

      setActionNotice({
        type: 'success',
        message: confirmImmediately
          ? 'Challan created, stock decremented, and dispatched successfully!'
          : 'Draft challan saved. Awaiting warehouse stock confirmation.',
      });
      onRefresh();
      handleCloseCreateModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to process challan');
    } finally {
      setLoading(false);
    }
  };

  // Critical transactional rule: Confirm Challan (Admin, Sales only)
  const handleConfirmChallan = async (challan: Challan) => {
    if (!confirm(`Confirm and dispatch Challan ${challan.challan_no}? This will verify warehouse stock and decrement inventory.`)) {
      return;
    }

    setLoading(true);
    setActionNotice(null);

    try {
      const res = await api.confirmChallan(challan.id);
      setActionNotice({
        type: 'success',
        message: res.message || `Challan ${challan.challan_no} confirmed and dispatched!`,
      });
      onRefresh();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: `Stock Confirmation Failed: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Critical transactional rule: Cancel Challan (Admin, Accounts only)
  const handleCancelChallan = async (challan: Challan) => {
    const isConfirmed = challan.status === 'Confirmed';
    const confirmMsg = isConfirmed
      ? `Cancel Confirmed Challan ${challan.challan_no}? This will restore ${challan.total_qty} units back to warehouse inventory.`
      : `Cancel Draft Challan ${challan.challan_no}?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setLoading(true);
    setActionNotice(null);

    try {
      const res = await api.cancelChallan(challan.id);
      setActionNotice({
        type: 'success',
        message: res.message || `Challan ${challan.challan_no} has been cancelled`,
      });
      onRefresh();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: `Cancellation Failed: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const { totalQty: previewQty, totalAmount: previewAmount } = calculatePreviewTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="neu-flat p-6 rounded-3xl border border-white/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Sales Challan & Order Fulfillment
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create sales delivery challans with stock checks and tax invoice generation.
          </p>
        </div>

        {(userRole === 'Admin' || userRole === 'Sales') && (
          <button
            id="btn-create-challan"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Delivery Challan</span>
          </button>
        )}
      </div>

      {/* Action Notice Alert if any */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="neu-flat p-4 rounded-2xl border border-white/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {statuses.map((st) => (
            <button
              key={st}
              id={`filter-challan-status-${st.toLowerCase()}`}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === st
                  ? 'neu-pressed text-indigo-700 bg-[#e0e7f2] font-bold'
                  : 'neu-button text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-challan-search"
            type="text"
            placeholder="Search Challan #, customer, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full neu-input pl-9 pr-3.5 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Challan List Table */}
      <div className="neu-flat p-6 rounded-3xl border border-white/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="pb-3 pl-2">Challan No</th>
                <th className="pb-3">Customer / Consignee</th>
                <th className="pb-3">Items & Qty</th>
                <th className="pb-3 text-right">Taxable Amount</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3">Date</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredChallans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    No sales challans found. Click 'New Delivery Challan' above to create one.
                  </td>
                </tr>
              ) : (
                filteredChallans.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-200/30 transition-colors">
                    <td className="py-3.5 pl-2 font-mono font-bold text-indigo-700">
                      {ch.challan_no}
                    </td>

                    <td className="py-3.5">
                      <div className="font-bold text-slate-900">{ch.customer_name}</div>
                      {ch.customer_gst && (
                        <span className="text-[10px] font-mono text-slate-500">
                          GST: {ch.customer_gst}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5">
                      <span className="font-semibold text-slate-800">
                        {ch.total_qty} units
                      </span>{' '}
                      <span className="text-[11px] text-slate-500">
                        ({ch.items.length} line items)
                      </span>
                    </td>

                    <td className="py-3.5 text-right font-bold text-slate-800 font-mono">
                      ₹{ch.total_amount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 text-center">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                          ch.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : ch.status === 'Cancelled'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {ch.status === 'Confirmed' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Confirmed
                          </>
                        ) : ch.status === 'Cancelled' ? (
                          <>
                            <Ban className="w-3 h-3" /> Cancelled
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> Draft
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 text-slate-500 text-[11px] font-mono">
                      {new Date(ch.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {ch.status === 'Draft' && (userRole === 'Admin' || userRole === 'Sales') && (
                          <button
                            id={`btn-confirm-${ch.challan_no.toLowerCase()}`}
                            onClick={() => handleConfirmChallan(ch)}
                            disabled={loading}
                            title="Confirm & Decrement Warehouse Stock"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg neu-accent-btn text-[11px] font-semibold"
                          >
                            <FileCheck2 className="w-3 h-3 text-emerald-200" />
                            <span>Confirm</span>
                          </button>
                        )}
                        {(ch.status === 'Draft' || ch.status === 'Confirmed') &&
                          (userRole === 'Admin' || userRole === 'Accounts') && (
                            <button
                              id={`btn-cancel-${ch.challan_no.toLowerCase()}`}
                              onClick={() => handleCancelChallan(ch)}
                              disabled={loading}
                              title={
                                ch.status === 'Confirmed'
                                  ? 'Cancel Challan & Restore Warehouse Stock'
                                  : 'Cancel Draft Challan'
                              }
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg neu-button text-[11px] font-semibold text-rose-700 hover:text-rose-900 border border-rose-200/80 hover:border-rose-300 transition-all"
                            >
                              <Ban className="w-3 h-3 text-rose-500" />
                              <span>Cancel</span>
                            </button>
                          )}
                        <button
                          id={`btn-view-invoice-${ch.challan_no.toLowerCase()}`}
                          onClick={() => onViewInvoice(ch)}
                          title="View / Print Tax Invoice"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg neu-button text-[11px] font-semibold text-slate-700 hover:text-indigo-600"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          <span>Invoice</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Challan Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-5">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  Create Sales Delivery Challan
                </h3>
                <p className="text-xs text-slate-500">
                  Auto-increments sequence number & performs stock validation.
                </p>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Customer / Buyer *
                </label>
                <select
                  id="select-challan-customer"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800 bg-[#edf2f8]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name || c.name} ({c.name} - {c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Challan Line Items (Products & Quantities)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.product_id);
                    const isOutOfStock = prod ? prod.current_stock < item.qty : false;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl neu-flat-sm border border-white/60 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                      >
                        <div className="flex-1 w-full">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                            Product
                          </label>
                          <select
                            value={item.product_id}
                            onChange={(e) => handleUpdateItem(idx, 'product_id', e.target.value)}
                            className="w-full neu-input px-3 py-1.5 rounded-xl text-xs text-slate-800 bg-[#edf2f8]"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} [{p.sku}] - ₹{p.price.toLocaleString()} (Avail: {p.current_stock})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-24 shrink-0">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                            className="w-full neu-input px-3 py-1.5 rounded-xl text-xs text-slate-800 font-bold"
                          />
                        </div>

                        <div className="w-28 shrink-0 text-right">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                            Subtotal
                          </label>
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            ₹{prod ? (prod.price * item.qty).toLocaleString('en-IN') : 0}
                          </span>
                        </div>

                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-2 rounded-xl neu-button text-slate-400 hover:text-rose-600 sm:self-end"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isOutOfStock && prod && (
                          <div className="w-full text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>
                              Requested {item.qty} exceeds current stock ({prod.current_stock}). Confirming will be blocked.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dispatch Remarks & Instructions
                </label>
                <input
                  type="text"
                  value={challanNotes}
                  onChange={(e) => setChallanNotes(e.target.value)}
                  placeholder="e.g. Dispatched through BlueDart Courier, Door delivery required"
                  className="w-full neu-input px-3.5 py-2 rounded-xl text-xs text-slate-800"
                />
              </div>

              {/* Financial summary bar */}
              <div className="neu-pressed p-4 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Total Items: </span>
                  <strong className="text-slate-800">{previewQty} Units</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Taxable Value: </span>
                  <strong className="text-base font-black text-indigo-700 font-mono">
                    ₹{previewAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-300/80">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl neu-button text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-save-draft-challan"
                  disabled={loading}
                  onClick={() => handleCreateChallan(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl neu-button text-xs font-bold text-amber-700 hover:text-amber-900 active:scale-95 transition-all"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  id="btn-confirm-immediate-challan"
                  disabled={loading}
                  onClick={() => handleCreateChallan(true)}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-200" />
                  <span>{loading ? 'Processing...' : 'Confirm & Dispatch Stock'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
