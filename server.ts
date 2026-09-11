import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';

import {
  initPostgresDatabase,
  getDatabaseEngineType,
} from './server/postgres';

import {
  findUserByEmail,
  findUserById,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerNote,
  getCustomerNotes,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getInventoryMovements,
  addInventoryMovement,
  getChallans,
  getChallanById,
  createChallan,
  confirmChallan,
  cancelChallan,
  getDashboardStats,
  getActivityLogs,
} from './server/db';

import { openApiSpec } from './server/openapi';
import { User, UserRole } from './src/types';

dotenv.config({ override: true });

// =========================================================
// ENVIRONMENT VARIABLES
// =========================================================

// Enforce required DATABASE_URL; fail startup with clear error if missing
const DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

// Enforce required JWT_SECRET without fallback; fail startup with clear error if missing
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    'FATAL ERROR: JWT_SECRET environment variable is required but missing. Startup aborted.'
  );
  process.exit(1);
}

// =========================================================
// APP CONFIGURATION
// =========================================================

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// =========================================================
// CORS CONFIGURATION
// =========================================================

const frontendUrlEnv = process.env.FRONTEND_URL?.trim();

/*
 * Production frontend URL is included as a safe default.
 *
 * If FRONTEND_URL is configured in Render, those configured
 * origins are used.
 *
 * If FRONTEND_URL is unavailable, the deployed Vercel frontend
 * below is still allowed.
 */
const configuredOrigins = frontendUrlEnv
  ? frontendUrlEnv
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  : [];

const productionAllowedOrigins = [
  'https://mini-erp-crm-portal-nu.vercel.app',
];

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin
      // e.g. mobile apps, curl, server-side requests, or same-origin requests
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/+$/, '');

      // ---------------------------------------------------------
      // 1. Explicitly configured FRONTEND_URL origins
      // ---------------------------------------------------------
      if (configuredOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      // ---------------------------------------------------------
      // 2. Local development and preview environments
      // ---------------------------------------------------------
      const isDev = process.env.NODE_ENV !== 'production';

      if (isDev) {
        if (
          defaultAllowedOrigins.includes(cleanOrigin) ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
            cleanOrigin
          ) ||
          cleanOrigin.endsWith('.run.app')
        ) {
          return callback(null, true);
        }
      }

      // ---------------------------------------------------------
      // 3. Always allow the deployed production frontend
      // ---------------------------------------------------------
      //
      // This check is intentionally independent of FRONTEND_URL.
      // If Render has an old/local FRONTEND_URL configured, the
      // Vercel frontend must still be able to call the API.
      //
      if (productionAllowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      // ---------------------------------------------------------
      // 4. Production fallback
      // ---------------------------------------------------------
      //
      // Allow other Vercel/Render preview deployments only when
      // FRONTEND_URL has not been configured explicitly.
      //
      if (
        configuredOrigins.length === 0 &&
        (
          defaultAllowedOrigins.includes(cleanOrigin) ||
          cleanOrigin.endsWith('.run.app') ||
          cleanOrigin.endsWith('.vercel.app')
        )
      ) {
        return callback(null, true);
      }

      // ---------------------------------------------------------
      // 5. Reject unauthorized origins
      // ---------------------------------------------------------
      return callback(null, false);
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
  })
);

app.use(express.json());

// =========================================================
// UNIFORM API ERROR RESPONSE
// =========================================================

