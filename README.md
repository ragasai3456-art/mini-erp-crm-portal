# Mini ERP + CRM Operations Portal

A full-stack, enterprise-grade Operations Portal integrating Customer Relationship Management (CRM), Inventory Catalog with Stock Movements, and Sales Challan Workflows with strict PostgreSQL ACID transaction protection and Role-Based Access Control (RBAC).

---

## 1. Project Overview

The Mini ERP + CRM Operations Portal provides a unified operations dashboard for businesses handling customer orders, warehouse dispatching, and inventory management. Designed for decoupled deployments where the Express.js backend and React frontend can run as independent services (e.g., Express backend on Render/Cloud Run and React frontend on Vercel/Netlify) or unified on a single host.

---

## 2. Main Features

- **Customer CRM**: Complete customer lifecycle management (Leads, Prospects, Active, Inactive), customer type tagging, GST compliance, and timestamped follow-up notes.
- **Inventory & Product Catalog**: SKU tracking, category organization, minimum stock reorder alerts, location management, and unit pricing.
- **Atomic Sales Challans**:
  - **Draft Challans**: Save quotation orders without reserving or deducting physical warehouse stock.
  - **Confirmed Challans**: Atomically lock challan and product rows inside a PostgreSQL transaction, validate aggregated stock availability across all line items (including duplicate product lines), deduct inventory, log `OUT` stock movements, and transition status to `Confirmed`.
  - **Challan Cancellation**: Cancel orders with automated inventory restoration and audit logging.
