import {
  IndianRupee,
  Users,
  Package,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { DashboardStats, Challan, UserRole } from '../types';
import { NavTab } from '../utils/rbac';

interface DashboardViewProps {
  stats: DashboardStats | null;
  userRole?: UserRole;
  onNavigate: (tab: NavTab) => void;
  onViewInvoice: (challan: Challan) => void;
  onOpenNewChallan: () => void;
  onOpenNewCustomer: () => void;
}

export default function DashboardView({
  stats,
  userRole,
  onNavigate,
  onViewInvoice,
  onOpenNewChallan,
  onOpenNewCustomer,
}: DashboardViewProps) {
  if (!stats) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Loading ERP metrics and live warehouse state...
      </div>
    );
  }

  const canAccessCRM = userRole !== 'Warehouse';
  const canAccessInventory = userRole !== 'Accounts';
  const canCreateChallan = userRole === 'Admin' || userRole === 'Sales';
  const canCreateCustomer = userRole === 'Admin' || userRole === 'Sales';

  const statCards = [
    {
      label: 'Confirmed Sales Revenue',
      value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
      subtext: `${stats.confirmedChallans} dispatched challans`,
      icon: IndianRupee,
      color: 'text-emerald-600 bg-emerald-100/60',
      action: () => onNavigate('challans'),
    },
    {
      label: 'Total Registered Accounts',
      value: stats.totalCustomers,
      subtext: `${stats.activeCustomers} active clients`,
      icon: Users,
      color: 'text-indigo-600 bg-indigo-100/60',
      action: canAccessCRM ? () => onNavigate('customers') : undefined,
    },
    {
      label: 'Inventory Catalog',
      value: stats.totalProducts,
      subtext: `${stats.lowStockCount} below min threshold`,
      icon: Package,
      color: 'text-blue-600 bg-blue-100/60',
      badge: stats.lowStockCount > 0 ? `${stats.lowStockCount} Critical` : undefined,
      badgeColor: 'bg-rose-500 text-white',
      action: canAccessInventory ? () => onNavigate('products') : undefined,
    },
    {
      label: 'Sales Challans',
      value: stats.totalChallans,
      subtext: `${stats.draftChallans} draft(s) awaiting confirm`,
      icon: FileText,
      color: 'text-amber-600 bg-amber-100/60',
      badge: stats.draftChallans > 0 ? `${stats.draftChallans} Pending` : undefined,
      badgeColor: 'bg-amber-500 text-white',
      action: () => onNavigate('challans'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Quick Actions */}
      <div className="neu-flat p-6 rounded-3xl border border-white/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Operations & Supply Chain Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock validation, role-based workflows, and automated tax challans.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canCreateChallan && (
            <button
              id="btn-quick-new-challan"
              onClick={onOpenNewChallan}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl neu-accent-btn text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Sales Challan</span>
            </button>
          )}
          {canCreateCustomer && (
            <button
              id="btn-quick-new-customer"
              onClick={onOpenNewCustomer}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl neu-button text-xs font-semibold text-slate-700 hover:text-indigo-600 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          const isClickable = !!card.action;
          return (
            <div
              key={idx}
              onClick={card.action}
              className={`neu-flat p-5 rounded-2xl border border-white/60 transition-all ${
                isClickable ? 'hover:translate-y-[-2px] cursor-pointer group' : 'cursor-default opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl neu-flat-sm flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {card.badge ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                    {card.badge}
                  </span>
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                )}
              </div>
              <p className="text-2xl font-black tracking-tight text-slate-800">
                {card.value}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1">{card.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{card.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Low Stock Warning Banner if any items are below minimum stock */}
      {stats.lowStockProducts.length > 0 && (
        <div className="neu-flat p-5 rounded-2xl border border-rose-200/80 bg-rose-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 mt-0.5 neu-flat-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-900">
                  Inventory Replenishment Required ({stats.lowStockProducts.length} Items Below Threshold)
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  Business Rule Alert: Challan confirmations for these items will fail if order quantity exceeds available stock.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stats.lowStockProducts.map((p) => (
                    <span
                      key={p.id}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/80 border border-rose-200 text-rose-800 font-medium"
                    >
                      <strong>{p.name}</strong> ({p.sku}): Stock {p.current_stock} / Min {p.min_stock} [{p.location}]
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="px-3 py-1.5 rounded-xl neu-button text-xs font-bold text-rose-700 hover:text-rose-900 shrink-0"
            >
              Restock Now
            </button>
          </div>
        </div>
      )}

      {/* Split Section: Recent Challans & Recent Stock Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Challans */}
        <div className="lg:col-span-7 neu-flat p-6 rounded-3xl border border-white/60">
          <div className="flex items-center justify-between pb-4 border-b border-slate-300/60 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Sales Challans</h3>
              <p className="text-[11px] text-slate-500">Live order & dispatch tracking</p>
            </div>
            <button
              onClick={() => onNavigate('challans')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="pb-2">Challan No</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {stats.recentChallans.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-200/40 transition-colors">
                    <td className="py-3 font-mono font-bold text-indigo-600">{ch.challan_no}</td>
                    <td className="py-3 font-medium text-slate-800 truncate max-w-[140px]">
                      {ch.customer_name}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-700">
                      ₹{ch.total_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ch.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : ch.status === 'Cancelled'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {ch.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onViewInvoice(ch)}
                        title="View Tax Invoice"
                        className="p-1.5 rounded-lg neu-button text-slate-600 hover:text-indigo-600 transition-all inline-flex items-center"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Inventory Movements */}
        <div className="lg:col-span-5 neu-flat p-6 rounded-3xl border border-white/60">
          <div className="flex items-center justify-between pb-4 border-b border-slate-300/60 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Inventory Ledger</h3>
              <p className="text-[11px] text-slate-500">Stock IN / OUT log</p>
            </div>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recentMovements.map((mov) => (
              <div
                key={mov.id}
                className="p-3 rounded-2xl neu-flat-sm border border-white/60 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                        mov.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {mov.type === 'IN' ? '+IN' : '-OUT'} {mov.change_qty}
                    </span>
                    <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                      {mov.product_name}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                    {mov.reason} • by {mov.created_by}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(mov.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
