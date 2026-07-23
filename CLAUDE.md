# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents
- [Commands](#commands)
- [Overview](#overview)
- [Entry Point](#entry-point)
- [Layer Conventions](#layer-conventions)
- [Auth & Authorization](#auth--authorization)
- [Key Patterns](#key-patterns)
- [Mongo Models Quick Reference](#mongo-models-quick-reference)
- [Environment Variables Required](#environment-variables-required)
- [API Docs](#api-docs)

---

## Commands

```bash
# Development (hot-reload via nodemon + tsx)
npm run dev

# Production build
npm run build      # tsc → dist/
npm start          # node dist/index.js

# Database migrations
npm run migrate:roles           # seed/migrate role system
npm run migrate:project-links   # backfill project ↔ quotation/invoice links
```

No test runner is configured. TypeScript type-checking is the primary correctness signal:
```bash
npx tsc --noEmit
```

---

## Overview

**LIZEN API** is the core backend system powering the LIZEN company platform. It manages the full lifecycle of client engagement and service delivery — from the moment a prospect reaches out, through project execution, all the way to payment collection.

**What the system handles:**

- **Client Onboarding** — New clients register, verify their email via OTP, and are assigned the `client` role. Admins can also create client accounts directly.
- **Quotation Requests (RFQ)** — Prospective clients submit public requests for quotation without needing an account. These are reviewed by the admin team and can be converted into full projects.
- **Quotations** — The team prepares formal quotations tied to projects. Quotations are sent to clients via email with an auto-generated PDF, and clients can accept or reject them.
- **Invoices** — Accepted quotations flow into invoices. Invoices are also distributed as PDFs via email and tracked through statuses: draft, sent, paid, partially paid, overdue, or cancelled.
- **Project Tracking** — Every client engagement is tracked as a project with status, progress percentage, milestones, team assignments, and file attachments.
- **Payments** — The system records payments against invoices and, in applicable cases, initiates payments directly via M-Pesa (Daraja API) or Paystack. Webhook handlers reconcile payment status automatically.
- **Notifications** — Real-time in-app notifications (via Socket.io) and email/SMS alerts keep clients and staff informed at every stage.

**Core business flow:**

```
QuotationRequest (public RFQ) → Project → Quotation → Invoice → Payment
```

---

## Entry Point

`src/index.ts` — sets up Express, MongoDB, Socket.io, CORS whitelist, and mounts all routes at `/api/<resource>`. The `io` instance and `socketConnections` Map are stored on the Express app via `app.set()` and retrieved in controllers via `req.app.get('io')`.

---

## Layer Conventions

| Layer | Path | Notes |
|-------|------|-------|
| Models | `src/models/` | Mongoose schemas; auto-generate numbered IDs (e.g. `QT-2025-0001`) via pre-save hooks |
| Controllers | `src/controllers/` | One file per resource; `async (req, res, next)` functions; errors passed to `next(errorHandler(status, message))` |
| Routes | `src/routes/` | Thin — only wires middleware + controller functions |
| Types | `src/types/index.ts` | All shared interfaces live here; `req.user` is typed as `IUserResponse` |
| Services | `src/services/external/` | SendGrid email, M-Pesa (Daraja), Paystack, Africa's Talking SMS |
| Services | `src/services/internal/` | `notificationService`, `paymentService` |
| Utils | `src/utils/` | `generatePDF.ts` (PDFKit), `pdfUpload.ts` (Cloudinary), `notificationHelper.ts` |

---

## Auth & Authorization

- `authenticateToken` — verifies JWT Bearer token, attaches `req.user` with populated `roleNames[]`
- `authorizeRoles(['role_name'])` — role gate; roles: `super_admin`, `finance`, `project_manager`, `client`
- `optionalAuth` — attaches user if token present, never rejects; used for public endpoints that enrich response when logged in
- Public endpoints (no auth): contact form, quotation request, public testimonials

---

## Key Patterns

### Error Handling
Always use `next(errorHandler(statusCode, message))`, never `res.json` for errors. Global error handler in `src/index.ts` returns `{ success: false, message }`.

### PDF Generation
`generatePDF.ts` builds a PDFKit buffer → `pdfUpload.ts` uploads to Cloudinary → URL stored on the document. Called automatically on quotation/invoice create and update.

### Real-time Notifications
After any significant action, call `createInAppNotification()` from `src/utils/notificationHelper.ts`, then emit via `req.app.get('io')`.

### Auto-numbering
All primary documents (Project, Quotation, Invoice, Payment) use a pre-save hook that counts existing documents for the year and zero-pads to 4 digits.

### Pagination
Controllers accept `page` and `limit` query params. Build a filter `query` object, then use `.find().skip().limit()` with `countDocuments` for totals. Always return a `pagination` object in the response.

```typescript
export const getAllQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, client, project } = req.query as any;

        const query: any = {};

        if (search) {
            query.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) query.status = status;
        if (client) query.client = client;
        if (project) query.project = project;

        const options = { page: parseInt(page), limit: parseInt(limit) };

        const quotations = await Quotation.find(query)
            .populate('project', 'title description projectNumber')
            .populate('client', 'firstName lastName email company')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Quotation.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                quotations,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalQuotations: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all quotations error:', error);
        next(errorHandler(500, "Server error while fetching quotations"));
    }
};
```

---

### Model Structure
Every model follows this structure: grouped fields with inline section comments, `{ timestamps: true }`, indexes after the schema, virtuals, and a typed `mongoose.model<IInterface>` export. Reference: `src/models/User.ts`.

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IUser } from '../types/index.ts';

// User schema
const userSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  roles: [{
    type: Schema.Types.ObjectId,
    ref: 'Role'
  }],
  isActive: {
    type: Boolean,
    default: true
  },

  // OTP Verification Fields
  otpCode: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  },

  // Password Reset Fields
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpiry: {
    type: Date,
    select: false
  },

  // Activity Tracking
  lastLoginAt: {
    type: Date
  },

  // Notification Preferences
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms:   { type: Boolean, default: true },
    inApp: { type: Boolean, default: true }
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better performance (email index created automatically by unique: true)
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ company: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for primary role (first role in array)
userSchema.virtual('primaryRole', {
  ref: 'Role',
  localField: 'roles',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });

const User = mongoose.model<IUser>('User', userSchema);

export default User;
```

---

### Controller Structure
Controllers are named `export const` async functions typed with `(req: Request, res: Response, next: NextFunction): Promise<void>`. Inline step comments label each logical block. Non-critical side effects (PDF generation, notifications) get their own try/catch so they never abort the main response. All errors go through `next(errorHandler(...))`. Reference: `src/controllers/quotationController.ts`.

```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Quotation from '../models/Quotation';
import Project from '../models/Project';
import { createInAppNotification } from '../utils/notificationHelper';
import { uploadQuotationPDF } from '../utils/pdfUpload';

export const createQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { project, items, tax, discount, validUntil, notes } = req.body;

        if (!project || !items || items.length === 0) {
            return next(errorHandler(400, "Project and items are required"));
        }

        // Check if project exists
        const projectExists = await Project.findById(project);
        if (!projectExists) {
            return next(errorHandler(404, "Project not found"));
        }

        // Validate that project has a client
        if (!projectExists.client) {
            return next(errorHandler(400, "Project must have an associated client"));
        }

        // Calculate item totals
        const itemsWithTotals = items.map((item: any) => ({
            ...item,
            total: item.quantity * item.unitPrice
        }));

        // Calculate subtotal
        const subtotal = itemsWithTotals.reduce((sum: number, item: any) => sum + item.total, 0);

        // Calculate tax and discount as percentages of subtotal
        const taxAmount = subtotal * ((tax || 0) / 100);
        const discountAmount = subtotal * ((discount || 0) / 100);
        const totalAmount = subtotal + taxAmount - discountAmount;

        // Create quotation — client is inherited from project
        const quotation = new Quotation({
            project: projectExists._id,
            client: projectExists.client,
            items: itemsWithTotals,
            subtotal,
            tax: taxAmount,
            discount: discountAmount,
            totalAmount,
            validUntil,
            notes,
            createdBy: (req as any).user?._id
        });

        await quotation.save();

        // Generate and upload PDF
        try {
            const pdfUrl = await uploadQuotationPDF(quotation);
            quotation.pdfUrl = pdfUrl;
            await quotation.save();
        } catch (pdfError) {
            console.error('Error generating PDF for quotation:', pdfError);
            // Don't fail the request if PDF generation fails
        }

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: quotation.client.toString(),
                recipientModel: 'User',
                category: 'quotation',
                subject: 'New Quotation Created',
                message: `A new quotation ${quotation.quotationNumber} has been created for your project.`,
                metadata: { quotationId: quotation._id },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: { quotation }
        });

    } catch (error: any) {
        // Handle specific Mongoose error types before the generic fallback
        if (error.name === 'ValidationError') {
            return next(errorHandler(400, error.message));
        }
        if (error.code === 11000) {
            return next(errorHandler(409, "Quotation number already exists. Please try again."));
        }
        next(errorHandler(500, error.message || "Server error while creating quotation"));
    }
};
```

---

### Route Structure
Every route file has two layers of comments. First, a single `@openapi` block at the top covering **all** routes in the file for Swagger UI. Then, a short `@route / @desc / @access` JSDoc block immediately before each `router.METHOD()` line. Middleware chaining order: `authenticateToken` → `authorizeRoles([...])` / `requireAdmin` → file upload (if any) → controller. Reference: `src/routes/userRoutes.ts`.

```typescript
import express from 'express';
import { getUserProfile, updateUserProfile, adminCreateCustomer } from '../controllers/userController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { uploadUserAvatar } from '../config/cloudinary';

const router = express.Router();

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User profile
 *   put:
 *     tags: [Users]
 *     summary: Update own profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Updated
 *
 * /api/users/admin-create:
 *   post:
 *     tags: [Users]
 *     summary: Admin create customer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Created
 */

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update own profile
 * @access  Private
 */
router.put('/profile', authenticateToken, uploadUserAvatar.single('avatar'), updateUserProfile);

/**
 * @route   POST /api/users/admin-create
 * @desc    Admin create customer
 * @access  Private (Admin only)
 */
router.post('/admin-create', authenticateToken, authorizeRoles(['super_admin', 'finance']), adminCreateCustomer);

export default router;
```

---

### Module Documentation
Each module has a dedicated doc file in `doc/`. The structure follows the pattern in `doc/USER_DOCUMENTATION.md`:

1. **Table of Contents** — links to every section
2. **Model section** — full TypeScript interface + validation rules + database indexes
3. **Controller section** — function list overview, then per-function block: route, access level, body params, response shape, and implementation snippet
4. **Routes section** — base path, route table, full router file implementation
5. **API Examples** — `curl` commands for every endpoint
6. **Error Handling** — common error responses

**Critical rule:** The data in a module doc (field names, types, validation constraints, response shapes, middleware chains) must exactly match what is in the actual source files at the time of writing. Never document intended behaviour — document what the code does. When the code changes, the doc must be updated to match.

```
doc/
└── USER_DOCUMENTATION.md       ← model + controller + routes for /api/users
└── QUOTATION_DOCUMENTATION.md  ← model + controller + routes for /api/quotations
└── ...one file per resource
```

---

## Mongo Models Quick Reference

| Model | Key relations |
|-------|--------------|
| `User` | has `roles[]` → Role |
| `Project` | has `client` → User, `quotation` → Quotation, `invoice` → Invoice, `services[]` → Service |
| `Quotation` | has `project` → Project, `client` → User (inherited from project) |
| `Invoice` | has `client` → User, `quotation?` → Quotation |
| `Payment` | has `invoice` → Invoice, `client` → User |
| `Notification` | has `recipient` → User; supports `actions[]` for interactive in-app buttons |

---

## Environment Variables Required

`MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `CLOUDINARY_*`, `SENDGRID_API_KEY`, `MPESA_*`, `PAYSTACK_SECRET_KEY`, `AFRICASTALKING_*`, `PORT`, `NODE_ENV`

---

## API Docs

Swagger UI available at `/api/docs` when the server is running.