function sendApiError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any
) {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  return res.status(statusCode).json({
    status: 'error',
    statusCode,
    error: {
      code,
      message,
      details,
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

// =========================================================
// AUTHENTICATION
// =========================================================

interface AuthenticatedRequest extends Request {
  user?: User;
}

async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return sendApiError(
      res,
      401,
      'UNAUTHORIZED',
      'Authentication token required'
    );
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await findUserById(decoded.id);

    if (!user) {
      return sendApiError(
        res,
        401,
        'INVALID_TOKEN',
        'User session is invalid or user no longer exists'
      );
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err: any) {
    return sendApiError(
      res,
      401,
      'TOKEN_EXPIRED',
      'Token verification failed or session expired'
    );
  }
}

// =========================================================
// ROLE-BASED ACCESS CONTROL
// =========================================================

function authorizeRoles(...allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return sendApiError(
        res,
        401,
        'UNAUTHORIZED',
        'Authentication required'
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendApiError(
        res,
        403,
        'FORBIDDEN',
        `Role '${req.user.role}' is not authorized to perform this operation. Required: ${allowedRoles.join(
          ', '
        )}`
      );
    }

    next();
  };
}

// =========================================================
// API ROUTES
// =========================================================

// ---------------------------------------------------------
// Health check
// ---------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    databaseEngine: getDatabaseEngineType(),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------
// OpenAPI Spec - Admin only
// ---------------------------------------------------------

app.get(
  '/api/openapi.json',
  authenticateToken,
  authorizeRoles('Admin'),
  (req, res) => {
    res.json(openApiSpec);
  }
);

// =========================================================
// AUTHENTICATION ROUTES
// =========================================================

// ---------------------------------------------------------
// Login
// ---------------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendApiError(
        res,
        400,
        'VALIDATION_ERROR',
        'Email and password are required'
      );
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return sendApiError(
        res,
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password'
      );
    }

    const isMatch = bcrypt.compareSync(
      password,
      user.passwordHash
    );

    if (!isMatch) {
      return sendApiError(
        res,
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password'
      );
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: '24h',
      }
    );

    res.json({
      status: 'success',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    sendApiError(
      res,
      500,
      'SERVER_ERROR',
      err.message || 'Login failed'
    );
  }
});

// ---------------------------------------------------------
// Current authenticated user
// ---------------------------------------------------------

app.get(
  '/api/auth/me',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        user: req.user,
      });
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// =========================================================
// CUSTOMER CRM ROUTES
// =========================================================

// ---------------------------------------------------------
// List customers
// Admin, Sales, Accounts
// Warehouse denied
// ---------------------------------------------------------

app.get(
  '/api/customers',
  authenticateToken,
  authorizeRoles('Admin', 'Sales', 'Accounts'),
  async (req, res) => {
    try {
      const {
        search,
        status,
        page,
        limit,
      } = req.query;

      const result = await getCustomers({
        search: search as string,
        status: status as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.json(result);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message || 'Failed to fetch customers'
      );
    }
  }
);

// ---------------------------------------------------------
// Customer details
// ---------------------------------------------------------

app.get(
  '/api/customers/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Sales', 'Accounts'),
  async (req, res) => {
    try {
      const customer = await getCustomerById(
        req.params.id
      );

      if (!customer) {
        return sendApiError(
          res,
          404,
          'NOT_FOUND',
          `Customer ${req.params.id} not found`
        );
      }

      res.json(customer);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Create customer
// Admin, Sales
// ---------------------------------------------------------

app.post(
  '/api/customers',
  authenticateToken,
  authorizeRoles('Admin', 'Sales'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const customer = await createCustomer(
        req.body,
        req.user!
      );

      res.status(201).json(customer);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'VALIDATION_ERROR',
        err.message,
        err.details
      );
    }
  }
);

// ---------------------------------------------------------
// Update customer
// Admin, Sales
// ---------------------------------------------------------

app.put(
  '/api/customers/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Sales'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const updated = await updateCustomer(
        req.params.id,
        req.body,
        req.user!
      );

      res.json(updated);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'UPDATE_ERROR',
        err.message,
        err.details
      );
    }
  }
);

// ---------------------------------------------------------
// Delete customer
// Admin only
// ---------------------------------------------------------

