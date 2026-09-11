import React from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  ArrowLeftRight,
  History,
  Terminal,
} from 'lucide-react';
import { UserRole } from '../types';
import { NavTab, isModuleAllowed, isModuleViewOnly } from '../utils/rbac';

export type { NavTab };

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole?: UserRole;
  lowStockCount?: number;
  draftChallansCount?: number;
}

export default function Sidebar({
  currentTab,
  onSelectTab,
  userRole,
  lowStockCount = 0,
  draftChallansCount = 0,
}: SidebarProps) {
  const allNavItems: { id: NavTab; label: string; icon: React.ElementType; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers CRM', icon: Users },
    {
      id: 'products',
      label: 'Inventory / Products',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'challans',
      label: 'Sales Challans',
      icon: FileText,
      badge: draftChallansCount > 0 ? draftChallansCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    { id: 'movements', label: 'Stock Movements', icon: ArrowLeftRight },
    { id: 'activity', label: 'Audit Activity', icon: History },
    { id: 'api', label: 'OpenAPI Spec', icon: Terminal },
  ];

  // Strictly filter items based on the user's authenticated database role
  const visibleNavItems = allNavItems.filter((item) => isModuleAllowed(userRole, item.id));

  return (
    <aside className="w-full md:w-64 bg-[#e6ecf4] p-3 md:p-4 flex flex-row md:flex-col gap-2 shrink-0 border-b md:border-b-0 md:border-r border-slate-300/60 overflow-x-auto md:overflow-y-auto">
      <div className="hidden md:block px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Operations Menu
      </div>

      <nav className="flex flex-row md:flex-col gap-2 w-full">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isViewOnly = isModuleViewOnly(userRole, item.id);
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'neu-pressed text-indigo-700 bg-[#e0e7f2] shadow-inner font-bold'
                  : 'neu-button text-slate-700 hover:text-indigo-600 active:scale-95'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
                {isViewOnly && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-normal shrink-0">
                    View
                  </span>
                )}
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                    item.badgeColor || 'bg-indigo-600 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick helper tip in sidebar for evaluation */}
      <div className="hidden md:block mt-auto pt-4">
        <div className="rounded-2xl neu-flat-sm p-3 border border-white/60 text-slate-600 text-xs">
          <p className="font-bold text-slate-800 mb-1">Business Guardrail</p>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Stock availability is verified upon challan confirmation. Out-of-stock items will reject confirmation.
          </p>
        </div>
      </div>
    </aside>
  );
}
