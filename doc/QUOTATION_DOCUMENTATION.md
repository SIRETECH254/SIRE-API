
# 💼 SIRE Tech API - Quotation Management Documentation

## 📋 Table of Contents
- [Quotation Overview](#quotation-overview)
- [Quotation Model](#quotation-model)
- [Quotation Controller](#quotation-controller)
- [Quotation Routes](#quotation-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 📝 Quotation Overview

The SIRE Tech API Quotation Management System handles all quotation-related operations including creation, client approval, rejection, PDF generation, and conversion to invoices. Quotations are formal price proposals sent to clients before project initiation.

### Quotation System Features
- **Quotation Creation** - Admin creates quotations for clients
- **Auto-numbering** - Unique quotation numbers (QT-2025-0001)
- **Line Item Management** - Multiple items with descriptions, quantities and pricing
- **Financial Calculations** - Subtotal, tax, discount, total automation
- **Client Approval** - Accept or reject quotations
- **PDF Generation** - Professional quotation PDFs with tables
- **Email Delivery** - Send quotations directly to clients
- **Invoice Conversion** - Convert accepted quotations to invoices
- **Expiry Management** - Set quotation validity period
- **Status Tracking** - Track quotation lifecycle

### Quotation Lifecycle
1. **Pending** - Quotation created, not yet sent
2. **Sent** - Quotation sent to client
3. **Accepted** - Client accepted the quotation
4. **Rejected** - Client rejected the quotation
5. **Converted** - Converted to invoice

---

## 🗄️ Quotation Model

### Schema Definition
```typescript
interface IQuotation {
  _id: string;
  quotationNumber: string;       // Auto-generated (QT-2025-0001)
  project: ObjectId;              // Reference to Project (required)
  client: ObjectId;              // Reference to Client (inherited from project)
  items: Array<{
    description: string;         // Item description
    quantity: number;
    unitPrice: number;
    total: number;               // Auto-calculated
  }>;
  subtotal: number;              // Auto-calculated
  tax: number;                   // Percentage or amount
  discount: number;              // Amount
  totalAmount: number;           // Auto-calculated
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'converted';
  validUntil: Date;              // Expiration date
  notes?: string;
  createdBy: ObjectId;           // Reference to User
  convertedToInvoice?: ObjectId; // Reference to Invoice
  createdAt: Date;
  updatedAt: Date;
}
```

**Important Notes:**
- `project` field is **required** - quotation must reference an existing project
- `client` is automatically inherited from the project (not in request body)
- Project title and description are accessed via the populated `project` reference
- Workflow: **Project** (created first) → **Quotation** (created from project) → **Invoice** (created from quotation)

### Key Features
- **Auto-numbering** - Sequential quotation numbers by year
- **Client Association** - Linked to client record
- **Line Items** - Multiple items with descriptions and quantities
- **Automatic Calculations** - Subtotal, tax, discount, total
- **Status Workflow** - Defined lifecycle states
- **Validity Period** - Expiration date tracking
- **Conversion Tracking** - Links to created invoice
- **Audit Trail** - Created by and timestamps
- **PDF Generation** - Professional formatted PDFs
- **Email Integration** - Direct email delivery

### Validation Rules
```typescript
// Required fields
quotationNumber: { required: true, unique: true }
project: { required: true, ref: 'Project' }  // Project reference is required
client: { required: true, ref: 'Client' }    // Inherited from project
items: { required: true, minlength: 1 }
subtotal: { required: true, min: 0 }
tax: { required: true, min: 0 }
discount: { required: true, min: 0 }
totalAmount: { required: true, min: 0 }
status: { required: true, enum: ['pending', 'sent', 'accepted', 'rejected', 'converted'] }
validUntil: { required: true, type: Date }
createdBy: { required: true, ref: 'User' }

// Optional fields
notes: { maxlength: 500 }
convertedToInvoice: { ref: 'Invoice' }
```

### Model Implementation

**File: `src/models/Quotation.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IQuotation } from '../types/index';

const quotationSchema = new Schema<IQuotation>({
  quotationNumber: {
    type: String,
    required: [true, 'Quotation number is required'],
    unique: true,
    trim: true
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  items: [{
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative']
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total cannot be negative']
    }
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    required: [true, 'Tax is required'],
    min: [0, 'Tax cannot be negative'],
    default: 0
  },
  discount: {
    type: Number,
    required: [true, 'Discount is required'],
    min: [0, 'Discount cannot be negative'],
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'sent', 'accepted', 'rejected', 'converted'],
      message: 'Status must be pending, sent, accepted, rejected, or converted'
    },
    default: 'pending'
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  convertedToInvoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  }
}, {
  timestamps: true
});

// Indexes for better performance
// Note: quotationNumber index is already created by unique: true
quotationSchema.index({ project: 1 });
quotationSchema.index({ client: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdBy: 1 });
quotationSchema.index({ validUntil: 1 });
quotationSchema.index({ client: 1, status: 1 });
quotationSchema.index({ project: 1, status: 1 });
quotationSchema.index({ createdAt: -1 });

// Pre-save middleware to generate quotation number
quotationSchema.pre('save', async function(next) {
  if (!this.quotationNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Quotation').countDocuments();
    this.quotationNumber = `QT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to calculate totals
quotationSchema.pre('save', function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    item.total = item.quantity * item.unitPrice;
  });
  
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.tax - this.discount;
  
  next();
});

const Quotation = mongoose.model<IQuotation>('Quotation', quotationSchema);

export default Quotation;
```

---

## 🎮 Quotation Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Quotation from '../models/Quotation';
import Client from '../models/Client';
import Invoice from '../models/Invoice';
import { generateQuotationPDF } from '../utils/pdfGenerator';
import { sendQuotationEmail } from '../services/external/emailService';
```

### Functions Overview

#### `createQuotation(quotationData)`
**Purpose:** Create new quotation from project (Admin only)
**Access:** Admin users (super_admin, finance)
**Validation:**
- Project existence check (required)
- Items validation
- Valid dates (validUntil in future)
- Price calculations
**Process:**
- Validate project exists
- Auto-inherit `client` from project
- Generate unique quotation number
- Calculate totals automatically
- Save quotation and link to project
- Update project's `quotation` field automatically
**Response:** Complete quotation data with populated project

**Important:** 
- Project must exist before creating quotation
- Only `project` ID is required in request body (not projectTitle/description)
- Workflow: Project → Quotation → Invoice

**Controller Implementation:**
```typescript
export const createQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { project, items, tax, discount, validUntil, notes }: {
            project: string;
            items: Array<{
                description: string;
                quantity: number;
                unitPrice: number;
            }>;
            tax?: number;
            discount?: number;
            validUntil: Date;
            notes?: string;
        } = req.body;

        // Validation
        if (!project || !items || items.length === 0) {
            return next(errorHandler(400, "Project and items are required"));
        }

        // Check if project exists
        const projectExists = await Project.findById(project);
        if (!projectExists) {
            return next(errorHandler(404, "Project not found"));
        }

        // Create quotation with project reference
        // Client is inherited from project
        const quotation = new Quotation({
            project: projectExists._id,
            client: projectExists.client,
            items,
            tax: tax || 0,
            discount: discount || 0,
            validUntil,
            notes,
            createdBy: req.user?._id
        });

        await quotation.save();

        // Update project with quotation reference
        projectExists.quotation = quotation._id as any;
        await projectExists.save();

        // Populate references
        await quotation.populate('project', 'title description projectNumber');
        await quotation.populate('client', 'firstName lastName email company');

        res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: {
                quotation: quotation
            }
        });

    } catch (error: any) {
        console.error('Create quotation error:', error);
        next(errorHandler(500, "Server error while creating quotation"));
    }
};
```

#### `getAllQuotations(query)`
**Purpose:** Get paginated quotation list with filtering
**Access:** Admin users
**Features:**
- Pagination
- Search by quotation number
- Filter by status, client, project
- Date range filtering
- Sort options
- Population of project and client
**Response:** Paginated quotation list

**Controller Implementation:**
```typescript
export const getAllQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, client } = req.query;

        const query: any = {};

        // Search by quotation number
        if (search) {
            query.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by client
        if (client) {
            query.client = client;
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

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
                quotations: quotations,
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

#### `getQuotation(quotationId)`
**Purpose:** Get single quotation details
**Access:** Admin or client (own quotations only)
**Response:** Complete quotation with populated references

**Controller Implementation:**
```typescript
export const getQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;

        const quotation = await Quotation.findById(quotationId)
            .populate('project', 'title description projectNumber')
            .populate('client', 'firstName lastName email company phone')
            .populate('createdBy', 'firstName lastName email')
            .populate('convertedToInvoice');

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                quotation: quotation
            }
        });

    } catch (error: any) {
        console.error('Get quotation error:', error);
        next(errorHandler(500, "Server error while fetching quotation"));
    }
};
```

#### `updateQuotation(quotationId, quotationData)`
**Purpose:** Update quotation details
**Access:** Admin only (before client acceptance)
**Allowed Fields:**
- items, tax, discount, notes
- validUntil
- **Cannot change:** project reference (projectTitle/description are inherited from project)
- **Cannot update after acceptance:** Only pending/sent quotations can be updated
**Process:**
- Validate status (only pending/sent can be updated)
- Recalculate totals
- Save changes
**Response:** Updated quotation data

**Controller Implementation:**
```typescript
export const updateQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;
        const { items, tax, discount, validUntil, notes }: {
            items?: Array<any>;
            tax?: number;
            discount?: number;
            validUntil?: Date;
            notes?: string;
        } = req.body;

        const quotation = await Quotation.findById(quotationId);

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Cannot update accepted or converted quotations
        if (quotation.status === 'accepted' || quotation.status === 'converted') {
            return next(errorHandler(400, "Cannot update an accepted or converted quotation"));
        }

        // Update allowed fields
        // Note: project reference cannot be changed
        // Project title/description are inherited from project reference
        if (items) quotation.items = items;
        if (tax !== undefined) quotation.tax = tax;
        if (discount !== undefined) quotation.discount = discount;
        if (validUntil) quotation.validUntil = validUntil;
        if (notes) quotation.notes = notes;

        await quotation.save();

        res.status(200).json({
            success: true,
            message: "Quotation updated successfully",
            data: {
                quotation: quotation
            }
        });

    } catch (error: any) {
        console.error('Update quotation error:', error);
        next(errorHandler(500, "Server error while updating quotation"));
    }
};
```

#### `deleteQuotation(quotationId)`
**Purpose:** Delete quotation
**Access:** Super admin only
**Validation:**
- Cannot delete if converted to invoice
- Status check
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;

        const quotation = await Quotation.findById(quotationId);

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Cannot delete if converted to invoice
        if (quotation.convertedToInvoice) {
            return next(errorHandler(400, "Cannot delete quotation that has been converted to invoice"));
        }

        await Quotation.findByIdAndDelete(quotationId);

        res.status(200).json({
            success: true,
            message: "Quotation deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete quotation error:', error);
        next(errorHandler(500, "Server error while deleting quotation"));
    }
};
```

