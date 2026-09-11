export type UserRole = 'Admin' | 'Sales' | 'Warehouse' | 'Accounts';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type CustomerType = 'Retailer' | 'Wholesaler' | 'Distributor' | 'Direct';
export type CustomerStatus = 'Lead' | 'Prospect' | 'Active' | 'Inactive';

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  business_name: string;
  gst: string;
  type: CustomerType;
  address: string;
  status: CustomerStatus;
  follow_up_date?: string;
  notes?: string;
  created_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  min_stock: number;
  location: string;
  current_stock: number;
  created_at: string;
}

export type MovementType = 'IN' | 'OUT';

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  change_qty: number;
  type: MovementType;
  reason: string;
  created_by: string;
  timestamp: string;
}

export type ChallanStatus = 'Draft' | 'Confirmed' | 'Cancelled';

export interface ChallanItem {
  id: string;
  challan_id: string;
  product_id: string;
  product_snapshot_name: string;
  product_snapshot_sku: string;
  product_snapshot_price: number;
  qty: number;
  line_total: number;
}

export interface Challan {
  id: string;
  challan_no: string;
  customer_id: string;
  customer_name: string;
  customer_gst?: string;
  total_qty: number;
  total_amount: number;
  status: ChallanStatus;
  created_by: string;
  created_at: string;
  confirmed_at?: string;
  confirmed_by?: string;
  notes?: string;
  items: ChallanItem[];
}

export interface ActivityLog {
  id: string;
  user_name: string;
  user_role: UserRole;
  action: string;
  details: string;
  timestamp: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalProducts: number;
  lowStockCount: number;
  totalChallans: number;
  draftChallans: number;
  confirmedChallans: number;
  totalRevenue: number;
  recentMovements: InventoryMovement[];
  recentChallans: Challan[];
  lowStockProducts: Product[];
}

export interface ApiErrorResponse {
  status: 'error';
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  requestId: string;
  timestamp: string;
}
