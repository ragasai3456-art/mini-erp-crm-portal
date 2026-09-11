import { Printer, X, ShieldCheck, Clock, Ban } from 'lucide-react';
import { Challan } from '../types';

interface InvoiceModalProps {
  challan: Challan | null;
  onClose: () => void;
}

export default function InvoiceModal({ challan, onClose }: InvoiceModalProps) {
  if (!challan) return null;

  const subtotal = challan.total_amount;
  const gstRate = 0.18; // 18% standard GST for industrial goods
  const gstAmount = Math.round(subtotal * gstRate);
  const grandTotal = subtotal + gstAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl neu-flat bg-[#e6ecf4] rounded-3xl p-6 md:p-8 border border-white/80 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-300/80 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tax Invoice & Delivery Challan
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                challan.status === 'Confirmed'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : challan.status === 'Cancelled'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {challan.status === 'Confirmed'
                ? 'Confirmed & Dispatched'
                : challan.status === 'Cancelled'
                ? 'Cancelled & Voided'
                : 'Draft Document'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-print-invoice"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Export PDF</span>
            </button>
            <button
              id="btn-close-invoice"
              onClick={onClose}
              className="p-2 rounded-xl neu-button text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable invoice card */}
        <div id="printable-invoice" className="bg-white rounded-2xl p-6 md:p-8 text-slate-800 shadow-sm border border-slate-200">
          {/* Company header & Invoice metadata */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-black tracking-tight text-indigo-700">
                  APEX INDUSTRIAL AUTOMATION
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unit 108, Tech Manufacturing Hub, Phase II<br />
                MIDC Industrial Zone, Mumbai - 400093<br />
                GSTIN: <strong>27AAACA9921B1ZG</strong> | CIN: U29200MH2020PTC118920<br />
                Email: accounts@apex-automation.com | Support: +91 22 6789 0000
              </p>
            </div>

            <div className="text-left sm:text-right">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                DELIVERY CHALLAN
              </h2>
              <p className="text-sm font-black text-indigo-600 mt-0.5">{challan.challan_no}</p>
              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                <p>Date: <strong>{new Date(challan.created_at).toLocaleDateString()}</strong></p>
                {challan.confirmed_at && (
                  <p>Dispatch Date: <strong>{new Date(challan.confirmed_at).toLocaleDateString()}</strong></p>
                )}
                <p>Prepared By: <strong>{challan.created_by}</strong></p>
                {challan.confirmed_by && (
                  <p>Authorized By: <strong>{challan.confirmed_by}</strong></p>
                )}
              </div>
            </div>
          </div>

          {/* Consignee / Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 text-xs border-b border-slate-200">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Consignee (Bill To / Ship To)
              </span>
              <p className="text-sm font-bold text-slate-900">{challan.customer_name}</p>
              {challan.customer_gst && (
                <p className="text-slate-600 mt-0.5">
                  GSTIN: <span className="font-semibold text-slate-800">{challan.customer_gst}</span>
                </p>
              )}
              <p className="text-slate-500 mt-1">Delivery Destination: Customer Registered Warehouse Premises</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Dispatch & Transport Details
              </span>
              <p className="text-slate-700">Dispatch Mode: <strong>Surface Cargo / Courier Express</strong></p>
              <p className="text-slate-700">Vehicle / Airway Bill No: <strong>LR-2026-{challan.challan_no.replace('CH-2026-', '')}</strong></p>
              <p className="text-slate-700">Total Packages: <strong>{challan.items.length} Parcel(s)</strong></p>
            </div>
          </div>

          {/* Line items table */}
          <div className="py-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Unit Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {challan.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-2.5 px-3 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.product_snapshot_name}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{item.product_snapshot_sku}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">{item.qty}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{item.product_snapshot_price.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.line_total.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-200 text-xs">
            <div className="max-w-xs text-slate-500">
              <p className="font-bold text-slate-700 mb-1">Terms & Conditions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Goods once dispatched cannot be returned without Return Authorization.</li>
                <li>Verify material count and tamper seal upon delivery receipt.</li>
                {challan.notes && (
                  <li className="text-slate-800 font-medium">Remarks: {challan.notes}</li>
                )}
              </ul>
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({challan.total_qty} units):</span>
                <span className="font-semibold text-slate-800">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (9%):</span>
                <span>₹{(gstAmount / 2).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (9%):</span>
                <span>₹{(gstAmount / 2).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-indigo-700 pt-2 border-t border-slate-300">
                <span>Grand Total (INR):</span>
                <span>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Signatures & Stamp */}
          <div className="grid grid-cols-2 gap-8 pt-10 mt-6 border-t border-slate-200 text-center text-xs">
            <div>
              <div className="h-12 border-b border-dashed border-slate-300 flex items-end justify-center pb-1 text-slate-400">
                Receiver's Signature & Official Seal
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Received above goods in good order</p>
            </div>

            <div>
              <div className="h-12 border-b border-dashed border-slate-300 flex items-end justify-center pb-1 text-indigo-700 font-bold">
                {challan.status === 'Confirmed' ? (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Verified & Dispatched: {challan.confirmed_by || 'Operations Team'}
                  </span>
                ) : challan.status === 'Cancelled' ? (
                  <span className="flex items-center gap-1 text-rose-600">
                    <Ban className="w-4 h-4" /> Cancelled & Voided
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="w-4 h-4" /> Pending Confirmation
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">For APEX INDUSTRIAL AUTOMATION</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
