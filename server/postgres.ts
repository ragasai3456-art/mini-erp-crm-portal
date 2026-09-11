import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Ensure environment variables from .env are loaded before reading configuration
dotenv.config();

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query: <T = any>(sql: string, params?: any[]) => Promise<DbQueryResult<T>>;
}

let pool: Pool | null = null;
let isInitialized = false;

// Require external PostgreSQL connection via DATABASE_URL
export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  return dbUrl;
}

export function getDatabaseEngineType(): string {
  return 'external-postgres';
}

async function getPgClient(): Promise<{
  query: <T = any>(sql: string, params?: any[]) => Promise<DbQueryResult<T>>;
  transaction: <T = any>(callback: (client: DbClient) => Promise<T>) => Promise<T>;
}> {
  const dbUrl = getDatabaseUrl();
  if (!pool) {
    const isSsl = dbUrl.includes('sslmode=require') || dbUrl.includes('neon.tech') || dbUrl.includes('ssl=true');
    pool = new Pool({
      connectionString: dbUrl,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('PostgreSQL Pool error:', err);
    });
  }

  return {
    query: async <T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> => {
      const res = await pool!.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    },
    transaction: async <T = any>(callback: (client: DbClient) => Promise<T>): Promise<T> => {
      const client = await pool!.connect();
      try {
        await client.query('BEGIN');
        const clientAdapter: DbClient = {
          query: async <R = any>(sql: string, params: any[] = []): Promise<DbQueryResult<R>> => {
            const res = await client.query(sql, params);
            return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
          },
        };
        const result = await callback(clientAdapter);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export const db = {
  async query<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
    const engine = await getPgClient();
    return engine.query<T>(sql, params);
  },
  async transaction<T = any>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    const engine = await getPgClient();
    return engine.transaction<T>(callback);
  },
};

// Database schema migration and initial test user seeding
export async function initPostgresDatabase() {
  if (isInitialized) return;

  console.log(`[Database] Initializing PostgreSQL database (${getDatabaseEngineType()})...`);
  const schemaPath = path.join(process.cwd(), 'server', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Strip line comments and split on semicolons
  const cleanSql = schemaSql
    .split('\n')
    .map((line) => {
      const commentIdx = line.indexOf('--');
      return commentIdx >= 0 ? line.substring(0, commentIdx) : line;
    })
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (err: any) {
      console.warn(`[Database] Schema statement notice:`, err.message);
    }
  }

  // Seed default test users if users table is empty
  const userCountRes = await db.query('SELECT COUNT(*)::int as count FROM users');
  const userCount = Number(userCountRes.rows[0]?.count || 0);

  if (userCount === 0) {
    console.log('[Database] Seeding test users with bcrypt hashed passwords...');
    const seedUsers = [
      {
        id: 'usr_admin',
        name: 'Sarah Connor',
        email: 'admin@portal.com',
        plainPass: 'Admin@123',
        role: 'Admin',
      },
      {
        id: 'usr_sales',
        name: 'Alex Mercer',
        email: 'sales@portal.com',
        plainPass: 'Sales@123',
        role: 'Sales',
      },
      {
        id: 'usr_warehouse',
        name: 'Marcus Vance',
        email: 'warehouse@portal.com',
        plainPass: 'Warehouse@123',
        role: 'Warehouse',
      },
      {
        id: 'usr_accounts',
        name: 'Elena Rostova',
        email: 'accounts@portal.com',
        plainPass: 'Accounts@123',
        role: 'Accounts',
      },
    ];

    for (const u of seedUsers) {
      const hash = bcrypt.hashSync(u.plainPass, 10);
      await db.query(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
        [u.id, u.name, u.email, hash, u.role]
      );
    }
    console.log('[Database] Seeded 4 authenticated test users.');

    // Seed default customers if empty
    const custCountRes = await db.query('SELECT COUNT(*)::int as count FROM customers');
    if (Number(custCountRes.rows[0]?.count || 0) === 0) {
      console.log('[Database] Seeding initial customers...');
      const initialCustomers = [
        {
          id: 'cust_1',
          name: 'Rajesh Sharma',
          business_name: 'Apex Industrial Supplies Ltd',
          mobile: '+91 98201 44521',
          email: 'rajesh@apexsupplies.com',
          gst: '27AABCA1234F1Z5',
          type: 'Wholesaler',
          address: 'Plot 42, MIDC Industrial Area, Andheri East, Mumbai 400093',
          status: 'Active',
          follow_up_date: '2026-09-18',
          notes: 'Key distributor for electrical components. Bulk discount tier A applied.',
        },
        {
          id: 'cust_2',
          name: 'Priya Sundaram',
          business_name: 'TechMatrix Solutions',
          mobile: '+91 97110 88234',
          email: 'priya@techmatrix.io',
          gst: '29BBBCB5678G2Z1',
          type: 'Distributor',
          address: 'Tech Park Blvd, 3rd Floor, Whitefield, Bengaluru 560066',
          status: 'Active',
          follow_up_date: '2026-09-14',
          notes: 'Interested in quarterly supply contracts for automation sensors.',
        },
        {
          id: 'cust_3',
          name: 'Vikram Mehta',
          business_name: 'Mehta Hardware & Retailers',
          mobile: '+91 94220 33119',
          email: 'vikram@mehtahardware.in',
          gst: '24CCCDC9012H3Z7',
          type: 'Retailer',
          address: 'Shop 12, Gandhi Market, Navrangpura, Ahmedabad 380009',
          status: 'Prospect',
          follow_up_date: '2026-09-12',
          notes: 'Requested product catalog and quote for industrial power tools.',
        },
        {
          id: 'cust_4',
          name: 'Anita Roy',
          business_name: 'Eastern Precision Works',
          mobile: '+91 98305 67890',
          email: 'anita@easternprec.com',
          gst: '19DDDDE3456J4Z2',
          type: 'Direct',
          address: 'Sector V, Salt Lake City, Kolkata 700091',
          status: 'Lead',
          follow_up_date: '2026-09-22',
          notes: 'Met at national manufacturing expo. Looking for hydraulic fittings.',
        },
        {
          id: 'cust_5',
          name: 'Sunil Nair',
          business_name: 'Cochin Maritime Logistics',
          mobile: '+91 98470 12345',
          email: 's.nair@cochinlog.org',
          gst: '32EEEEF7890K5Z8',
          type: 'Direct',
          address: 'Harbor Road, Willingdon Island, Kochi 682003',
          status: 'Inactive',
          follow_up_date: '2026-09-30',
          notes: 'Account paused pending annual maintenance review.',
        },
      ];

      for (const c of initialCustomers) {
        await db.query(
          `INSERT INTO customers (id, name, business_name, mobile, email, gst, type, address, status, follow_up_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [c.id, c.name, c.business_name, c.mobile, c.email, c.gst, c.type, c.address, c.status, c.follow_up_date, c.notes]
        );
        // Add initial note in customer_notes table
        await db.query(
          `INSERT INTO customer_notes (id, customer_id, note, created_by) VALUES ($1, $2, $3, $4)`,
          [`cnote_${c.id}_1`, c.id, c.notes, 'System Initialization']
        );
      }
    }

    // Seed default products if empty
    const prodCountRes = await db.query('SELECT COUNT(*)::int as count FROM products');
    if (Number(prodCountRes.rows[0]?.count || 0) === 0) {
      console.log('[Database] Seeding initial products & stock...');
      const initialProducts = [
        {
          id: 'prod_1',
          name: 'Industrial Servo Drive 750W',
          sku: 'DRV-750-AC',
          category: 'Motion Control',
          price: 34500,
          min_stock: 10,
          current_stock: 35,
          location: 'Bay A-03, Rack 2',
        },
        {
          id: 'prod_2',
          name: 'High-Precision Pressure Transducer',
          sku: 'SNS-PRS-010',
          category: 'Sensors',
          price: 8900,
          min_stock: 15,
          current_stock: 8, // Low stock indicator!
          location: 'Bay B-11, Rack 1',
        },
        {
          id: 'prod_3',
          name: 'Programmable Logic Controller (PLC-32)',
          sku: 'PLC-MOD-032',
          category: 'Automation',
          price: 62000,
          min_stock: 5,
          current_stock: 18,
          location: 'Bay A-01, Secure Cabinet',
        },
        {
          id: 'prod_4',
          name: 'Optical Laser Distance Sensor 50m',
          sku: 'SNS-LSR-050',
          category: 'Sensors',
          price: 14200,
          min_stock: 12,
          current_stock: 22,
          location: 'Bay B-04, Drawer 3',
        },
        {
          id: 'prod_5',
          name: '3-Phase Heavy Duty Contactor 65A',
          sku: 'SWT-CNT-065',
          category: 'Switchgear',
          price: 3850,
          min_stock: 25,
          current_stock: 45,
          location: 'Bay C-02, Rack 5',
        },
        {
          id: 'prod_6',
          name: 'PID Digital Temperature Controller',
          sku: 'CTL-PID-200',
          category: 'Automation',
          price: 5400,
          min_stock: 20,
          current_stock: 6, // Low stock indicator!
          location: 'Bay A-08, Rack 1',
        },
      ];

      for (const p of initialProducts) {
        await db.query(
          `INSERT INTO products (id, name, sku, category, price, min_stock, current_stock, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [p.id, p.name, p.sku, p.category, p.price, p.min_stock, p.current_stock, p.location]
        );
        // Initial inward movement record
        await db.query(
          `INSERT INTO stock_movements (id, product_id, product_name, product_sku, change_qty, type, reason, created_by)
           VALUES ($1, $2, $3, $4, $5, 'IN', 'Initial Warehouse Catalog Setup', 'System Admin')`,
          [`mov_init_${p.id}`, p.id, p.name, p.sku, p.current_stock]
        );
      }
    }

    // Seed initial sales challans if empty
    const challanCountRes = await db.query('SELECT COUNT(*)::int as count FROM sales_challans');
    if (Number(challanCountRes.rows[0]?.count || 0) === 0) {
      console.log('[Database] Seeding initial sales challans...');
      // Challan 1 (Confirmed)
      await db.query(
        `INSERT INTO sales_challans (id, challan_no, customer_id, customer_name, customer_gst, total_qty, total_amount, status, created_by, confirmed_at, confirmed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          'ch_1',
          'CH-2026-0001',
          'cust_1',
          'Apex Industrial Supplies Ltd',
          '27AABCA1234F1Z5',
          7,
          296500,
          'Confirmed',
          'Alex Mercer',
          '2026-09-02T16:00:00Z',
          'Marcus Vance',
          'Urgent factory line expansion requirement. Dispatched via Express Logistics.',
        ]
      );
      await db.query(
        `INSERT INTO challan_items (id, challan_id, product_id, product_snapshot_name, product_snapshot_sku, product_snapshot_price, qty, line_total)
         VALUES
         ('item_1', 'ch_1', 'prod_1', 'Industrial Servo Drive 750W', 'DRV-750-AC', 34500, 5, 172500),
         ('item_2', 'ch_1', 'prod_3', 'Programmable Logic Controller (PLC-32)', 'PLC-MOD-032', 62000, 2, 124000)`
      );

      // Challan 2 (Draft)
      await db.query(
        `INSERT INTO sales_challans (id, challan_no, customer_id, customer_name, customer_gst, total_qty, total_amount, status, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'ch_2',
          'CH-2026-0002',
          'cust_3',
          'Mehta Hardware & Retailers',
          '24CCCDC9012H3Z7',
          10,
          38500,
          'Draft',
          'Alex Mercer',
          'Draft awaiting final credit term approval from Accounts.',
        ]
      );
      await db.query(
        `INSERT INTO challan_items (id, challan_id, product_id, product_snapshot_name, product_snapshot_sku, product_snapshot_price, qty, line_total)
         VALUES ('item_3', 'ch_2', 'prod_5', '3-Phase Heavy Duty Contactor 65A', 'SWT-CNT-065', 3850, 10, 38500)`
      );
    }

    // Seed initial activity logs
    await db.query(
      `INSERT INTO activity_logs (id, user_name, user_role, action, details)
       VALUES
       ('act_1', 'Sarah Connor', 'Admin', 'Database Initialized', 'PostgreSQL database configured with 4 roles and security rules.'),
       ('act_2', 'Alex Mercer', 'Sales', 'Challan Created', 'Created draft Challan CH-2026-0001 for Apex Industrial Supplies Ltd.'),
       ('act_3', 'Marcus Vance', 'Warehouse', 'Challan Confirmed', 'Verified stock and confirmed dispatch for Challan CH-2026-0001.')`
    );
  }

  isInitialized = true;
  console.log('[Database] PostgreSQL database initialization complete.');
}