#### `acceptQuotation(quotationId)`
**Purpose:** Client accepts quotation
**Access:** Client (own quotations only)
**Validation:**
- Quotation not expired
- Status must be 'sent'
**Process:**
- Update status to 'accepted'
- Emit notification
- Prepare for invoice conversion
**Response:** Updated quotation

**Controller Implementation:**
```typescript
export const acceptQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;

        const quotation = await Quotation.findById(quotationId);

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Check if quotation has expired
        if (new Date() > quotation.validUntil) {
            return next(errorHandler(400, "This quotation has expired"));
        }

        // Must be in sent status to be accepted
        if (quotation.status !== 'sent') {
            return next(errorHandler(400, "Only sent quotations can be accepted"));
        }

        quotation.status = 'accepted';
        await quotation.save();

        res.status(200).json({
            success: true,
            message: "Quotation accepted successfully",
            data: {
                quotation: quotation
            }
        });

    } catch (error: any) {
        console.error('Accept quotation error:', error);
        next(errorHandler(500, "Server error while accepting quotation"));
    }
};
```

#### `rejectQuotation(quotationId)`
**Purpose:** Client rejects quotation
**Access:** Client (own quotations only)
**Validation:**
- Status must be 'sent' or 'pending'
**Process:**
- Update status to 'rejected'
- Optional: collect rejection reason
- Notify admin team
**Response:** Updated quotation

