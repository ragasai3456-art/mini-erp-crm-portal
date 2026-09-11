export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Mini ERP + CRM Operations Portal API",
    version: "1.0.0",
    description: "RESTful API specification for Role-based Authentication, Customer CRM, Product Inventory, Sales Challans with Stock Protection, and Stock Movements.",
  },
  servers: [
    {
      url: "/api",
      description: "Applet Server API",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["Admin", "Sales", "Warehouse", "Accounts"] },
        },
      },
      Customer: {
        type: "object",
        required: ["name", "mobile"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          mobile: { type: "string" },
          email: { type: "string", format: "email" },
          business_name: { type: "string" },
          gst: { type: "string" },
          type: { type: "string", enum: ["Retailer", "Wholesaler", "Distributor", "Direct"] },
          address: { type: "string" },
          status: { type: "string", enum: ["Lead", "Prospect", "Active", "Inactive"] },
          follow_up_date: { type: "string", format: "date" },
          notes: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Product: {
        type: "object",
        required: ["name", "sku", "price"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          sku: { type: "string" },
          category: { type: "string" },
          price: { type: "number" },
          min_stock: { type: "integer" },
          location: { type: "string" },
          current_stock: { type: "integer" },
        },
      },
      Challan: {
        type: "object",
        properties: {
          id: { type: "string" },
          challan_no: { type: "string" },
          customer_id: { type: "string" },
          customer_name: { type: "string" },
          total_qty: { type: "integer" },
          total_amount: { type: "number" },
          status: { type: "string", enum: ["Draft", "Confirmed", "Cancelled"] },
          created_by: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          confirmed_at: { type: "string", format: "date-time" },
          confirmed_by: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                product_snapshot_name: { type: "string" },
                product_snapshot_sku: { type: "string" },
                product_snapshot_price: { type: "number" },
                qty: { type: "integer" },
                line_total: { type: "number" },
              },
            },
          },
        },
      },
      InventoryMovement: {
        type: "object",
        properties: {
          id: { type: "string" },
          product_id: { type: "string" },
          product_name: { type: "string" },
          change_qty: { type: "integer" },
          type: { type: "string", enum: ["IN", "OUT"] },
          reason: { type: "string" },
          created_by: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ApiError: {
        type: "object",
        properties: {
          status: { type: "string", example: "error" },
          statusCode: { type: "integer", example: 400 },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "The provided input is invalid." },
              details: { type: "string", example: "Customer name cannot be empty." },
            },
          },
          requestId: { type: "string" },
          timestamp: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/login": {
      post: {
        summary: "User login (returns JWT and User info)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authentication successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: {
            description: "Invalid credentials",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
          },
        },
      },
    },
    "/customers": {
      get: {
        summary: "List all customers with filtering and pagination",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" }, description: "Filter by name, mobile, email, or GST" },
          { in: "query", name: "status", schema: { type: "string" }, description: "Filter by status" },
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
        ],
        responses: {
          200: {
            description: "List of customers",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Customer" } },
                    pagination: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new customer",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Customer" } },
          },
        },
        responses: {
          201: { description: "Customer created", content: { "application/json": { schema: { $ref: "#/components/schemas/Customer" } } } },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/products": {
      get: {
        summary: "List all products in inventory",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" } },
          { in: "query", name: "category", schema: { type: "string" } },
          { in: "query", name: "lowStockOnly", schema: { type: "boolean" } },
        ],
        responses: {
          200: {
            description: "Products list",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } },
          },
        },
      },
      post: {
        summary: "Create product entry",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } },
        },
        responses: {
          201: { description: "Product created" },
          400: { description: "Validation or duplicate SKU error" },
        },
      },
    },
    "/challans": {
      get: {
        summary: "List delivery challans (All authenticated roles: Admin, Sales, Warehouse, Accounts)",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" } },
          { in: "query", name: "status", schema: { type: "string", enum: ["Draft", "Confirmed", "Cancelled"] } },
        ],
        responses: {
          200: {
            description: "Sales challans",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Challan" } } } },
          },
        },
      },
      post: {
        summary: "Create a sales challan (Draft or Immediate Confirmation - Admin, Sales only; Accounts and Warehouse forbidden)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customer_id", "items"],
                properties: {
                  customer_id: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["product_id", "qty"],
                      properties: {
                        product_id: { type: "string" },
                        qty: { type: "integer" },
                      },
                    },
                  },
                  notes: { type: "string" },
                  confirmImmediately: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Challan created" },
          400: { description: "Stock error or validation failure" },
        },
      },
    },
    "/challans/{id}": {
      get: {
        summary: "Get sales challan by ID with line items and customer details",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Challan details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Challan" } } },
          },
          404: { description: "Challan not found" },
        },
      },
    },
    "/challans/{id}/confirm": {
      post: {
        summary: "Confirm and dispatch challan (Admin, Sales only - verifies stock >= qty, locks rows, decrements inventory, creates OUT movements)",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Challan confirmed and stock decremented" },
          400: { description: "Insufficient stock or already confirmed" },
        },
      },
      put: {
        summary: "Confirm and dispatch challan (idempotent PUT alias - Admin, Sales only)",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Challan confirmed and stock decremented" },
          400: { description: "Insufficient stock or already confirmed" },
        },
      },
    },
    "/challans/{id}/cancel": {
      post: {
        summary: "Cancel a challan (Admin, Accounts only - restores stock if already confirmed, marks status Cancelled)",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Challan cancelled and stock restored" },
          400: { description: "Already cancelled or invalid state" },
        },
      },
      put: {
        summary: "Cancel a challan (idempotent PUT alias - Admin, Accounts only)",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Challan cancelled and stock restored" },
          400: { description: "Already cancelled or invalid state" },
        },
      },
    },
    "/stock-movements": {
      get: {
        summary: "Get stock movement logs (alias for /inventory/movements)",
        parameters: [
          { in: "query", name: "productId", schema: { type: "string" } },
          { in: "query", name: "type", schema: { type: "string", enum: ["IN", "OUT"] } },
        ],
        responses: {
          200: {
            description: "Movements audit log",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/InventoryMovement" } } } },
          },
        },
      },
    },
    "/inventory/movements": {
      get: {
        summary: "Get stock movement logs",
        parameters: [
          { in: "query", name: "productId", schema: { type: "string" } },
          { in: "query", name: "type", schema: { type: "string", enum: ["IN", "OUT"] } },
        ],
        responses: {
          200: {
            description: "Movements audit log",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/InventoryMovement" } } } },
          },
        },
      },
      post: {
        summary: "Record manual stock adjustment (IN or OUT)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId", "changeQty", "type", "reason"],
                properties: {
                  productId: { type: "string" },
                  changeQty: { type: "integer" },
                  type: { type: "string", enum: ["IN", "OUT"] },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Stock movement recorded and product stock updated" },
          400: { description: "Validation or negative stock error" },
        },
      },
    },
    "/dashboard/stats": {
      get: {
        summary: "Get operational KPI dashboard metrics",
        responses: {
          200: { description: "Aggregated metrics including customer, product, and challan totals" },
        },
      },
    },
    "/activity-logs": {
      get: {
        summary: "Audit activity trail (Admin only)",
        responses: {
          200: { description: "Immutable system activity logs" },
          403: { description: "Forbidden for non-Admin roles" },
        },
      },
    },
  },
};
