import { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardView from './pages/DashboardView';
import CustomersView from './pages/CustomersView';
import ProductsView from './pages/ProductsView';
import ChallansView from './pages/ChallansView';
import InventoryLogView from './pages/InventoryLogView';
import ActivityLogView from './pages/ActivityLogView';
import LoginPage from './pages/LoginPage';
import InvoiceModal from './components/InvoiceModal';
import ApiDocsModal from './components/ApiDocsModal';
import {
  Customer,
  Product,
  Challan,
  InventoryMovement,
  DashboardStats,
  ActivityLog,
  User,
} from './types';
import { NavTab, isModuleAllowed, pathToNavTab } from './utils/rbac';
import { api, getStoredToken, getStoredUser, clearAuthSession } from './services/api';
import { Shield, Terminal, Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Sync initial tab from URL path
  const [currentTab, setCurrentTab] = useState<NavTab>(() => pathToNavTab(window.location.pathname));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Challan | null>(null);
  const [isApiDocsOpen, setIsApiDocsOpen] = useState(false);
  const [isQuickNewChallanOpen, setIsQuickNewChallanOpen] = useState(false);
  const [isQuickNewCustomerOpen, setIsQuickNewCustomerOpen] = useState(false);

  // Route navigation helper that keeps window.location in sync
  const navigateToTab = useCallback((tab: NavTab) => {
    setCurrentTab(tab);
    const targetPath = tab === 'dashboard' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, []);

  // Listen for browser forward/back buttons or manual URL changes
  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(pathToNavTab(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch only the datasets authorized for the authenticated user's role
  const fetchAllData = useCallback(async () => {
    if (!getStoredToken()) return;
    const user = getStoredUser();
    const role = user?.role;

    setIsRefreshing(true);
    try {
      const promises: Promise<any>[] = [
        api.getDashboardStats().catch(() => null),
      ];

      // Warehouse has no customer CRM access
      if (role !== 'Warehouse') {
        promises.push(api.getCustomers().catch(() => ({ data: [] })));
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // Accounts has no inventory/products access
      if (role !== 'Accounts') {
        promises.push(api.getProducts().catch(() => []));
      } else {
        promises.push(Promise.resolve([]));
      }

      // Sales Challans and Stock movements accessible to all authorized roles
      promises.push(api.getChallans().catch(() => []));
      promises.push(api.getMovements().catch(() => []));

      // Audit activity logs are strictly Admin only
      if (role === 'Admin') {
        promises.push(api.getActivityLogs().catch(() => []));
      } else {
        promises.push(Promise.resolve([]));
      }

      const [
        statsData,
        customersData,
        productsData,
        challansData,
        movementsData,
        logsData,
      ] = await Promise.all(promises);

      if (statsData) setStats(statsData);
      if (customersData?.data) setCustomers(customersData.data);
      if (productsData) setProducts(productsData);
      if (challansData) setChallans(challansData);
      if (movementsData) setMovements(movementsData);
      if (logsData) setActivityLogs(logsData);
    } catch (err) {
      console.error('Error fetching ERP data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Validate session on app initialization / page refresh
  useEffect(() => {
    const restoreSession = async () => {
      const token = getStoredToken();
      if (!token) {
        setCurrentUser(null);
        setIsAuthChecking(false);
        return;
      }

      try {
        const meData = await api.getMe();
        if (meData?.user) {
          setCurrentUser(meData.user);
          await fetchAllData();
        } else {
          clearAuthSession();
          setCurrentUser(null);
        }
      } catch {
        // Token expired or invalid
        clearAuthSession();
        setCurrentUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    };

    restoreSession();
  }, [fetchAllData]);

  // Handle successful login
  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    // If the active tab was unauthorized for this new role, reset to dashboard
    if (!isModuleAllowed(user.role, currentTab)) {
      navigateToTab('dashboard');
    }
    await fetchAllData();
  };

  // Handle logout
  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setStats(null);
    setCustomers([]);
    setProducts([]);
    setChallans([]);
    setMovements([]);
    setActivityLogs([]);
    navigateToTab('dashboard');
  };

  // Initial Auth Loading Screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#e6ecf4] flex flex-col items-center justify-center text-slate-700">
        <div className="neu-flat p-8 rounded-3xl border border-white/80 shadow-lg flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl neu-pressed flex items-center justify-center text-indigo-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-600">Verifying security session...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, render Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const lowStockCount = products.filter((p) => p.current_stock <= p.min_stock).length;
  const draftChallansCount = challans.filter((c) => c.status === 'Draft').length;
  const isTabAllowed = isModuleAllowed(currentUser?.role, currentTab);

  return (
    <div className="min-h-screen bg-[#e6ecf4] text-slate-800 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Neumorphic Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenApiDocs={() => {
          if (currentUser?.role === 'Admin') {
            setIsApiDocsOpen(true);
          }
        }}
        onRefresh={fetchAllData}
        onLogout={handleLogout}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'api') {
              if (currentUser?.role === 'Admin') {
                setIsApiDocsOpen(true);
              }
            } else {
              navigateToTab(tab);
            }
          }}
          userRole={currentUser?.role}
          lowStockCount={lowStockCount}
          draftChallansCount={draftChallansCount}
        />

        {/* Dynamic View Panel with Route Protection */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-70px)]">
          {!isTabAllowed ? (
            /* 403 Access Denied View */
            <div
              id="access-denied-view"
              className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center neu-flat rounded-3xl border border-white/80"
            >
              <div className="w-16 h-16 rounded-2xl neu-flat flex items-center justify-center text-rose-600 mb-4 border border-white/80 shadow-md">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <span className="text-4xl font-black text-slate-800 tracking-tight mb-1 font-mono">403</span>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                You do not have permission to access this module. Your database role (
                <strong className="text-slate-700 font-bold">{currentUser?.role}</strong>
                ) is not authorized to view this resource.
              </p>
              <button
                id="btn-back-to-dashboard"
                onClick={() => navigateToTab('dashboard')}
                className="px-5 py-2.5 rounded-xl neu-button text-xs font-bold text-indigo-600 hover:text-indigo-800 active:scale-95 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  stats={stats}
                  userRole={currentUser?.role}
                  onNavigate={(tab) => navigateToTab(tab)}
                  onViewInvoice={(ch) => setSelectedInvoice(ch)}
                  onOpenNewChallan={() => {
                    navigateToTab('challans');
                    setIsQuickNewChallanOpen(true);
                  }}
                  onOpenNewCustomer={() => {
                    navigateToTab('customers');
                    setIsQuickNewCustomerOpen(true);
                  }}
                />
              )}

              {currentTab === 'customers' && (
                <CustomersView
                  customers={customers}
                  userRole={currentUser?.role}
                  onRefresh={fetchAllData}
                  isOpenModalImmediately={isQuickNewCustomerOpen}
                  onCloseModalImmediately={() => setIsQuickNewCustomerOpen(false)}
                />
              )}

              {currentTab === 'products' && (
                <ProductsView
                  products={products}
                  userRole={currentUser?.role}
                  onRefresh={fetchAllData}
                />
              )}

              {currentTab === 'challans' && (
                <ChallansView
                  challans={challans}
                  customers={customers}
                  products={products}
                  userRole={currentUser?.role}
                  onRefresh={fetchAllData}
                  onViewInvoice={(ch) => setSelectedInvoice(ch)}
                  isOpenCreateModalImmediately={isQuickNewChallanOpen}
                  onCloseCreateModalImmediately={() => setIsQuickNewChallanOpen(false)}
                />
              )}

              {currentTab === 'movements' && (
                <InventoryLogView
                  movements={movements}
                  products={products}
                  userRole={currentUser?.role}
                  onRefresh={fetchAllData}
                />
              )}

              {currentTab === 'activity' && <ActivityLogView logs={activityLogs} />}
            </>
          )}
        </main>
      </div>

      {/* Global Status Bar */}
      <footer className="bg-[#e6ecf4] border-t border-slate-300/80 px-4 md:px-8 py-2 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-700">PostgreSQL Database: Connected</span>
          </div>
          <span>•</span>
          <span>
            Active Role: <strong className="text-indigo-600 font-bold">{currentUser?.role}</strong> ({currentUser?.name})
          </span>
        </div>

        <div className="flex items-center gap-4">
          {currentUser?.role === 'Admin' && (
            <button
              onClick={() => setIsApiDocsOpen(true)}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>OpenAPI v3 Spec (/api/openapi.json)</span>
            </button>
          )}
        </div>
      </footer>

      {/* Tax Invoice & Challan Modal */}
      <InvoiceModal
        challan={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      {/* OpenAPI Documentation Modal (Admin only) */}
      {currentUser?.role === 'Admin' && (
        <ApiDocsModal
          isOpen={isApiDocsOpen}
          onClose={() => setIsApiDocsOpen(false)}
        />
      )}
    </div>
  );
}