**Controller Implementation:**
```typescript
export const rejectQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;
        const { reason }: { reason?: string } = req.body;

        const quotation = await Quotation.findById(quotationId);

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.status === 'accepted' || quotation.status === 'converted') {
            return next(errorHandler(400, "Cannot reject an accepted or converted quotation"));
        }

        quotation.status = 'rejected';
        if (reason) {
            quotation.notes = `Rejection reason: ${reason}`;
        }
        await quotation.save();

        res.status(200).json({
            success: true,
            message: "Quotation rejected",
            data: {
                quotation: quotation
            }
        });

    } catch (error: any) {
        console.error('Reject quotation error:', error);
        next(errorHandler(500, "Server error while rejecting quotation"));
    }
};
```

#### `convertToInvoice(quotationId)`
**Purpose:** Convert accepted quotation to invoice
**Access:** Admin users (super_admin, finance)
**Validation:**
- Quotation must be accepted
- Not already converted
**Process:**
- Create invoice from quotation data
- Update quotation status to 'converted'
- Link invoice to quotation
- Emit notification
**Response:** Created invoice data

**Controller Implementation:**
```typescript
export const convertToInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;
        const { dueDate }: { dueDate?: Date } = req.body;

        const quotation = await Quotation.findById(quotationId);

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.status !== 'accepted') {
            return next(errorHandler(400, "Only accepted quotations can be converted to invoices"));
        }

        if (quotation.convertedToInvoice) {
            return next(errorHandler(400, "This quotation has already been converted to an invoice"));
        }

        // Populate project to get title
        await quotation.populate('project', 'title');
        const projectTitle = quotation.project?.title || '';

        // Create invoice from quotation
        const invoice = new Invoice({
            client: quotation.client,
            quotation: quotation._id,
            projectTitle: projectTitle,
            items: quotation.items.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total
            })),
            tax: quotation.tax,
            discount: quotation.discount,
            dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            createdBy: req.user?._id
        });

        await invoice.save();

        // Update project with invoice reference
        if (quotation.project) {
            const project = await Project.findById(quotation.project);
            if (project) {
                project.invoice = invoice._id as any;
                await project.save();
            }
        }

        // Update quotation
        quotation.status = 'converted';
        quotation.convertedToInvoice = invoice._id as any;
        await quotation.save();

        await invoice.populate('client', 'firstName lastName email company');

        res.status(201).json({
            success: true,
            message: "Quotation converted to invoice successfully",
            data: {
                invoice: invoice,
                quotation: quotation
            }
        });

    } catch (error: any) {
        console.error('Convert to invoice error:', error);
        next(errorHandler(500, "Server error while converting quotation to invoice"));
    }
};
```