app.delete(
  '/api/customers/:id',
  authenticateToken,
  authorizeRoles('Admin'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const deleted = await deleteCustomer(
        req.params.id,
        req.user!
      );

      res.json({
        message: 'Customer deleted successfully',
        customer: deleted,
      });
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'DELETE_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Customer follow-up notes
// GET: Admin, Sales, Accounts
// POST: Admin, Sales
// ---------------------------------------------------------

app.get(
  '/api/customers/:id/notes',
  authenticateToken,
  authorizeRoles('Admin', 'Sales', 'Accounts'),
  async (req, res) => {
    try {
      const notes = await getCustomerNotes(
        req.params.id
      );

      res.json(notes);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

app.post(
  '/api/customers/:id/notes',
  authenticateToken,
  authorizeRoles('Admin', 'Sales'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const { note } = req.body;

      if (!note || !note.trim()) {
        return sendApiError(
          res,
          400,
          'VALIDATION_ERROR',
          'Note content is required'
        );
      }

      const savedNote = await addCustomerNote(
        req.params.id,
        note,
        req.user!
      );

      res.status(201).json(savedNote);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'NOTE_ERROR',
        err.message
      );
    }
  }
);

// =========================================================
// PRODUCT & INVENTORY ROUTES
// =========================================================

// ---------------------------------------------------------
// List products
// Admin, Sales, Warehouse
// Accounts denied
// ---------------------------------------------------------

app.get(
  '/api/products',
  authenticateToken,
  authorizeRoles('Admin', 'Sales', 'Warehouse'),
  async (req, res) => {
    try {
      const {
        search,
        category,
        lowStockOnly,
      } = req.query;

      const prods = await getProducts({
        search: search as string,
        category: category as string,
        lowStockOnly:
          lowStockOnly === 'true',
      });

      res.json(prods);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Product details
// ---------------------------------------------------------

app.get(
  '/api/products/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Sales', 'Warehouse'),
  async (req, res) => {
    try {
      const prod = await getProductById(
        req.params.id
      );

      if (!prod) {
        return sendApiError(
          res,
          404,
          'NOT_FOUND',
          `Product ${req.params.id} not found`
        );
      }

      res.json(prod);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Create product
// Admin, Warehouse
// ---------------------------------------------------------

app.post(
  '/api/products',
  authenticateToken,
  authorizeRoles('Admin', 'Warehouse'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const newProd = await createProduct(
        req.body,
        req.user!
      );

      res.status(201).json(newProd);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'VALIDATION_ERROR',
        err.message,
        err.details
      );
    }
  }
);

// ---------------------------------------------------------
// Update product
// Admin, Warehouse
// ---------------------------------------------------------

app.put(
  '/api/products/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Warehouse'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const updated = await updateProduct(
        req.params.id,
        req.body,
        req.user!
      );

      res.json(updated);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'UPDATE_ERROR',
        err.message,
        err.details
      );
    }
  }
);

// ---------------------------------------------------------
// Delete product
// Admin only
// ---------------------------------------------------------

app.delete(
  '/api/products/:id',
  authenticateToken,
  authorizeRoles('Admin'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const deleted = await deleteProduct(
        req.params.id,
        req.user!
      );

      res.json({
        message: 'Product deleted',
        product: deleted,
      });
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'DELETE_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Inventory movements history
// All authenticated roles
// ---------------------------------------------------------

app.get(
  [
    '/api/inventory/movements',
    '/api/stock-movements',
  ],
  authenticateToken,
  async (req, res) => {
    try {
      const {
        productId,
        type,
      } = req.query;

      const movements =
        await getInventoryMovements({
          productId: productId as string,
          type: type as string,
        });

      res.json(movements);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Manual stock adjustment / inward
// Admin, Warehouse
// ---------------------------------------------------------

app.post(
  [
    '/api/inventory/movements',
    '/api/stock-movements',
  ],
  authenticateToken,
  authorizeRoles('Admin', 'Warehouse'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const {
        productId,
        changeQty,
        type,
        reason,
      } = req.body;

      if (
        !productId ||
        !changeQty ||
        !type
      ) {
        return sendApiError(
          res,
          400,
          'VALIDATION_ERROR',
          'productId, changeQty, and type are required'
        );
      }

      const result =
        await addInventoryMovement(
          productId,
          Number(changeQty),
          type,
          reason,
          req.user!
        );

      res.status(201).json(result);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'STOCK_ERROR',
        err.message,
        err.details
      );
    }
  }
);

// =========================================================
// SALES CHALLAN ROUTES
// =========================================================

// ---------------------------------------------------------
// List challans
// All authenticated roles
// ---------------------------------------------------------

app.get(
  '/api/challans',
  authenticateToken,
  async (req, res) => {
    try {
      const {
        search,
        status,
      } = req.query;

      const list = await getChallans({
        search: search as string,
        status: status as string,
      });

      res.json(list);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Challan details
// ---------------------------------------------------------

app.get(
  '/api/challans/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const challan =
        await getChallanById(
          req.params.id
        );

      if (!challan) {
        return sendApiError(
          res,
          404,
          'NOT_FOUND',
          `Challan ${req.params.id} not found`
        );
      }

      res.json(challan);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Create Challan
// Admin, Sales
//
// DRAFT does NOT reduce stock.
// CONFIRM IMMEDIATELY uses atomic PostgreSQL transaction.
// ---------------------------------------------------------

app.post(
  '/api/challans',
  authenticateToken,
  authorizeRoles('Admin', 'Sales'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const newChallan =
        await createChallan(
          req.body,
          req.user!
        );

      res.status(201).json(newChallan);
    } catch (err: any) {
      sendApiError(
        res,
        400,
        err.code || 'CHALLAN_ERROR',
        err.message,
        err.details
      );
    }
  }
);

// ---------------------------------------------------------
// Confirm Challan
// Admin, Sales
// Supports PUT and POST
// ---------------------------------------------------------

const handleConfirmChallan = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const confirmed =
      await confirmChallan(
        req.params.id,
        req.user!
      );

    res.json({
      status: 'success',
      message: `Challan ${confirmed.challan_no} successfully confirmed and dispatched!`,
      challan: confirmed,
    });
  } catch (err: any) {
    sendApiError(
      res,
      400,
      err.code || 'CONFIRM_ERROR',
      err.message,
      err.details
    );
  }
};

app.put(
  '/api/challans/:id/confirm',
  authenticateToken,
  authorizeRoles('Admin', 'Sales'),
  handleConfirmChallan
);

app.post(
  '/api/challans/:id/confirm',
  authenticateToken,
  authorizeRoles('Admin', 'Sales'),
  handleConfirmChallan
);

// ---------------------------------------------------------
// Cancel Challan
// Admin, Accounts
// Supports PUT and POST
// ---------------------------------------------------------

const handleCancelChallan = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const cancelled =
      await cancelChallan(
        req.params.id,
        req.user!
      );

    res.json({
      status: 'success',
      message: `Challan ${cancelled.challan_no} has been cancelled`,
      challan: cancelled,
    });
  } catch (err: any) {
    sendApiError(
      res,
      400,
      err.code || 'CANCEL_ERROR',
      err.message
    );
  }
};

app.put(
  '/api/challans/:id/cancel',
  authenticateToken,
  authorizeRoles('Admin', 'Accounts'),
  handleCancelChallan
);

app.post(
  '/api/challans/:id/cancel',
  authenticateToken,
  authorizeRoles('Admin', 'Accounts'),
  handleCancelChallan
);

// =========================================================
// DASHBOARD & AUDIT LOGS
// =========================================================

// ---------------------------------------------------------
// Dashboard
// ---------------------------------------------------------

app.get(
  [
    '/api/dashboard',
    '/api/dashboard/stats',
  ],
  authenticateToken,
  async (req, res) => {
    try {
      const stats =
        await getDashboardStats();

      res.json(stats);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Audit Activity Logs
// Admin only
// ---------------------------------------------------------

app.get(
  '/api/activity-logs',
  authenticateToken,
  authorizeRoles('Admin'),
  async (req, res) => {
    try {
      const logs =
        await getActivityLogs();

      res.json(logs);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// ---------------------------------------------------------
// Audit Activity Route aliases
// Admin only
// ---------------------------------------------------------

app.get(
  '/api/audit',
  authenticateToken,
  authorizeRoles('Admin'),
  async (req, res) => {
    try {
      const logs =
        await getActivityLogs();

      res.json(logs);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

app.get(
  '/api/activity',
  authenticateToken,
  authorizeRoles('Admin'),
  async (req, res) => {
    try {
      const logs =
        await getActivityLogs();

      res.json(logs);
    } catch (err: any) {
      sendApiError(
        res,
        500,
        'SERVER_ERROR',
        err.message
      );
    }
  }
);

// =========================================================
// VITE MIDDLEWARE / PRODUCTION SERVE
// =========================================================

async function startServer() {
  try {
    // -------------------------------------------------------
    // 1. Initialize PostgreSQL schema and seed users/catalog
    // -------------------------------------------------------

    await initPostgresDatabase();

    // -------------------------------------------------------
    // 2. Vite middleware in development
    // -------------------------------------------------------

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
        },

        appType: 'spa',
      });

      app.use(vite.middlewares);
    } else {
      // -----------------------------------------------------
      // 3. Serve Vite production build
      // -----------------------------------------------------

      const distPath = path.join(
        process.cwd(),
        'dist'
      );

      app.use(
        express.static(distPath)
      );

      app.get('*', (req, res) => {
        res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      });
    }

    // -------------------------------------------------------
    // 4. Start server
    // -------------------------------------------------------

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `[ERP Portal] Server running on http://0.0.0.0:${PORT} (${getDatabaseEngineType()})`
        );
      }
    );
  } catch (error) {
    console.error(
      '[ERP Portal] Fatal error during startup:',
      error
    );

    process.exit(1);
  }
}

startServer();