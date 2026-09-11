import { UserRole } from '../types';

export type NavTab =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'challans'
  | 'movements'
  | 'activity'
  | 'api';

/**
 * Exact Role Permission Matrix:
 *
 * ADMIN:
 * - Dashboard: ALLOW
 * - Customers CRM: ALLOW
 * - Inventory / Products: ALLOW
 * - Sales Challans: ALLOW
 * - Stock Movements: ALLOW
 * - Audit Activity: ALLOW
 * - OpenAPI Spec: ALLOW
 *
 * SALES:
 * - Dashboard: ALLOW
 * - Customers CRM: ALLOW
 * - Inventory / Products: VIEW ONLY (Allowed to view)
 * - Sales Challans: ALLOW
 * - Stock Movements: VIEW ONLY (Allowed to view)
 * - Audit Activity: DENY
 * - OpenAPI Spec: DENY
 *
 * WAREHOUSE:
 * - Dashboard: ALLOW
 * - Customers CRM: DENY
 * - Inventory / Products: ALLOW
 * - Sales Challans: VIEW ONLY (Allowed to view only; cannot create, confirm, or cancel)
 * - Stock Movements: ALLOW
 * - Audit Activity: DENY
 * - OpenAPI Spec: DENY
 *
 * ACCOUNTS:
 * - Dashboard: ALLOW
 * - Customers CRM: VIEW ONLY (Allowed to view)
 * - Inventory / Products: DENY
 * - Sales Challans: VIEW & CANCEL (Allowed to view and cancel; cannot create/draft or confirm)
 * - Stock Movements: VIEW ONLY (Allowed to view)
 * - Audit Activity: DENY
 * - OpenAPI Spec: DENY
 */

export function isModuleAllowed(role: UserRole | undefined, tab: NavTab): boolean {
  if (!role) return false;
  if (role === 'Admin') return true;

  switch (tab) {
    case 'dashboard':
      return true;

    case 'customers':
      // Warehouse is DENIED CRM access
      return role !== 'Warehouse';

    case 'products':
      // Accounts is DENIED Inventory access
      return role !== 'Accounts';

    case 'challans':
      // All 4 roles can view/access Challans (Warehouse is view-only)
      return true;

    case 'movements':
      // All 4 roles can view movements (Sales and Accounts are view-only)
      return true;

    case 'activity':
    case 'api':
      // Audit Activity and OpenAPI Spec are strictly ADMIN ONLY
      return false;

    default:
      return false;
  }
}

/**
 * Checks if a role has view-only access to a specific module
 */
export function isModuleViewOnly(role: UserRole | undefined, tab: NavTab): boolean {
  if (!role || role === 'Admin') return false;
  if (tab === 'products' && role === 'Sales') return true;
  if (tab === 'challans' && role === 'Warehouse') return true;
  if (tab === 'customers' && role === 'Accounts') return true;
  if (tab === 'movements' && (role === 'Sales' || role === 'Accounts')) return true;
  return false;
}

/**
 * Maps browser path or route string to NavTab
 */
export function pathToNavTab(pathname: string): NavTab {
  const cleanPath = pathname.replace(/^\//, '').toLowerCase().trim();
  if (!cleanPath || cleanPath === 'dashboard') return 'dashboard';
  if (cleanPath === 'customers' || cleanPath === 'crm') return 'customers';
  if (cleanPath === 'products' || cleanPath === 'inventory') return 'products';
  if (cleanPath === 'challans' || cleanPath === 'sales') return 'challans';
  if (cleanPath === 'movements' || cleanPath === 'stock' || cleanPath === 'stock-movements') return 'movements';
  if (cleanPath === 'activity' || cleanPath === 'audit' || cleanPath === 'audit-activity') return 'activity';
  if (cleanPath === 'api' || cleanPath === 'openapi') return 'api';
  return 'dashboard';
}