#### `generateQuotationPDF(quotationId)`
**Purpose:** Generate PDF of quotation
**Access:** Admin or client (own quotations)
**Process:**
- Fetch quotation with populated data
- Generate professional PDF with tables
- Return PDF buffer or URL
**Response:** PDF file or download link

**Controller Implementation:**
```typescript
export const generateQuotationPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;

        const quotation = await Quotation.findById(quotationId)
            .populate('client', 'firstName lastName email company phone address city country');

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Generate PDF (implement this function in utils/pdfGenerator.ts)
        const pdfBuffer = await generateQuotationPDF(quotation);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=quotation-${quotation.quotationNumber}.pdf`);
        res.send(pdfBuffer);

    } catch (error: any) {
        console.error('Generate quotation PDF error:', error);
        next(errorHandler(500, "Server error while generating PDF"));
    }
};
```

#### `sendQuotation(quotationId)`
**Purpose:** Send quotation to client via email
**Access:** Admin users
**Process:**
- Generate PDF
- Send email with PDF attachment
- Update status to 'sent'
- Track send date
**Response:** Confirmation message

**Controller Implementation:**
```typescript
export const sendQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params;

        const quotation = await Quotation.findById(quotationId)
            .populate('client', 'firstName lastName email');

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Generate PDF
        const pdfBuffer = await generateQuotationPDF(quotation);

        // Send email with PDF attachment
        await sendQuotationEmail(quotation.client.email, quotation, pdfBuffer);

        // Update status to sent
        quotation.status = 'sent';
        await quotation.save();

        res.status(200).json({
            success: true,
            message: "Quotation sent successfully"
        });

    } catch (error: any) {
        console.error('Send quotation error:', error);
        next(errorHandler(500, "Server error while sending quotation"));
    }
};
```

#### `getClientQuotations(clientId)`
**Purpose:** Get all quotations for a client
**Access:** Admin or client themselves
**Response:** List of client's quotations

**Controller Implementation:**
```typescript
export const getClientQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const quotations = await Quotation.find({ client: clientId })
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' });

        res.status(200).json({
            success: true,
            data: {
                quotations: quotations
            }
        });

    } catch (error: any) {
        console.error('Get client quotations error:', error);
        next(errorHandler(500, "Server error while fetching client quotations"));
    }
};
```

#### `getQuotationStats()`
**Purpose:** Get quotation statistics
**Access:** Admin users
**Response:**
- Total quotations by status
- Acceptance rate
- Average quotation value
- Conversion rate to invoices

**Controller Implementation:**
```typescript
export const getQuotationStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const total = await Quotation.countDocuments();
        const pending = await Quotation.countDocuments({ status: 'pending' });
        const sent = await Quotation.countDocuments({ status: 'sent' });
        const accepted = await Quotation.countDocuments({ status: 'accepted' });
        const rejected = await Quotation.countDocuments({ status: 'rejected' });
        const converted = await Quotation.countDocuments({ status: 'converted' });

        const acceptanceRate = (sent + accepted + converted) > 0 
            ? ((accepted + converted) / (sent + accepted + rejected + converted) * 100).toFixed(2) 
            : 0;

        const conversionRate = accepted > 0 
            ? ((converted / accepted) * 100).toFixed(2) 
            : 0;

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total,
                    byStatus: {
                        pending,
                        sent,
                        accepted,
                        rejected,
                        converted
                    },
                    acceptanceRate,
                    conversionRate
                }
            }
        });

    } catch (error: any) {
        console.error('Get quotation stats error:', error);
        next(errorHandler(500, "Server error while fetching quotation statistics"));
    }
};
```

---

## 🛣️ Quotation Routes

### Base Path: `/api/quotations`

```typescript
// Admin Routes
POST   /                          // Create quotation
GET    /                          // Get all quotations (paginated, filtered)
GET    /stats                     // Get quotation statistics

