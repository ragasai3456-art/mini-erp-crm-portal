import { db } from './postgres';
import {
  User,
  UserRole,
  Customer,
  Product,
  InventoryMovement,
  Challan,
  ChallanItem,
  ActivityLog,
  DashboardStats,
  CustomerNote,
} from '../src/types';

// ================= USER OPERATIONS =================

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const res = await db.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email.trim()]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    passwordHash: row.password_hash,
  };
}

export async function findUserById(id: string): Promise<(User & { passwordHash: string }) | null> {
  const res = await db.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    passwordHash: row.password_hash,
  };
}

// ================= CUSTOMER OPERATIONS =================

export async function getCustomers(query: { search?: string; status?: string; page?: number; limit?: number } = {}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (query.search?.trim()) {
    const q = `%${query.search.trim().toLowerCase()}%`;
    conditions.push(
      `(LOWER(name) LIKE $${paramIdx} OR LOWER(business_name) LIKE $${paramIdx} OR mobile LIKE $${paramIdx} OR LOWER(COALESCE(email, '')) LIKE $${paramIdx} OR LOWER(COALESCE(gst, '')) LIKE $${paramIdx})`
    );
    params.push(q);
    paramIdx++;
  }

  if (query.status && query.status !== 'All') {
    conditions.push(`status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRes = await db.query(`SELECT COUNT(*)::int as total FROM customers ${whereClause}`, params);
  const total = Number(countRes.rows[0]?.total || 0);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 20);
  const offset = (page - 1) * limit;

  const dataRes = await db.query(
    `SELECT id, name, business_name, mobile, email, gst, type, address, status,
            TO_CHAR(follow_up_date, 'YYYY-MM-DD') as follow_up_date, notes,
            created_at::text as created_at
     FROM customers ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return {
    data: dataRes.rows as Customer[],
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getCustomerById(id: string): Promise<(Customer & { notes_history?: CustomerNote[] }) | null> {
  const res = await db.query(
    `SELECT id, name, business_name, mobile, email, gst, type, address, status,
            TO_CHAR(follow_up_date, 'YYYY-MM-DD') as follow_up_date, notes,
            created_at::text as created_at
     FROM customers WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  const customer = res.rows[0];

  // Also fetch customer notes history
  const notesRes = await db.query(
    `SELECT id, customer_id, note, created_by, created_at::text as created_at
     FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  return {
    ...customer,
    notes_history: notesRes.rows as CustomerNote[],
  };
}

export async function createCustomer(payload: Omit<Customer, 'id' | 'created_at'>, creator: User): Promise<Customer> {
  if (!payload.name?.trim()) {
    throw { code: 'VALIDATION_ERROR', message: 'Customer contact person name is required' };
  }
  if (!payload.mobile?.trim()) {
    throw { code: 'VALIDATION_ERROR', message: 'Mobile number is required' };
  }

  const id = `cust_${Date.now()}`;
  const now = new Date().toISOString();
  const followUp = payload.follow_up_date?.trim() ? payload.follow_up_date.trim() : null;

  await db.query(
    `INSERT INTO customers (id, name, business_name, mobile, email, gst, type, address, status, follow_up_date, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
    [
      id,
      payload.name.trim(),
      payload.business_name?.trim() || payload.name.trim(),
      payload.mobile.trim(),
      payload.email?.trim() || null,
      payload.gst?.trim() || null,
      payload.type || 'Retailer',
      payload.address?.trim() || null,
      payload.status || 'Active',
      followUp,
      payload.notes?.trim() || null,
      now,
    ]
  );

  if (payload.notes?.trim()) {
    await db.query(
      `INSERT INTO customer_notes (id, customer_id, note, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [`cnote_${Date.now()}`, id, payload.notes.trim(), creator.name, now]
    );
  }

  await logActivity(
    creator.name,
    creator.role,
    'Customer Added',
    `Added customer account ${payload.name} (${payload.business_name || 'Individual'})`
  );

  const created = await getCustomerById(id);
  return created!;
}

export async function updateCustomer(id: string, payload: Partial<Customer>, updater: User): Promise<Customer> {
  const existing = await getCustomerById(id);
  if (!existing) {
    throw { code: 'NOT_FOUND', message: `Customer ${id} not found` };
  }

  const name = payload.name !== undefined ? payload.name.trim() : existing.name;
  const businessName = payload.business_name !== undefined ? payload.business_name.trim() : existing.business_name;
  const mobile = payload.mobile !== undefined ? payload.mobile.trim() : existing.mobile;
  const email = payload.email !== undefined ? payload.email.trim() : existing.email;
  const gst = payload.gst !== undefined ? payload.gst.trim() : existing.gst;
  const type = payload.type !== undefined ? payload.type : existing.type;
  const address = payload.address !== undefined ? payload.address.trim() : existing.address;
  const status = payload.status !== undefined ? payload.status : existing.status;
  const followUp = payload.follow_up_date !== undefined ? (payload.follow_up_date?.trim() || null) : existing.follow_up_date;
  const notes = payload.notes !== undefined ? payload.notes.trim() : existing.notes;
  const now = new Date().toISOString();

  await db.query(
    `UPDATE customers
     SET name = $1, business_name = $2, mobile = $3, email = $4, gst = $5,
         type = $6, address = $7, status = $8, follow_up_date = $9, notes = $10, updated_at = $11
     WHERE id = $12`,
    [name, businessName, mobile, email, gst, type, address, status, followUp, notes, now, id]
  );

  await logActivity(
    updater.name,
    updater.role,
    'Customer Updated',
    `Updated customer record for ${name} (${businessName})`
  );

  const updated = await getCustomerById(id);
  return updated!;
}

export async function deleteCustomer(id: string, deleter: User): Promise<{ id: string; name: string }> {
  const existing = await getCustomerById(id);
  if (!existing) {
    throw { code: 'NOT_FOUND', message: `Customer ${id} not found` };
  }

  // Check if customer has associated sales challans
  const challanCountRes = await db.query(
    'SELECT COUNT(*)::int as count FROM sales_challans WHERE customer_id = $1',
    [id]
  );
  if (Number(challanCountRes.rows[0]?.count || 0) > 0) {
    throw {
      code: 'INTEGRITY_CONSTRAINT',
      message: `Cannot delete customer '${existing.name}'. Customer has linked sales challan records.`,
    };
  }

  await db.query('DELETE FROM customers WHERE id = $1', [id]);
  await logActivity(
    deleter.name,
    deleter.role,
    'Customer Deleted',
    `Deleted customer account ${existing.name}`
  );

  return { id: existing.id, name: existing.name };
}

export async function addCustomerNote(customerId: string, noteText: string, creator: User): Promise<CustomerNote> {
  if (!noteText?.trim()) {
    throw { code: 'VALIDATION_ERROR', message: 'Note text cannot be empty' };
  }
  const existing = await getCustomerById(customerId);
  if (!existing) {
    throw { code: 'NOT_FOUND', message: `Customer ${customerId} not found` };
  }

  const id = `cnote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO customer_notes (id, customer_id, note, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, customerId, noteText.trim(), creator.name, now]
  );

  // Also update latest notes snippet in customers table
  await db.query(`UPDATE customers SET notes = $1, updated_at = $2 WHERE id = $3`, [noteText.trim(), now, customerId]);

  await logActivity(
    creator.name,
    creator.role,
    'Customer Note Added',
    `Added follow-up note to ${existing.name}: "${noteText.trim().substring(0, 40)}..."`
  );

  return {
    id,
    customer_id: customerId,
    note: noteText.trim(),
    created_by: creator.name,
    created_at: now,
  };
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const res = await db.query(
    `SELECT id, customer_id, note, created_by, created_at::text as created_at
     FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customerId]
  );
  return res.rows;
}

// ================= PRODUCT & INVENTORY OPERATIONS =================

export async function getProducts(query: { search?: string; category?: string; lowStockOnly?: boolean } = {}): Promise<Product[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (query.search?.trim()) {
    const q = `%${query.search.trim().toLowerCase()}%`;
    conditions.push(
      `(LOWER(name) LIKE $${paramIdx} OR LOWER(sku) LIKE $${paramIdx} OR LOWER(COALESCE(category, '')) LIKE $${paramIdx} OR LOWER(COALESCE(location, '')) LIKE $${paramIdx})`
    );
    params.push(q);
    paramIdx++;
  }

  if (query.category && query.category !== 'All') {
    conditions.push(`category = $${paramIdx}`);
    params.push(query.category);
    paramIdx++;
  }

  if (query.lowStockOnly) {
    conditions.push(`current_stock <= min_stock`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await db.query(
    `SELECT id, name, sku, category, price::float as price,
            min_stock::int as min_stock, current_stock::int as current_stock,
            location, created_at::text as created_at
     FROM products ${whereClause}
     ORDER BY (current_stock <= min_stock) DESC, name ASC`,
    params
  );

  return res.rows;
}

export async function getProductById(id: string): Promise<Product | null> {
  const res = await db.query(
    `SELECT id, name, sku, category, price::float as price,
            min_stock::int as min_stock, current_stock::int as current_stock,
            location, created_at::text as created_at
     FROM products WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function createProduct(payload: Omit<Product, 'id' | 'created_at'>, creator: User): Promise<Product> {
  if (!payload.name?.trim()) {
    throw { code: 'VALIDATION_ERROR', message: 'Product title / name is required' };
  }
  if (!payload.sku?.trim()) {
    throw { code: 'VALIDATION_ERROR', message: 'SKU code is required' };
  }

  const sku = payload.sku.trim().toUpperCase();
  const existingRes = await db.query('SELECT id FROM products WHERE UPPER(sku) = $1', [sku]);
  if (existingRes.rows.length > 0) {
    throw { code: 'DUPLICATE_SKU', message: `Product with SKU '${sku}' already exists in catalog` };
  }

  const price = Math.max(0, Number(payload.price) || 0);
  const minStock = Math.max(0, Number(payload.min_stock) || 0);
  const currentStock = Math.max(0, Number(payload.current_stock) || 0);
  const id = `prod_${Date.now()}`;
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO products (id, name, sku, category, price, min_stock, current_stock, location, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [id, payload.name.trim(), sku, payload.category || 'General', price, minStock, currentStock, payload.location || 'Warehouse General', now]
  );

  if (currentStock > 0) {
    await db.query(
      `INSERT INTO stock_movements (id, product_id, product_name, product_sku, change_qty, type, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 'IN', 'Initial Warehouse Catalog Setup', $6, $7)`,
      [`mov_${Date.now()}`, id, payload.name.trim(), sku, currentStock, creator.name, now]
    );
  }

  await logActivity(
    creator.name,
    creator.role,
    'Product Created',
    `Created catalog item ${payload.name.trim()} (${sku}) with initial stock ${currentStock}`
  );

  const created = await getProductById(id);
  return created!;
}

export async function updateProduct(id: string, payload: Partial<Product>, updater: User): Promise<Product> {
  const existing = await getProductById(id);
  if (!existing) {
    throw { code: 'NOT_FOUND', message: `Product ${id} not found` };
  }

  const name = payload.name !== undefined ? payload.name.trim() : existing.name;
  const sku = payload.sku !== undefined ? payload.sku.trim().toUpperCase() : existing.sku;
  const category = payload.category !== undefined ? payload.category : existing.category;
  const price = payload.price !== undefined ? Math.max(0, Number(payload.price)) : existing.price;
  const minStock = payload.min_stock !== undefined ? Math.max(0, Number(payload.min_stock)) : existing.min_stock;
  const location = payload.location !== undefined ? payload.location.trim() : existing.location;
  const now = new Date().toISOString();

  // If SKU is changing, ensure uniqueness
  if (sku !== existing.sku) {
    const conflict = await db.query('SELECT id FROM products WHERE UPPER(sku) = $1 AND id != $2', [sku, id]);
    if (conflict.rows.length > 0) {
      throw { code: 'DUPLICATE_SKU', message: `SKU '${sku}' is already assigned to another product` };
    }
  }

  await db.query(
    `UPDATE products
     SET name = $1, sku = $2, category = $3, price = $4, min_stock = $5, location = $6, updated_at = $7
     WHERE id = $8`,
    [name, sku, category, price, minStock, location, now, id]
  );

  await logActivity(
    updater.name,
    updater.role,
    'Product Updated',
    `Updated catalog product ${sku} (${name})`
  );

  const updated = await getProductById(id);
  return updated!;
}

export async function deleteProduct(id: string, deleter: User): Promise<{ id: string; name: string }> {
  const existing = await getProductById(id);
  if (!existing) {
    throw { code: 'NOT_FOUND', message: `Product ${id} not found` };
  }

  // Check if product is referenced in challan_items or stock_movements
  const challanItemCount = await db.query('SELECT COUNT(*)::int as count FROM challan_items WHERE product_id = $1', [id]);
  if (Number(challanItemCount.rows[0]?.count || 0) > 0) {
    throw {
      code: 'INTEGRITY_CONSTRAINT',
      message: `Cannot delete product '${existing.name}'. Product is referenced in existing sales challans.`,
    };
  }

  // Delete movements or disallow if history exists
  await db.query('DELETE FROM stock_movements WHERE product_id = $1', [id]);
  await db.query('DELETE FROM products WHERE id = $1', [id]);

  await logActivity(
    deleter.name,
    deleter.role,
    'Product Deleted',
    `Deleted product ${existing.name} (${existing.sku})`
  );

  return { id: existing.id, name: existing.name };
}

// Manual stock IN or OUT adjustment (Warehouse / Admin)
export async function addInventoryMovement(
  productId: string,
  changeQty: number,
  type: 'IN' | 'OUT',
  reason: string,
  user: User
): Promise<{ movement: InventoryMovement; updatedProduct: Product }> {
  if (changeQty <= 0) {
    throw { code: 'VALIDATION_ERROR', message: 'Stock change quantity must be strictly greater than zero' };
  }

  return await db.transaction(async (tx) => {
    // Lock product row
    const prodRes = await tx.query(
      `SELECT id, name, sku, category, price::float as price,
              min_stock::int as min_stock, current_stock::int as current_stock,
              location, created_at::text as created_at
       FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );

    if (prodRes.rows.length === 0) {
      throw { code: 'NOT_FOUND', message: `Product ${productId} not found` };
    }

    const prod: Product = prodRes.rows[0];

    if (type === 'OUT' && prod.current_stock < changeQty) {
      throw {
        code: 'INSUFFICIENT_STOCK',
        message: `Stock reduction rejected! Current stock (${prod.current_stock}) is less than requested quantity (${changeQty}).`,
        details: { available: prod.current_stock, requested: changeQty },
      };
    }

    const newStock = type === 'IN' ? prod.current_stock + changeQty : prod.current_stock - changeQty;
    const now = new Date().toISOString();

    await tx.query(
      `UPDATE products SET current_stock = $1, updated_at = $2 WHERE id = $3`,
      [newStock, now, productId]
    );

    const movId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalReason = reason?.trim() || (type === 'IN' ? 'Warehouse Stock Inward' : 'Warehouse Stock Adjustment');

    await tx.query(
      `INSERT INTO stock_movements (id, product_id, product_name, product_sku, change_qty, type, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [movId, prod.id, prod.name, prod.sku, changeQty, type, finalReason, user.name, now]
    );

    await logActivity(
      user.name,
      user.role,
      `Stock ${type}`,
      `${type === 'IN' ? '+' : '-'}${changeQty} units of ${prod.sku}. Reason: ${finalReason}`
    );

    const updatedProd: Product = {
      ...prod,
      current_stock: newStock,
    };

    const movement: InventoryMovement = {
      id: movId,
      product_id: prod.id,
      product_name: prod.name,
      product_sku: prod.sku,
      change_qty: changeQty,
      type,
      reason: finalReason,
      created_by: user.name,
      timestamp: now,
    };

    return { movement, updatedProduct: updatedProd };
  });
}

export async function getInventoryMovements(query: { productId?: string; type?: string } = {}): Promise<InventoryMovement[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (query.productId) {
    conditions.push(`product_id = $${paramIdx}`);
    params.push(query.productId);
    paramIdx++;
  }

  if (query.type && query.type !== 'All') {
    conditions.push(`type = $${paramIdx}`);
    params.push(query.type);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await db.query(
    `SELECT id, product_id, product_name, product_sku, change_qty::int as change_qty,
            type, reason, created_by, created_at::text as timestamp
     FROM stock_movements ${whereClause}
     ORDER BY created_at DESC
     LIMIT 200`,
    params
  );

  return res.rows;
}

// ================= SALES CHALLAN OPERATIONS =================

export async function getChallans(query: { search?: string; status?: string } = {}): Promise<Challan[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (query.search?.trim()) {
    const q = `%${query.search.trim().toLowerCase()}%`;
    conditions.push(
      `(LOWER(challan_no) LIKE $${paramIdx} OR LOWER(customer_name) LIKE $${paramIdx} OR LOWER(COALESCE(notes, '')) LIKE $${paramIdx})`
    );
    params.push(q);
    paramIdx++;
  }

  if (query.status && query.status !== 'All') {
    conditions.push(`status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await db.query(
    `SELECT id, challan_no, customer_id, customer_name, customer_gst,
            total_qty::int as total_qty, total_amount::float as total_amount,
            status, created_by, created_at::text as created_at,
            confirmed_at::text as confirmed_at, confirmed_by, notes
     FROM sales_challans ${whereClause}
     ORDER BY created_at DESC`,
    params
  );

  const challans = res.rows as Challan[];

  // Attach items for each challan
  if (challans.length > 0) {
    const challanIds = challans.map((c) => c.id);
    const itemsRes = await db.query(
      `SELECT id, challan_id, product_id, product_snapshot_name, product_snapshot_sku,
              product_snapshot_price::float as product_snapshot_price,
              qty::int as qty, line_total::float as line_total
       FROM challan_items
       WHERE challan_id = ANY($1)
       ORDER BY id ASC`,
      [challanIds]
    );

    const itemsByChallan: Record<string, ChallanItem[]> = {};
    for (const item of itemsRes.rows) {
      if (!itemsByChallan[item.challan_id]) itemsByChallan[item.challan_id] = [];
      itemsByChallan[item.challan_id].push(item);
    }

    for (const ch of challans) {
      ch.items = itemsByChallan[ch.id] || [];
    }
  }

  return challans;
}

export async function getChallanById(id: string): Promise<Challan | null> {
  const res = await db.query(
    `SELECT id, challan_no, customer_id, customer_name, customer_gst,
            total_qty::int as total_qty, total_amount::float as total_amount,
            status, created_by, created_at::text as created_at,
            confirmed_at::text as confirmed_at, confirmed_by, notes
     FROM sales_challans WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  const challan: Challan = res.rows[0];

  const itemsRes = await db.query(
    `SELECT id, challan_id, product_id, product_snapshot_name, product_snapshot_sku,
            product_snapshot_price::float as product_snapshot_price,
            qty::int as qty, line_total::float as line_total
     FROM challan_items WHERE challan_id = $1 ORDER BY id ASC`,
    [id]
  );

  challan.items = itemsRes.rows;
  return challan;
}

export async function createChallan(
  payload: {
    customer_id: string;
    items: { product_id: string; qty: number }[];
    notes?: string;
    confirmImmediately?: boolean;
  },
  user: User
): Promise<Challan> {
  const customer = await getCustomerById(payload.customer_id);
  if (!customer) {
    throw { code: 'NOT_FOUND', message: `Customer ${payload.customer_id} not found` };
  }

  if (!payload.items || payload.items.length === 0) {
    throw { code: 'VALIDATION_ERROR', message: 'A sales challan must contain at least one product line item' };
  }

  const challanId = `ch_${Date.now()}`;

  // Next sequential challan number
  const countRes = await db.query('SELECT COUNT(*)::int as count FROM sales_challans');
  const count = Number(countRes.rows[0]?.count || 0) + 1;
  const challanNo = `CH-2026-${String(count).padStart(4, '0')}`;

  // Resolve items snapshot
  const resolvedItems: {
    id: string;
    product_id: string;
    name: string;
    sku: string;
    price: number;
    qty: number;
    line_total: number;
  }[] = [];

  let totalQty = 0;
  let totalAmount = 0;

  for (const item of payload.items) {
    const prod = await getProductById(item.product_id);
    if (!prod) {
      throw { code: 'NOT_FOUND', message: `Product ID ${item.product_id} not found in catalog` };
    }
    const qty = Number(item.qty);
    if (qty <= 0) {
      throw { code: 'VALIDATION_ERROR', message: `Quantity for '${prod.name}' must be greater than zero` };
    }

    const lineTotal = prod.price * qty;
    totalQty += qty;
    totalAmount += lineTotal;

    resolvedItems.push({
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      product_id: prod.id,
      name: prod.name,
      sku: prod.sku,
      price: prod.price,
      qty,
      line_total: lineTotal,
    });
  }

  const now = new Date().toISOString();

  // If user requests immediate confirmation: enforce atomic transaction & stock check
  if (payload.confirmImmediately) {
    await db.transaction(async (tx) => {
      // Aggregate quantities by product_id to prevent negative stock with duplicate product lines
      const aggregatedQtyByProductId = new Map<string, number>();
      for (const item of resolvedItems) {
        const current = aggregatedQtyByProductId.get(item.product_id) || 0;
        aggregatedQtyByProductId.set(item.product_id, current + item.qty);
      }

      // Lock products in sorted order to avoid deadlocks and verify stock
      const uniqueProductIds = Array.from(aggregatedQtyByProductId.keys()).sort();
      const stockErrors: { product: string; requested: number; available: number }[] = [];
      const productMap = new Map<string, any>();

      for (const prodId of uniqueProductIds) {
        const prodRes = await tx.query(
          `SELECT id, name, sku, current_stock::int as current_stock FROM products WHERE id = $1 FOR UPDATE`,
          [prodId]
        );
        if (prodRes.rows.length === 0) {
          stockErrors.push({ product: `Product ${prodId}`, requested: aggregatedQtyByProductId.get(prodId)!, available: 0 });
          continue;
        }
        const prod = prodRes.rows[0];
        productMap.set(prodId, prod);
        const currentStock = Number(prod.current_stock || 0);
        const requested = aggregatedQtyByProductId.get(prodId)!;
        if (currentStock < requested) {
          stockErrors.push({
            product: prod.name,
            requested,
            available: currentStock,
          });
        }
      }

      if (stockErrors.length > 0) {
        const detailsStr = stockErrors.map((e) => `${e.product}: available ${e.available}, requested ${e.requested}`).join('; ');
        throw {
          code: 'INSUFFICIENT_STOCK',
          message: `Stock check failed! Cannot confirm challan ${challanNo}. ${detailsStr}`,
          details: stockErrors,
        };
      }

      // Stock is sufficient: Insert Confirmed challan
      await tx.query(
        `INSERT INTO sales_challans (id, challan_no, customer_id, customer_name, customer_gst, total_qty, total_amount, status, created_by, created_at, confirmed_at, confirmed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Confirmed', $8, $9, $9, $8, $10)`,
        [
          challanId,
          challanNo,
          customer.id,
          customer.business_name || customer.name,
          customer.gst || null,
          totalQty,
          totalAmount,
          user.name,
          now,
          payload.notes?.trim() || null,
        ]
      );

      for (const item of resolvedItems) {
        await tx.query(
          `INSERT INTO challan_items (id, challan_id, product_id, product_snapshot_name, product_snapshot_sku, product_snapshot_price, qty, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [item.id, challanId, item.product_id, item.name, item.sku, item.price, item.qty, item.line_total]
        );
      }

      // Deduct aggregated inventory per product
      for (const prodId of uniqueProductIds) {
        const totalToDeduct = aggregatedQtyByProductId.get(prodId)!;
        await tx.query(
          `UPDATE products SET current_stock = current_stock - $1, updated_at = $2 WHERE id = $3`,
          [totalToDeduct, now, prodId]
        );
      }

      // Create OUT stock movements for each item line
      for (const item of resolvedItems) {
        const movId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await tx.query(
          `INSERT INTO stock_movements (id, product_id, product_name, product_sku, change_qty, type, reason, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 'OUT', $6, $7, $8)`,
          [movId, item.product_id, item.name, item.sku, item.qty, `Dispatched on Challan #${challanNo}`, user.name, now]
        );
      }
    });

    await logActivity(
      user.name,
      user.role,
      'Challan Confirmed & Dispatched',
      `Created and confirmed Challan ${challanNo} for ${customer.business_name || customer.name} (₹${totalAmount.toLocaleString('en-IN')})`
    );

    const created = await getChallanById(challanId);
    return created!;
  }

  // Creating a DRAFT challan: MUST NOT reduce stock!
  await db.query(
    `INSERT INTO sales_challans (id, challan_no, customer_id, customer_name, customer_gst, total_qty, total_amount, status, created_by, created_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', $8, $9, $10)`,
    [
      challanId,
      challanNo,
      customer.id,
      customer.business_name || customer.name,
      customer.gst || null,
      totalQty,
      totalAmount,
      user.name,
      now,
      payload.notes?.trim() || null,
    ]
  );

  for (const item of resolvedItems) {
    await db.query(
      `INSERT INTO challan_items (id, challan_id, product_id, product_snapshot_name, product_snapshot_sku, product_snapshot_price, qty, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [item.id, challanId, item.product_id, item.name, item.sku, item.price, item.qty, item.line_total]
    );
  }

  await logActivity(
    user.name,
    user.role,
    'Challan Created',
    `Created draft Challan ${challanNo} for ${customer.business_name || customer.name}`
  );

  const created = await getChallanById(challanId);
  return created!;
}

// CRITICAL BUSINESS RULE: Confirm Challan with row locking and atomic stock protection
export async function confirmChallan(challanId: string, user: User): Promise<Challan> {
  await db.transaction(async (tx) => {
    // 1. Row-lock the challan
    const challanRes = await tx.query(
      `SELECT id, challan_no, customer_id, customer_name, customer_gst,
              total_qty::int as total_qty, total_amount::float as total_amount,
              status, created_by, created_at::text as created_at, notes
       FROM sales_challans WHERE id = $1 FOR UPDATE`,
      [challanId]
    );

    if (challanRes.rows.length === 0) {
      throw { code: 'NOT_FOUND', message: `Challan ${challanId} not found` };
    }

    const challan = challanRes.rows[0];

    if (challan.status === 'Confirmed') {
      throw { code: 'ALREADY_CONFIRMED', message: `Challan ${challan.challan_no} has already been confirmed and dispatched` };
    }
    if (challan.status === 'Cancelled') {
      throw { code: 'CHALLAN_CANCELLED', message: `Challan ${challan.challan_no} has been cancelled and cannot be confirmed` };
    }

    // 2. Fetch all items for this challan
    const itemsRes = await tx.query(
      `SELECT id, challan_id, product_id, product_snapshot_name, product_snapshot_sku,
              product_snapshot_price::float as product_snapshot_price,
              qty::int as qty, line_total::float as line_total
       FROM challan_items WHERE challan_id = $1`,
      [challanId]
    );
    const items: ChallanItem[] = itemsRes.rows;

    if (items.length === 0) {
      throw { code: 'VALIDATION_ERROR', message: `Challan ${challan.challan_no} has no line items` };
    }

    // 3. Aggregate quantities by product_id to ensure safe stock verification even with duplicate product lines
    const aggregatedQtyByProductId = new Map<string, number>();
    for (const item of items) {
      const current = aggregatedQtyByProductId.get(item.product_id) || 0;
      aggregatedQtyByProductId.set(item.product_id, current + item.qty);
    }

    // Lock unique product rows in sorted order to prevent deadlocks
    const uniqueProductIds = Array.from(aggregatedQtyByProductId.keys()).sort();
    const stockErrors: { product: string; requested: number; available: number }[] = [];
    const productMap = new Map<string, Product>();

    for (const prodId of uniqueProductIds) {
      const prodRes = await tx.query(
        `SELECT id, name, sku, category, price::float as price,
                min_stock::int as min_stock, current_stock::int as current_stock,
                location, created_at::text as created_at
         FROM products WHERE id = $1 FOR UPDATE`,
        [prodId]
      );

      if (prodRes.rows.length === 0) {
        stockErrors.push({
          product: `Product ${prodId}`,
          requested: aggregatedQtyByProductId.get(prodId)!,
          available: 0,
        });
        continue;
      }

      const prod: Product = prodRes.rows[0];
      productMap.set(prodId, prod);
      const totalRequested = aggregatedQtyByProductId.get(prodId)!;
      if (prod.current_stock < totalRequested) {
        stockErrors.push({
          product: prod.name,
          requested: totalRequested,
          available: prod.current_stock,
        });
      }
    }

    // INSUFFICIENT STOCK: If any item does not have enough stock, REJECT confirmation
    // All changes rollback automatically due to transaction abort!
    if (stockErrors.length > 0) {
      const detailsStr = stockErrors
        .map((e) => `"${e.product}": available ${e.available}, requested ${e.requested}`)
        .join('; ');
      throw {
        code: 'INSUFFICIENT_STOCK',
        message: `Stock check failed! Cannot confirm challan ${challan.challan_no}. One or more items exceed warehouse inventory: ${detailsStr}`,
        details: stockErrors,
      };
    }

    // 4. Stock is sufficient: deduct aggregated stock per product and create OUT stock movements for each item line
    const now = new Date().toISOString();
    for (const prodId of uniqueProductIds) {
      const totalToDeduct = aggregatedQtyByProductId.get(prodId)!;
      await tx.query(
        `UPDATE products SET current_stock = current_stock - $1, updated_at = $2 WHERE id = $3`,
        [totalToDeduct, now, prodId]
      );
    }

    for (const item of items) {
      const prod = productMap.get(item.product_id);
      const prodName = prod ? prod.name : item.product_snapshot_name;
      const prodSku = prod ? prod.sku : item.product_snapshot_sku;
      const movId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await tx.query(
        `INSERT INTO stock_movements (id, product_id, product_name, product_sku, change_qty, type, reason, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, 'OUT', $6, $7, $8)`,
        [movId, item.product_id, prodName, prodSku, item.qty, `Dispatched on Challan #${challan.challan_no}`, user.name, now]
      );
    }

    // 5. Update challan status to Confirmed
    await tx.query(
      `UPDATE sales_challans SET status = 'Confirmed', confirmed_at = $1, confirmed_by = $2 WHERE id = $3`,
      [now, user.name, challanId]
    );
  });

  // 6. Log audit activity & return updated challan after commit
  await logActivity(
    user.name,
    user.role,
    'Challan Confirmed',
    `Confirmed & dispatched Challan ${challanId}`
  );

  const confirmed = await getChallanById(challanId);
  return confirmed!;
}

export async function cancelChallan(challanId: string, user: User): Promise<Challan> {
  let challanNo = '';
  await db.transaction(async (tx) => {
    const challanRes = await tx.query('SELECT * FROM sales_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (challanRes.rows.length === 0) {
      throw { code: 'NOT_FOUND', message: `Challan ${challanId} not found` };
    }
    const challan = challanRes.rows[0];
    challanNo = challan.challan_no;
    if (challan.status === 'Cancelled') {
      throw { code: 'ALREADY_CANCELLED', message: `Challan ${challan.challan_no} is already cancelled` };
    }

    // If it was Confirmed, restore stock
    if (challan.status === 'Confirmed') {
      const itemsRes = await tx.query('SELECT * FROM challan_items WHERE challan_id = $1', [challanId]);
      const now = new Date().toISOString();
      for (const item of itemsRes.rows) {
        await tx.query('UPDATE products SET current_stock = current_stock + $1 WHERE id = $2', [item.qty, item.product_id]);
        const movId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await tx.query(
          `INSERT INTO stock_movements (id, product_id, product_name, product_sku, change_qty, type, reason, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 'IN', $6, $7, $8)`,
          [movId, item.product_id, item.product_snapshot_name, item.product_snapshot_sku, item.qty, `Cancelled Challan #${challan.challan_no} stock reversal`, user.name, now]
        );
      }
    }

    await tx.query(`UPDATE sales_challans SET status = 'Cancelled' WHERE id = $1`, [challanId]);
  });

  // Log audit activity & return updated cancelled challan after commit
  await logActivity(
    user.name,
    user.role,
    'Challan Cancelled',
    `Cancelled Challan ${challanNo}`
  );

  const cancelled = await getChallanById(challanId);
  return cancelled!;
}

// ================= DASHBOARD & ACTIVITY AUDIT =================

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    custCountRes,
    activeCustRes,
    prodCountRes,
    lowStockRes,
    challanStatsRes,
    recentMovements,
    recentChallans,
    lowStockProducts,
  ] = await Promise.all([
    db.query('SELECT COUNT(*)::int as total FROM customers'),
    db.query("SELECT COUNT(*)::int as active FROM customers WHERE status = 'Active'"),
    db.query('SELECT COUNT(*)::int as total FROM products'),
    db.query('SELECT COUNT(*)::int as low FROM products WHERE current_stock <= min_stock'),
    db.query(`
      SELECT
        COUNT(*)::int as total_challans,
        COUNT(CASE WHEN status = 'Draft' THEN 1 END)::int as draft_challans,
        COUNT(CASE WHEN status = 'Confirmed' THEN 1 END)::int as confirmed_challans,
        COALESCE(SUM(CASE WHEN status = 'Confirmed' THEN total_amount ELSE 0 END), 0)::float as total_revenue
      FROM sales_challans
    `),
    getInventoryMovements({}),
    getChallans({}),
    getProducts({ lowStockOnly: true }),
  ]);

  const chStats = challanStatsRes.rows[0] || {};

  return {
    totalCustomers: Number(custCountRes.rows[0]?.total || 0),
    activeCustomers: Number(activeCustRes.rows[0]?.active || 0),
    totalProducts: Number(prodCountRes.rows[0]?.total || 0),
    lowStockCount: Number(lowStockRes.rows[0]?.low || 0),
    totalChallans: Number(chStats.total_challans || 0),
    draftChallans: Number(chStats.draft_challans || 0),
    confirmedChallans: Number(chStats.confirmed_challans || 0),
    totalRevenue: Number(chStats.total_revenue || 0),
    recentMovements: recentMovements.slice(0, 5),
    recentChallans: recentChallans.slice(0, 5),
    lowStockProducts: lowStockProducts.slice(0, 10),
  };
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const res = await db.query(
    `SELECT id, user_name, user_role, action, details, created_at::text as timestamp
     FROM activity_logs
     ORDER BY created_at DESC
     LIMIT 50`
  );
  return res.rows.map((r) => ({
    id: r.id,
    user_name: r.user_name,
    user_role: r.user_role as UserRole,
    action: r.action,
    details: r.details,
    timestamp: r.timestamp,
  }));
}

export async function logActivity(userName: string, userRole: UserRole, action: string, details: string) {
  try {
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.query(
      `INSERT INTO activity_logs (id, user_name, user_role, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, userName, userRole, action, details]
    );
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