- **Stock Movements & Audit Trails**: Real-time logging of all inventory changes (`IN` / `OUT`) with reference tracking to Challans or manual adjustments.
- **Interactive KPI Dashboard**: Real-time metrics for total revenue, active customers, dispatched challans, low-stock inventory counts, and recent activity logs.
- **Interactive API Documentation**: OpenAPI 3.0 specification available in-app for authorized administrators.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js, Express 4, TypeScript (`tsx` in dev, `esbuild` bundled CommonJS for production).
- **Database**: PostgreSQL (v14+) with strict foreign keys, atomic transactions, and row-level locks (`FOR UPDATE`). Fully compatible with Neon serverless PostgreSQL, AWS RDS, Supabase, and local PostgreSQL.
- **Security & Auth**: JSON Web Tokens (JWT), bcrypt salted password hashing, CORS protection, role-based authorization middlewares.
- **API Spec**: OpenAPI 3.0.0.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React 19 Frontend                      │
│   (Vite, TypeScript, Tailwind, Configurable VITE_API_URL)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON (Bearer JWT)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express.js Backend                      │
│     (CORS Protection, JWT Verification, RBAC Middleware)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ pg Pool / Transactions
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL Database (Neon)                  │
│       (Row-Level Locks, Foreign Keys, Schema Tables)        │
└─────────────────────────────────────────────────────────────┘
```

The frontend uses `import.meta.env.VITE_API_URL` to route requests to the backend. In monolithic mode or reverse-proxy setups, it gracefully falls back to relative paths (`/api/...`). The backend uses the `cors` package configured via `FRONTEND_URL` to prevent unauthorized cross-origin requests.

---

## 5. Authentication

- **Stateless Bearer JWT**: Authenticated sessions are established via `POST /api/auth/login`. Successful verification issues a signed JWT token valid for 24 hours.
- **Secure Password Hashing**: Passwords stored in PostgreSQL are hashed with bcrypt using 10 salt rounds.
- **Database-Authoritative User Sessions**: `GET /api/auth/me` validates the token and pulls the active user profile and role directly from the PostgreSQL database, preventing client-side role tampering.
- **No Role Switching**: The user's role is strictly tied to the authenticated user account and cannot be modified from the frontend or requested via API.

---

## 6. Role-Based Access Control (RBAC)

The application enforces strict authorization on both the backend API and the frontend UI:
- **Backend Enforcement**: Route-level middleware (`authenticateToken` and `authorizeRoles`) rejects unauthorized requests with HTTP 401 (Unauthorized) or HTTP 403 (Forbidden).
- **Frontend Enforcement**: Navigation items and action buttons are filtered based on the user's role. Direct URL navigation to forbidden routes displays an Access Denied view.

---

## 7. Role Matrix: Admin, Sales, Warehouse, Accounts

| Module / Operation | Admin | Sales | Warehouse | Accounts |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | Full Access | Full Access | Full Access | Full Access |
| **Customers CRM (View)** | ✓ | ✓ | ✗ *(Forbidden)* | ✓ *(View-Only)* |
| **Customers CRM (Create/Edit)** | ✓ | ✓ | ✗ | ✗ |
| **Customers CRM (Delete)** | ✓ | ✗ | ✗ | ✗ |
| **Customer Notes** | ✓ | ✓ | ✗ | ✗ |
| **Inventory / Products (View)** | ✓ | ✓ *(View-Only)* | ✓ | ✗ *(Forbidden)* |
| **Inventory / Products (Create/Edit)** | ✓ | ✗ | ✓ | ✗ |
| **Inventory / Products (Delete)** | ✓ | ✗ | ✗ | ✗ |
| **Manual Stock Adjustments (IN)** | ✓ | ✗ | ✓ | ✗ |
| **Stock Movements History** | ✓ | ✓ *(Audit View)* | ✓ | ✓ *(Audit View)* |
| **Sales Challans (View)** | ✓ | ✓ | ✓ *(View-Only)* | ✓ *(View-Only)* |
| **Sales Challans (Create/Draft)** | ✓ | ✓ | ✗ | ✗ |
| **Sales Challans (Confirm/Dispatch)**| ✓ | ✓ | ✗ | ✗ |
| **Sales Challans (Cancel)** | ✓ | ✗ | ✗ | ✓ |
| **Audit Activity Logs** | ✓ | ✗ | ✗ | ✗ |
| **OpenAPI Specification** | ✓ | ✗ | ✗ | ✗ |

---

## 8. PostgreSQL Database

PostgreSQL is **strictly required**. The application connects directly to external PostgreSQL instances with full ACID compliance. If `DATABASE_URL` is missing or the database connection cannot be established, the server fails fast with a clear diagnostic message during startup.

### Relational Schema Tables:
1. `users`: User identity, email, bcrypt password hash, and assigned role.
2. `customers`: Customer business profiles, contact information, GST numbers, customer type, and follow-up schedules.
3. `customer_notes`: Chronological audit of sales interactions linked to customers.
4. `products`: Inventory catalog items with SKU, unit price, minimum stock thresholds, and current stock.
5. `sales_challans`: Delivery challans with customer details, status (`Draft`, `Confirmed`, `Cancelled`), total quantity, and amount.
6. `challan_items`: Product snapshot lines attached to challans.
7. `stock_movements`: Stock transaction ledger (`IN` / `OUT`) with reason and author.
8. `activity_logs`: Immutable operations audit trail.

---

## 9. Neon PostgreSQL Usage

This project is optimized for [Neon Serverless PostgreSQL](https://neon.tech):
1. Create a project in the Neon console.
2. Copy the pooled connection string.
3. Append `?sslmode=require` to ensure encrypted SSL communication:
   ```env
   DATABASE_URL=postgresql://neondb_owner:your_password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. The server automatically creates all tables, constraints, indexes, and initial seed records on first launch.

---

## 10. Environment Variables

Configure environment variables in `.env` (copy from `.env.example`):

```env
# Backend listening port
PORT=3000

# Runtime environment
NODE_ENV=development

# PostgreSQL Connection String (Strictly Required)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name?sslmode=require

# Secret for signing JWT tokens (Strictly Required)
JWT_SECRET=your_secure_jwt_secret_here

# Allowed CORS Origin for separately deployed frontend
FRONTEND_URL=http://localhost:5173

# Frontend API URL pointing to the Express backend
VITE_API_URL=http://localhost:3000
```

> **Security Note**: Never commit `.env` or files containing real secrets, passwords, or tokens to version control.

---

## 11. Local Setup

### Prerequisites
- Node.js 18+ or 20+
- A running PostgreSQL database (Neon or local)

### Clone & Install
```bash
git clone <your-repository-url>
cd operations-portal
npm install
```

---

## 12. Database Schema & Seed Instructions