// Quotation Management Routes
GET    /:quotationId              // Get single quotation
PUT    /:quotationId              // Update quotation
DELETE /:quotationId              // Delete quotation (super admin)

// Client Action Routes
POST   /:quotationId/accept       // Accept quotation (client)
POST   /:quotationId/reject       // Reject quotation (client)

// Conversion Routes
POST   /:quotationId/convert-to-invoice  // Convert to invoice

// Document Routes
GET    /:quotationId/pdf          // Generate PDF
POST   /:quotationId/send         // Send quotation via email

// Query Routes
GET    /client/:clientId          // Get client quotations
```

### Router Implementation

**File: `src/routes/quotationRoutes.ts`**

```typescript
import express from 'express';
import {
    createQuotation,
    getAllQuotations,
    getQuotationStats,
    getQuotation,
    updateQuotation,
    deleteQuotation,
    acceptQuotation,
    rejectQuotation,
    convertToInvoice,
    generateQuotationPDF,
    sendQuotation,
    getClientQuotations
} from '../controllers/quotationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/quotations
 * @desc    Create new quotation
 * @access  Private (Admin, Finance)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createQuotation);

/**
 * @route   GET /api/quotations
 * @desc    Get all quotations with filtering and pagination
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllQuotations);

/**
 * @route   GET /api/quotations/stats
 * @desc    Get quotation statistics
 * @access  Private (Admin)
 */
