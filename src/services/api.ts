import {
  Customer,
  Product,
  Challan,
  InventoryMovement,
  DashboardStats,
  ActivityLog,
  User,
  UserRole,
  CustomerNote,
} from '../types';

const TOKEN_KEY = 'erp_auth_token';
const USER_KEY = 'erp_user_info';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveAuthSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Configurable API base URL from Vite environment variable VITE_API_URL
const RAW_API_URL = ((import.meta as any).env?.VITE_API_URL || '').trim();
// Strip trailing slashes from base URL
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

export function buildApiUrl(endpoint: string): string {
  // If endpoint is already an absolute URL (http:// or https://), return as-is
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!API_BASE_URL) {
    return cleanEndpoint;
  }

  // If base URL already ends with /api and endpoint starts with /api/, avoid duplicate /api/api
  if (API_BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api')) {
    return `${API_BASE_URL}${cleanEndpoint.slice(4)}`;
  }

  return `${API_BASE_URL}${cleanEndpoint}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = buildApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }
    const errorMsg =
      data?.error?.message ||
      (data?.error?.details ? (typeof data.error.details === 'string' ? data.error.details : JSON.stringify(data.error.details)) : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ status: string; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveAuthSession(res.token, res.user);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/api/dashboard/stats');
  },

  // Customers
  async getCustomers(query: { search?: string; status?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (query.status && query.status !== 'All') params.append('status', query.status);
    if (query.page) params.append('page', String(query.page));
    if (query.limit) params.append('limit', String(query.limit));
    return request<{ data: Customer[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
      `/api/customers?${params.toString()}`
    );
  },

  async getCustomerById(id: string): Promise<Customer & { notes_history?: CustomerNote[] }> {
    return request<Customer & { notes_history?: CustomerNote[] }>(`/api/customers/${id}`);
  },

  async createCustomer(payload: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    return request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCustomer(id: string, payload: Partial<Customer>): Promise<Customer> {
    return request<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteCustomer(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/customers/${id}`, {
      method: 'DELETE',
    });
  },

  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    return request<CustomerNote[]>(`/api/customers/${customerId}/notes`);
  },

  async addCustomerNote(customerId: string, note: string): Promise<CustomerNote> {
    return request<CustomerNote>(`/api/customers/${customerId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  // Products & Inventory
  async getProducts(query: { search?: string; category?: string; lowStockOnly?: boolean } = {}): Promise<Product[]> {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (query.category && query.category !== 'All') params.append('category', query.category);
    if (query.lowStockOnly) params.append('lowStockOnly', 'true');
    return request<Product[]>(`/api/products?${params.toString()}`);
  },

  async getProductById(id: string): Promise<Product> {
    return request<Product>(`/api/products/${id}`);
  },

  async createProduct(payload: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
    return request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(id: string, payload: Partial<Product>): Promise<Product> {
    return request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Inventory movements
  async getMovements(query: { productId?: string; type?: string } = {}): Promise<InventoryMovement[]> {
    const params = new URLSearchParams();
    if (query.productId) params.append('productId', query.productId);
    if (query.type && query.type !== 'All') params.append('type', query.type);
    return request<InventoryMovement[]>(`/api/inventory/movements?${params.toString()}`);
  },

  async addStockMovement(payload: { productId: string; changeQty: number; type: 'IN' | 'OUT'; reason: string }) {
    return request<{ movement: InventoryMovement; updatedProduct: Product }>('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Challans
  async getChallans(query: { search?: string; status?: string } = {}): Promise<Challan[]> {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (query.status && query.status !== 'All') params.append('status', query.status);
    return request<Challan[]>(`/api/challans?${params.toString()}`);
  },

  async getChallanById(id: string): Promise<Challan> {
    return request<Challan>(`/api/challans/${id}`);
  },

  async createChallan(payload: {
    customer_id: string;
    items: { product_id: string; qty: number }[];
    notes?: string;
    confirmImmediately?: boolean;
  }): Promise<Challan> {
    return request<Challan>('/api/challans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async confirmChallan(id: string): Promise<{ status: string; message: string; challan: Challan }> {
    return request<{ status: string; message: string; challan: Challan }>(`/api/challans/${id}/confirm`, {
      method: 'PUT',
    });
  },

  async cancelChallan(id: string): Promise<{ status: string; message: string; challan: Challan }> {
    return request<{ status: string; message: string; challan: Challan }>(`/api/challans/${id}/cancel`, {
      method: 'PUT',
    });
  },

  // Activity Logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    return request<ActivityLog[]>('/api/activity-logs');
  },

  // OpenAPI spec
  async getOpenApiSpec() {
    return request<any>('/api/openapi.json');
  },
};