The application executes auto-migration and idempotent seeding on startup:
1. The schema defined in `server/schema.sql` is executed if tables are missing.
2. Default role accounts are created with bcrypt-hashed passwords.
3. Initial demo products, customers, and stock logs are seeded if the tables are empty.

---

## 13. Running the Project

### Unified Development Mode (Single Port)
Runs Express and Vite concurrently on port 3000:
```bash
npm run dev
```

### Production Build & Execution
```bash
# Builds the Vite frontend to /dist and bundles the backend server into /dist/server.cjs
npm run build

# Starts the production server
npm start
```

---

## 14. API Documentation

Interactive OpenAPI 3.0 documentation is available:
- **In-App**: Click the **OpenAPI Spec** tab in the sidebar (Admin only) to browse endpoints and execute live requests.
- **Raw JSON**: Accessible at `GET /api/openapi.json` with an Admin Bearer token.

### Core Endpoints:
- `POST /api/auth/login` — Authenticate user and receive JWT.
- `GET /api/auth/me` — Return currently authenticated user profile.
- `GET /api/customers` — List customers (supports `?search=` filter).
- `POST /api/customers` — Create a new customer.
- `GET /api/products` — List product catalog (supports `?category=&search=`).
- `POST /api/products` — Create a product.
- `GET /api/stock-movements` — Retrieve inventory ledger (`IN` / `OUT`).
- `POST /api/stock-movements` — Record manual stock adjustment (`IN` / `OUT`).
- `GET /api/challans` — List sales challans.
- `POST /api/challans` — Create draft challan or confirm immediately.
- `POST /api/challans/:id/confirm` — Confirm and dispatch challan (with atomic stock deduction).
- `POST /api/challans/:id/cancel` — Cancel challan (with automated stock reversal).
- `GET /api/dashboard/stats` — Retrieve high-level KPI dashboard metrics.

---

## 15. Testing Instructions

### Lint & Type Checks
```bash
npm run lint
```

### Build Verification
```bash
npm run build
```

### Health Check
```bash
curl http://localhost:3000/api/health
```
Response:
```json
{
  "status": "healthy",
  "databaseEngine": "external-postgres",
  "timestamp": "2026-09-11T05:00:00.000Z"
}
```

---

## 16. Deployment Instructions

### Option A: Separately Deployed Frontend and Backend (Recommended)

1. **Deploy Backend (e.g., Render, Railway, Cloud Run)**:
   - Set Environment Variables:
     - `PORT=3000` (or host-assigned port)
     - `NODE_ENV=production`
     - `DATABASE_URL=your_neon_postgres_url`
     - `JWT_SECRET=your_production_jwt_secret`
     - `FRONTEND_URL=https://your-frontend-domain.vercel.app`
   - Build Command: `npm run build`
   - Start Command: `npm start`

2. **Deploy Frontend (e.g., Vercel, Netlify)**:
   - Set Environment Variable:
     - `VITE_API_URL=https://your-backend-domain.onrender.com`
   - Build Command: `vite build`
   - Output Directory: `dist`

### Option B: Monolithic Deployment (Single Host)
Deploy to any Node.js container or PaaS. Set `DATABASE_URL` and `JWT_SECRET`. The bundled Express server will serve the static Vite frontend from `/dist` and handle all `/api` requests on the same port.

---

## 17. Demo Credentials (Placeholders)

| Role | Email | Password Placeholder | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@portal.com` | `Admin@123` | Full administrative, audit, and configuration access |
| **Sales** | `sales@portal.com` | `Sales@123` | Customer CRM and Sales Challan creation |
| **Warehouse** | `warehouse@portal.com` | `Warehouse@123` | Inventory, manual stock adjustments, and challan dispatch |
| **Accounts** | `accounts@portal.com` | `Accounts@123` | Financial records, customer view, and challan cancellation |

*(Change default passwords immediately upon production deployment).*

---

## 18. Known Limitations

- **Single Warehouse**: Inventory tracking currently assumes a unified physical location per product.
- **Manual Challan Invoicing**: Invoice generation renders a printable PDF/view modal from challan data; full accounting ledger synchronization should be integrated for statutory compliance.
- **Static Tax Slabs**: Standard GST rates are calculated per line item snapshot; advanced multi-tier state-wise IGST/CGST rules require external tax engine integration.