router.get('/stats', authenticateToken, authorizeRoles(['super_admin', 'finance']), getQuotationStats);

/**
 * @route   GET /api/quotations/client/:clientId
 * @desc    Get client quotations
 * @access  Private (Client or Admin)
 */
router.get('/client/:clientId', authenticateToken, getClientQuotations);

/**
 * @route   GET /api/quotations/:quotationId
 * @desc    Get single quotation
 * @access  Private (Admin or Client)
 */
router.get('/:quotationId', authenticateToken, getQuotation);

/**
 * @route   PUT /api/quotations/:quotationId
 * @desc    Update quotation
 * @access  Private (Admin)
 */
router.put('/:quotationId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateQuotation);

/**
 * @route   DELETE /api/quotations/:quotationId
 * @desc    Delete quotation
 * @access  Private (Super Admin only)
 */
router.delete('/:quotationId', authenticateToken, authorizeRoles(['super_admin']), deleteQuotation);

/**
 * @route   POST /api/quotations/:quotationId/accept
 * @desc    Accept quotation
 * @access  Private (Client)
 */
router.post('/:quotationId/accept', authenticateToken, acceptQuotation);

/**
 * @route   POST /api/quotations/:quotationId/reject
 * @desc    Reject quotation
 * @access  Private (Client)
 */
router.post('/:quotationId/reject', authenticateToken, rejectQuotation);

/**
 * @route   POST /api/quotations/:quotationId/convert-to-invoice
 * @desc    Convert quotation to invoice
 * @access  Private (Admin, Finance)
 */
router.post('/:quotationId/convert-to-invoice', authenticateToken, authorizeRoles(['super_admin', 'finance']), convertToInvoice);

/**
 * @route   GET /api/quotations/:quotationId/pdf
 * @desc    Generate quotation PDF
 * @access  Private (Admin or Client)
 */
router.get('/:quotationId/pdf', authenticateToken, generateQuotationPDF);

/**
 * @route   POST /api/quotations/:quotationId/send
 * @desc    Send quotation via email
 * @access  Private (Admin)
 */
router.post('/:quotationId/send', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendQuotation);

export default router;
```

### Route Details

#### `POST /api/quotations`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "project": "project_id_here",
  "items": [
    {
      "description": "Frontend Development (React/Next.js)",
      "quantity": 1,
      "unitPrice": 5000
    },
    {
      "description": "Backend API Development (Node.js/Express)",
      "quantity": 1,
      "unitPrice": 4000
    },
    {
      "description": "Payment Gateway Integration",
      "quantity": 1,
      "unitPrice": 1500
    }
  ],
  "tax": 1050,
  "discount": 500,
  "validUntil": "2025-12-31",
  "notes": "Payment terms: 50% upfront, 50% on completion"
}
```

**Note:** 
- `project` is required (reference to existing project)
- `client` is automatically inherited from the project
- Project title and description are accessed via the populated `project` reference
- The project's `quotation` field is automatically updated when quotation is created

**Response:**
```json
{
  "success": true,
  "message": "Quotation created successfully",
  "data": {
    "quotation": {
      "_id": "...",
      "quotationNumber": "QT-2025-0001",
      "project": {
        "_id": "...",
        "title": "E-commerce Website Development",
        "description": "Full-featured online store with payment integration",
        "projectNumber": "PRJ-2025-0001"
      },
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "company": "Example Corp"
      },
      "items": [...],
      "subtotal": 10500,
      "tax": 1050,
      "discount": 500,
      "totalAmount": 11050,
      "status": "pending",
      "validUntil": "2025-12-31T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/quotations`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by quotation number
- `status` (optional): Filter by status (pending, sent, accepted, rejected, converted)
- `client` (optional): Filter by client ID
- `project` (optional): Filter by project ID

**Response:**
```json
{
  "success": true,
  "data": {
    "quotations": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalQuotations": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/quotations/stats`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 100,
      "byStatus": {
        "pending": 10,
        "sent": 30,
        "accepted": 40,
        "rejected": 10,
        "converted": 10
      },
      "acceptanceRate": "66.67",
      "conversionRate": "25.00"
    }
  }
}
```

#### `GET /api/quotations/client/:clientId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `clientId` - The client ID

