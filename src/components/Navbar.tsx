import { User, UserRole } from '../types';
import { Shield, UserCircle, RefreshCw, Terminal, LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onOpenApiDocs: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  isRefreshing?: boolean;
}

function getRoleBadgeStyle(role?: UserRole) {
  switch (role) {
    case 'Admin':
      return 'bg-indigo-100/90 text-indigo-800 border-indigo-300';
    case 'Sales':
      return 'bg-emerald-100/90 text-emerald-800 border-emerald-300';
    case 'Warehouse':
      return 'bg-amber-100/90 text-amber-800 border-amber-300';
    case 'Accounts':
      return 'bg-sky-100/90 text-sky-800 border-sky-300';
    default:
      return 'bg-slate-200 text-slate-700 border-slate-300';
  }
}

export default function Navbar({
  currentUser,
  onOpenApiDocs,
  onRefresh,
  onLogout,
  isRefreshing,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#e6ecf4]/95 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 py-3 flex items-center justify-between shadow-[0_4px_12px_rgba(180,195,215,0.3)]">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl neu-flat flex items-center justify-center text-indigo-600 font-black text-lg">
          <Shield className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800">
              ERP<span className="text-indigo-600">CORE</span>
            </h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 shadow-inner">
              PostgreSQL • RBAC
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Role-Based Operations • Inventory Protection
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Refresh button */}
        <button
          id="btn-refresh-data"
          onClick={onRefresh}
          title="Refresh real-time data"
          className="p-2 rounded-xl neu-button text-slate-600 hover:text-indigo-600 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
        </button>

        {/* API / Swagger docs button (Admin only) */}
        {currentUser?.role === 'Admin' && (
          <button
            id="btn-open-api-docs"
            onClick={onOpenApiDocs}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-button text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-all"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>OpenAPI Docs</span>
          </button>
        )}

        {/* Read-Only Authenticated User Badge (Non-clickable, no dropdown) */}
        <div
          id="user-profile-badge"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl neu-flat border border-white/70 shadow-sm"
        >
          <UserCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          <div className="text-left hidden sm:block">
            <span className="block font-bold leading-tight text-xs text-slate-800">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
              {currentUser?.email}
            </span>
          </div>
          {/* Read-only Role Badge */}
          <span
            id="user-role-badge"
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-inner select-none ${getRoleBadgeStyle(
              currentUser?.role
            )}`}
          >
            {currentUser?.role || 'Guest'}
          </span>
        </div>

        {/* Logout Button */}
        <button
          id="btn-logout"
          onClick={onLogout}
          title="Sign Out of Portal"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-button text-xs font-semibold text-rose-600 hover:text-rose-700 active:scale-95 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