**Response:**
```json
{
  "success": true,
  "data": {
    "quotations": [
      {
        "_id": "...",
        "quotationNumber": "QT-2025-0001",
        "project": {
          "_id": "...",
          "title": "E-commerce Website Development",
          "description": "Full-featured online store",
          "projectNumber": "PRJ-2025-0001"
        },
        "status": "sent",
        "totalAmount": 11050,
        "validUntil": "2025-12-31T00:00:00.000Z",
        "createdBy": {
          "firstName": "Admin",
          "lastName": "User",
          "email": "admin@example.com"
        }
      }
    ]
  }
}
```

#### `GET /api/quotations/:quotationId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `quotationId` - The quotation ID

**Response:**
```json
{
  "success": true,
  "data": {
    "quotation": {
      "_id": "...",
      "quotationNumber": "QT-2025-0001",
      "project": {
        "_id": "...",
        "title": "E-commerce Website Development",
        "description": "Full project description",
        "projectNumber": "PRJ-2025-0001"
      },
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "+254712345678",
        "company": "Example Corp"
      },
      "items": [
        {
          "description": "Frontend Development",
          "quantity": 1,
          "unitPrice": 5000,
          "total": 5000
        }
      ],
      "subtotal": 10500,
      "tax": 1050,
      "discount": 500,
      "totalAmount": 11050,
      "status": "sent",
      "validUntil": "2025-12-31T00:00:00.000Z",
      "notes": "Payment terms: 50% upfront",
      "createdBy": {...},
      "convertedToInvoice": null,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `PUT /api/quotations/:quotationId`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `quotationId` - The quotation ID

**Body:**
```json
{
  "items": [
    {
      "description": "Updated Item",
      "quantity": 2,
      "unitPrice": 3000
    }
  ],
  "tax": 1200,
  "discount": 600,
  "validUntil": "2025-12-31",
  "notes": "Updated notes"
}
```

**Note:** Project reference cannot be changed. Project title/description are inherited from the project and cannot be updated via quotation.

**Response:**
```json
{
  "success": true,
  "message": "Quotation updated successfully",
  "data": {
    "quotation": {
      "_id": "...",
      "totalAmount": 6600,
      ...
    }
  }
}
```

#### `DELETE /api/quotations/:quotationId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**URL Parameter:** `quotationId` - The quotation ID

**Response:**
```json
{
  "success": true,
  "message": "Quotation deleted successfully"
}
```

#### `POST /api/quotations/:quotationId/accept`
**Headers:** `Authorization: Bearer <client_token>`

**URL Parameter:** `quotationId` - The quotation ID

**Response:**
```json
{
  "success": true,
  "message": "Quotation accepted successfully",
  "data": {
    "quotation": {
      "_id": "...",
      "status": "accepted",
      ...
    }
  }
}
```

#### `POST /api/quotations/:quotationId/reject`
**Headers:** `Authorization: Bearer <client_token>`

**URL Parameter:** `quotationId` - The quotation ID

**Body:**
```json
{
  "reason": "Budget constraints"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation rejected",
  "data": {
    "quotation": {
      "_id": "...",
      "status": "rejected",
      "notes": "Rejection reason: Budget constraints",
      ...
    }
  }
}
```

#### `POST /api/quotations/:quotationId/convert-to-invoice`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `quotationId` - The quotation ID

**Body:**
```json
{
  "dueDate": "2025-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation converted to invoice successfully",
  "data": {
    "invoice": {
      "_id": "...",
      "invoiceNumber": "INV-2025-0001",
      "client": {...},
      "items": [...],
      "totalAmount": 11050,
      "dueDate": "2025-12-31T00:00:00.000Z",
      "status": "draft",
      ...
    },
    "quotation": {
      "_id": "...",
      "status": "converted",
      "convertedToInvoice": "invoice_id_here",
      ...
    }
  }
}
```

#### `GET /api/quotations/:quotationId/pdf`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `quotationId` - The quotation ID

**Response:**
```json
{
  "success": true,
  "message": "Quotation PDF generated successfully",
  "pdfUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1234567890/sire-tech/quotations/quotation-QT-2025-0001.pdf"
}
```

#### `POST /api/quotations/:quotationId/send`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `quotationId` - The quotation ID

**Response:**
```json
{
  "success": true,
  "message": "Quotation sent successfully"
}
```

---

## 📝 API Examples

### Create Quotation
```bash
curl -X POST http://localhost:5000/api/quotations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "project": "project_id_here",
    "items": [
      {
        "description": "Frontend Development (React/Next.js)",
        "quantity": 1,
        "unitPrice": 5000
      },
      {
        "description": "Backend API Development (Node.js/Express)",
        "quantity": 1,
        "unitPrice": 4000
      },
      {
        "description": "Payment Gateway Integration",
        "quantity": 1,
        "unitPrice": 1500
      }
    ],
    "tax": 1050,
    "discount": 500,
    "validUntil": "2025-12-31",
    "notes": "Payment terms: 50% upfront, 50% on completion"
  }'
```

**Note:** 
- `project` is required (reference to existing project)
- `client` is automatically inherited from the project
- Project must be created first before quotation

### Accept Quotation (Client)
```bash
curl -X POST http://localhost:5000/api/quotations/<quotationId>/accept \
  -H "Authorization: Bearer <client_token>"
```

### Convert to Invoice
```bash
curl -X POST http://localhost:5000/api/quotations/<quotationId>/convert-to-invoice \
  -H "Authorization: Bearer <admin_token>"
```

### Generate PDF
```bash
curl -X GET http://localhost:5000/api/quotations/<quotationId>/pdf \
  -H "Authorization: Bearer <token>" \
  --output quotation.pdf
```

### Send Quotation
```bash
curl -X POST http://localhost:5000/api/quotations/<quotationId>/send \
  -H "Authorization: Bearer <admin_token>"
```

---

## 🔒 Security Features

### Access Control
- **Role-Based Access** - Only finance and super admin can create
- **Client Access** - Clients can only view/act on their quotations
- **Status Restrictions** - Cannot modify after acceptance
- **Conversion Control** - Only accepted quotations can be converted

### Data Protection
- **Automatic Calculations** - Prevent manual total manipulation
- **Status Workflow** - Enforced state transitions
- **Expiry Validation** - Check validity dates
- **Audit Trail** - Track all changes

### Input Validation
- **Required Fields** - All critical fields validated
- **Positive Numbers** - Prices and quantities must be positive
- **Item Validation** - Verify at least one item exists
- **Date Validation** - Valid until must be in future

---

## 🚨 Error Handling

### Common Errors
```json
// 400 - Quotation Expired
{
  "success": false,
  "message": "This quotation has expired"
}

// 400 - Already Converted
{
  "success": false,
  "message": "This quotation has already been converted to an invoice"
}

// 403 - Cannot Modify
{
  "success": false,
  "message": "Cannot modify an accepted quotation"
}
```

---

## 🔗 Integration with Other Modules

### Project Integration
- **Quotation requires project** - Project must exist before quotation creation
- **Data inheritance** - Quotation inherits client and references project
- **Automatic linking** - Project's `quotation` field is automatically updated when quotation is created
- **Project details** - Project title and description are accessed via populated `project` reference
- **Workflow:** Project → Quotation → Invoice

### Client Integration
- **Automatic inheritance** - Client is automatically inherited from project (not in request body)
- Client approval workflow
- Email notifications

### Invoice Integration
- **Seamless conversion** - Convert accepted quotations to invoices
- **Data inheritance** - Invoice inherits project title from quotation's project
- **Reference linking** - Project's `invoice` field is automatically updated when invoice is created
- **Line items transfer** - All line items transferred from quotation to invoice

### Notification Integration
- Email quotation delivery
- Status change notifications
- Acceptance/rejection alerts

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
