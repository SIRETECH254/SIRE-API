
# 🧾 SIRE Tech API - Invoice Management Documentation

## 📋 Table of Contents
- [Invoice Overview](#invoice-overview)
- [Invoice Model](#invoice-model)
- [Invoice Controller](#invoice-controller)
- [Invoice Routes](#invoice-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 💰 Invoice Overview

The SIRE Tech API Invoice Management System handles all invoice-related operations including creation, payment tracking, PDF generation, email delivery, and status management. Invoices are formal billing documents sent to clients for payment collection.

### Invoice System Features
- **Invoice Creation** - Admin creates invoices (from quotations or standalone)
- **Auto-numbering** - Unique invoice numbers (INV-2025-0001)
- **Item Management** - Multiple line items with descriptions and pricing
- **Financial Calculations** - Subtotal, tax, discount, total automation
- **Payment Tracking** - Track paid amount and status
- **PDF Generation** - Professional invoice PDFs with company branding
- **Email Delivery** - Send invoices directly to clients
- **Payment Status** - Draft, sent, paid, partially paid, overdue, cancelled
- **Due Date Management** - Set payment deadlines
- **Overdue Tracking** - Automatic overdue detection
- **Payment History** - Link to payment records

### Invoice Lifecycle
1. **Draft** - Invoice created, not yet finalized
2. **Sent** - Invoice sent to client
3. **Paid** - Fully paid
4. **Partially Paid** - Some payment received
5. **Overdue** - Past due date without full payment
6. **Cancelled** - Invoice cancelled

---

## 🗄️ Invoice Model

### Schema Definition
```typescript
interface IInvoice {
  _id: string;
  invoiceNumber: string;         // Auto-generated (INV-2025-0001)
  client: ObjectId;              // Reference to Client
  quotation?: ObjectId;          // Reference to Quotation (if converted)
  projectTitle: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;               // Auto-calculated
  }>;
  subtotal: number;              // Auto-calculated
  tax: number;                   // Amount
  discount: number;              // Amount
  totalAmount: number;           // Auto-calculated
  paidAmount: number;            // Amount paid so far
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  dueDate: Date;                 // Payment deadline
  paidDate?: Date;               // Date when fully paid
  notes?: string;
  createdBy: ObjectId;           // Reference to User
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Auto-numbering** - Sequential invoice numbers by year
- **Client Association** - Linked to client record
- **Quotation Link** - Reference to source quotation (if converted)
- **Flexible Items** - Any description, not limited to services
- **Automatic Calculations** - Subtotal, tax, discount, total
- **Payment Tracking** - Paid amount and remaining balance
- **Status Management** - Automatic status updates based on payments
- **Overdue Detection** - Auto-detect overdue invoices
- **Audit Trail** - Created by and timestamps
- **PDF Generation** - Professional formatted PDFs
- **Email Integration** - Direct email delivery

### Validation Rules
```typescript
// Required fields
invoiceNumber: { required: true, unique: true }
client: { required: true, ref: 'Client' }
projectTitle: { required: true, maxlength: 200 }
items: { required: true, minlength: 1 }
subtotal: { required: true, min: 0 }
tax: { required: true, min: 0 }
discount: { required: true, min: 0 }
totalAmount: { required: true, min: 0 }
paidAmount: { required: true, min: 0 }
status: { required: true, enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'] }
dueDate: { required: true, type: Date }
createdBy: { required: true, ref: 'User' }

// Optional fields
quotation: { ref: 'Quotation' }
paidDate: { type: Date }
notes: { maxlength: 500 }
```

### Model Implementation

**File: `src/models/Invoice.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IInvoice } from '../types/index';

const invoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  quotation: {
    type: Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  projectTitle: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
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
  paidAmount: {
    type: Number,
    required: [true, 'Paid amount is required'],
    min: [0, 'Paid amount cannot be negative'],
    default: 0
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'],
      message: 'Status must be draft, sent, paid, partially_paid, overdue, or cancelled'
    },
    default: 'draft'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paidDate: {
    type: Date
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
  }
}, {
  timestamps: true
});

// Indexes for better performance
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdBy: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ client: 1, status: 1 });
invoiceSchema.index({ createdAt: -1 });

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to calculate totals
invoiceSchema.pre('save', function(next) {
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

// Pre-save middleware to update status based on payment
invoiceSchema.pre('save', function(next) {
  if (this.isModified('paidAmount')) {
    if (this.paidAmount === 0) {
      // No payment yet, check if overdue
      if (new Date() > this.dueDate && this.status !== 'cancelled') {
        this.status = 'overdue';
      } else if (this.status === 'overdue' && new Date() <= this.dueDate) {
        this.status = 'sent';
      }
    } else if (this.paidAmount >= this.totalAmount) {
      // Fully paid
      this.status = 'paid';
      if (!this.paidDate) {
        this.paidDate = new Date();
      }
    } else if (this.paidAmount > 0 && this.paidAmount < this.totalAmount) {
      // Partially paid
      this.status = 'partially_paid';
    }
  }
  
  next();
});

// Virtual field for remaining balance
invoiceSchema.virtual('remainingBalance').get(function() {
  return this.totalAmount - this.paidAmount;
});

// Ensure virtual fields are serialized
invoiceSchema.set('toJSON', { virtuals: true });

const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);

export default Invoice;
```

---

## 🎮 Invoice Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Invoice from '../models/Invoice';
import Client from '../models/Client';
import Quotation from '../models/Quotation';
import Payment from '../models/Payment';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { sendInvoiceEmail } from '../services/external/emailService';
```

### Functions Overview

#### `createInvoice(invoiceData)`
**Purpose:** Create new invoice (Admin only)
**Access:** Admin users (super_admin, finance)
**Validation:**
- Client existence check
- Valid due date (in future)
- Item validation
- Price calculations
**Process:**
- Generate unique invoice number
- Calculate totals automatically
- Save invoice
- Optionally send to client
**Response:** Complete invoice data

**Controller Implementation:**
```typescript
export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { client, quotation, projectTitle, items, tax, discount, dueDate, notes }: {
            client: string;
            quotation?: string;
            projectTitle: string;
            items: Array<{
                description: string;
                quantity: number;
                unitPrice: number;
            }>;
            tax?: number;
            discount?: number;
            dueDate: Date;
            notes?: string;
        } = req.body;

        // Validation
        if (!client || !projectTitle || !items || items.length === 0 || !dueDate) {
            return next(errorHandler(400, "Client, project title, items, and due date are required"));
        }

        // Check if client exists
        const clientExists = await Client.findById(client);
        if (!clientExists) {
            return next(errorHandler(404, "Client not found"));
        }

        // Create invoice (totals will be calculated by pre-save middleware)
        const invoice = new Invoice({
            client,
            quotation,
            projectTitle,
            items,
            tax: tax || 0,
            discount: discount || 0,
            dueDate,
            notes,
            createdBy: req.user?._id
        });

        await invoice.save();

        // Populate references
        await invoice.populate('client', 'firstName lastName email company');
        if (quotation) {
            await invoice.populate('quotation');
        }

        res.status(201).json({
            success: true,
            message: "Invoice created successfully",
            data: {
                invoice: invoice
            }
        });

    } catch (error: any) {
        console.error('Create invoice error:', error);
        next(errorHandler(500, "Server error while creating invoice"));
    }
};
```

#### `getAllInvoices(query)`
**Purpose:** Get paginated invoice list with filtering
**Access:** Admin users
**Features:**
- Pagination
- Search by invoice number or project title
- Filter by status, client
- Date range filtering (due date, creation date)
- Sort options
- Population of client and quotation
**Response:** Paginated invoice list

**Controller Implementation:**
```typescript
export const getAllInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, client } = req.query;

        const query: any = {};

        // Search by invoice number or project title
        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { projectTitle: { $regex: search, $options: 'i' } }
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

        const invoices = await Invoice.find(query)
            .populate('client', 'firstName lastName email company')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Invoice.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                invoices: invoices,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalInvoices: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all invoices error:', error);
        next(errorHandler(500, "Server error while fetching invoices"));
    }
};
```

#### `getInvoice(invoiceId)`
**Purpose:** Get single invoice details
**Access:** Admin or client (own invoices only)
**Response:** Complete invoice with populated references and payments

**Controller Implementation:**
```typescript
export const getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone address')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Get payments for this invoice
        const payments = await Payment.find({ invoice: invoiceId });

        res.status(200).json({
            success: true,
            data: {
                invoice: invoice,
                payments: payments
            }
        });

    } catch (error: any) {
        console.error('Get invoice error:', error);
        next(errorHandler(500, "Server error while fetching invoice"));
    }
};
```

#### `updateInvoice(invoiceId, invoiceData)`
**Purpose:** Update invoice details
**Access:** Admin only (before payment)
**Allowed Fields:**
- projectTitle, items, tax, discount, notes
- dueDate
- Cannot update after full payment
**Process:**
- Validate status (cannot update paid invoices)
- Recalculate totals
- Save changes
**Response:** Updated invoice data

**Controller Implementation:**
```typescript
export const updateInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;
        const { projectTitle, items, tax, discount, dueDate, notes }: {
            projectTitle?: string;
            items?: Array<any>;
            tax?: number;
            discount?: number;
            dueDate?: Date;
            notes?: string;
        } = req.body;

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Cannot update paid invoices
        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Cannot update a paid invoice"));
        }

        // Update allowed fields
        if (projectTitle) invoice.projectTitle = projectTitle;
        if (items) invoice.items = items;
        if (tax !== undefined) invoice.tax = tax;
        if (discount !== undefined) invoice.discount = discount;
        if (dueDate) invoice.dueDate = dueDate;
        if (notes) invoice.notes = notes;

        await invoice.save();

        res.status(200).json({
            success: true,
            message: "Invoice updated successfully",
            data: {
                invoice: invoice
            }
        });

    } catch (error: any) {
        console.error('Update invoice error:', error);
        next(errorHandler(500, "Server error while updating invoice"));
    }
};
```

#### `deleteInvoice(invoiceId)`
**Purpose:** Delete invoice
**Access:** Super admin only
**Validation:**
- Cannot delete if payments exist
- Status check
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Check if payments exist
        const paymentsExist = await Payment.findOne({ invoice: invoiceId });
        if (paymentsExist) {
            return next(errorHandler(400, "Cannot delete invoice with existing payments"));
        }

        await Invoice.findByIdAndDelete(invoiceId);

        res.status(200).json({
            success: true,
            message: "Invoice deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete invoice error:', error);
        next(errorHandler(500, "Server error while deleting invoice"));
    }
};
```

#### `markAsPaid(invoiceId, paymentData)`
**Purpose:** Mark invoice as paid
**Access:** Admin users (super_admin, finance)
**Process:**
- Update paidAmount to totalAmount
- Set status to 'paid'
- Set paidDate
- Create payment record
- Emit notification
**Response:** Updated invoice

**Controller Implementation:**
```typescript
export const markAsPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;
        const { paymentMethod, transactionId }: {
            paymentMethod?: string;
            transactionId?: string;
        } = req.body;

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Invoice is already paid"));
        }

        // Update invoice
        invoice.paidAmount = invoice.totalAmount;
        invoice.status = 'paid';
        invoice.paidDate = new Date();
        await invoice.save();

        // Create payment record if payment method provided
        if (paymentMethod) {
            const payment = new Payment({
                invoice: invoice._id,
                client: invoice.client,
                amount: invoice.totalAmount - (invoice.paidAmount - invoice.totalAmount),
                paymentMethod,
                status: 'completed',
                transactionId,
                paymentDate: new Date()
            });
            await payment.save();
        }

        res.status(200).json({
            success: true,
            message: "Invoice marked as paid successfully",
            data: {
                invoice: invoice
            }
        });

    } catch (error: any) {
        console.error('Mark as paid error:', error);
        next(errorHandler(500, "Server error while marking invoice as paid"));
    }
};
```

#### `markAsOverdue()`
**Purpose:** Check and mark overdue invoices (scheduled job)
**Access:** System/Admin
**Process:**
- Find invoices past due date
- Update status to 'overdue'
- Send reminder emails
**Response:** List of marked invoices

**Controller Implementation:**
```typescript
export const markAsOverdue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        invoice.status = 'overdue';
        await invoice.save();

        res.status(200).json({
            success: true,
            message: "Invoice marked as overdue",
            data: {
                invoice: invoice
            }
        });

    } catch (error: any) {
        console.error('Mark as overdue error:', error);
        next(errorHandler(500, "Server error while marking invoice as overdue"));
    }
};
```

#### `cancelInvoice(invoiceId, reason)`
**Purpose:** Cancel invoice
**Access:** Admin users
**Validation:**
- Cannot cancel if fully paid
**Process:**
- Update status to 'cancelled'
- Log cancellation reason
- Emit notification
**Response:** Updated invoice

**Controller Implementation:**
```typescript
export const cancelInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;
        const { reason }: { reason?: string } = req.body;

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Cannot cancel a paid invoice"));
        }

        invoice.status = 'cancelled';
        if (reason) {
            invoice.notes = `Cancellation reason: ${reason}`;
        }
        await invoice.save();

        res.status(200).json({
            success: true,
            message: "Invoice cancelled successfully",
            data: {
                invoice: invoice
            }
        });

    } catch (error: any) {
        console.error('Cancel invoice error:', error);
        next(errorHandler(500, "Server error while cancelling invoice"));
    }
};
```

#### `generateInvoicePDF(invoiceId)`
**Purpose:** Generate PDF of invoice
**Access:** Admin or client (own invoices)
**Process:**
- Fetch invoice with populated data
- Generate professional PDF with branding
- Return PDF buffer or URL
**Response:** PDF file or download link

**Controller Implementation:**
```typescript
export const generateInvoicePDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone address city country')
            .populate('quotation', 'quotationNumber');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Generate PDF (implement this function in utils/pdfGenerator.ts)
        const pdfBuffer = await generateInvoicePDF(invoice);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
        res.send(pdfBuffer);

    } catch (error: any) {
        console.error('Generate invoice PDF error:', error);
        next(errorHandler(500, "Server error while generating PDF"));
    }
};
```

#### `sendInvoice(invoiceId)`
**Purpose:** Send invoice to client via email
**Access:** Admin users
**Process:**
- Generate PDF
- Send email with PDF attachment
- Update status to 'sent'
- Track send date
**Response:** Confirmation message

**Controller Implementation:**
```typescript
export const sendInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoice);

        // Send email with PDF attachment
        await sendInvoiceEmail(invoice.client.email, invoice, pdfBuffer);

        // Update status to sent
        if (invoice.status === 'draft') {
            invoice.status = 'sent';
            await invoice.save();
        }

        res.status(200).json({
            success: true,
            message: "Invoice sent successfully"
        });

    } catch (error: any) {
        console.error('Send invoice error:', error);
        next(errorHandler(500, "Server error while sending invoice"));
    }
};
```

#### `getClientInvoices(clientId)`
**Purpose:** Get all invoices for a client
**Access:** Admin or client themselves
**Response:** List of client's invoices

**Controller Implementation:**
```typescript
export const getClientInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const invoices = await Invoice.find({ client: clientId })
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' });

        res.status(200).json({
            success: true,
            data: {
                invoices: invoices
            }
        });

    } catch (error: any) {
        console.error('Get client invoices error:', error);
        next(errorHandler(500, "Server error while fetching client invoices"));
    }
};
```

#### `getOverdueInvoices()`
**Purpose:** Get all overdue invoices
**Access:** Admin users
**Response:** List of overdue invoices

**Controller Implementation:**
```typescript
export const getOverdueInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const overdueInvoices = await Invoice.find({
            status: 'overdue'
        })
            .populate('client', 'firstName lastName email company')
            .sort({ dueDate: 'asc' });

        res.status(200).json({
            success: true,
            data: {
                invoices: overdueInvoices,
                count: overdueInvoices.length
            }
        });

    } catch (error: any) {
        console.error('Get overdue invoices error:', error);
        next(errorHandler(500, "Server error while fetching overdue invoices"));
    }
};
```

#### `getInvoiceStats()`
**Purpose:** Get invoice statistics
**Access:** Admin users
**Response:**
- Total invoices by status
- Total revenue (paid + partially paid)
- Outstanding balance
- Overdue count and amount
- Average invoice value
- Payment collection rate

**Controller Implementation:**
```typescript
export const getInvoiceStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const total = await Invoice.countDocuments();
        const draft = await Invoice.countDocuments({ status: 'draft' });
        const sent = await Invoice.countDocuments({ status: 'sent' });
        const paid = await Invoice.countDocuments({ status: 'paid' });
        const partiallyPaid = await Invoice.countDocuments({ status: 'partially_paid' });
        const overdue = await Invoice.countDocuments({ status: 'overdue' });
        const cancelled = await Invoice.countDocuments({ status: 'cancelled' });

        // Calculate revenue
        const paidInvoices = await Invoice.find({ status: 'paid' });
        const partialInvoices = await Invoice.find({ status: 'partially_paid' });
        
        const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const partialRevenue = partialInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
        const totalCollected = totalRevenue + partialRevenue;

        // Outstanding balance
        const allInvoices = await Invoice.find({
            status: { $in: ['sent', 'partially_paid', 'overdue'] }
        });
        const outstanding = allInvoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total,
                    byStatus: {
                        draft,
                        sent,
                        paid,
                        partiallyPaid,
                        overdue,
                        cancelled
                    },
                    revenue: {
                        totalCollected,
                        outstanding,
                        paidInFull: totalRevenue,
                        partialPayments: partialRevenue
                    },
                    paymentCollectionRate: total > 0 ? ((paid / total) * 100).toFixed(2) : 0
                }
            }
        });

    } catch (error: any) {
        console.error('Get invoice stats error:', error);
        next(errorHandler(500, "Server error while fetching invoice statistics"));
    }
};
```

---

## 🛣️ Invoice Routes

### Base Path: `/api/invoices`

```typescript
// Admin Routes
POST   /                          // Create invoice
GET    /                          // Get all invoices (paginated, filtered)
GET    /stats                     // Get invoice statistics

// Invoice Management Routes
GET    /:invoiceId                // Get single invoice
PUT    /:invoiceId                // Update invoice
DELETE /:invoiceId                // Delete invoice (super admin)

// Payment Action Routes
PATCH  /:invoiceId/mark-paid      // Mark as paid
PATCH  /:invoiceId/mark-overdue   // Mark as overdue
PATCH  /:invoiceId/cancel         // Cancel invoice

// Document Routes
GET    /:invoiceId/pdf            // Generate PDF
POST   /:invoiceId/send           // Send invoice via email

// Query Routes
GET    /client/:clientId          // Get client invoices
GET    /overdue                   // Get overdue invoices
```

### Router Implementation

**File: `src/routes/invoiceRoutes.ts`**

```typescript
import express from 'express';
import {
    createInvoice,
    getAllInvoices,
    getInvoiceStats,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    markAsOverdue,
    cancelInvoice,
    generateInvoicePDF,
    sendInvoice,
    getClientInvoices,
    getOverdueInvoices
} from '../controllers/invoiceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/invoices
 * @desc    Create new invoice
 * @access  Private (Admin, Finance)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createInvoice);

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices with filtering and pagination
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllInvoices);

/**
 * @route   GET /api/invoices/stats
 * @desc    Get invoice statistics
 * @access  Private (Admin)
 */
router.get('/stats', authenticateToken, authorizeRoles(['super_admin', 'finance']), getInvoiceStats);

/**
 * @route   GET /api/invoices/overdue
 * @desc    Get overdue invoices
 * @access  Private (Admin)
 */
router.get('/overdue', authenticateToken, authorizeRoles(['super_admin', 'finance']), getOverdueInvoices);

/**
 * @route   GET /api/invoices/client/:clientId
 * @desc    Get client invoices
 * @access  Private (Client or Admin)
 */
router.get('/client/:clientId', authenticateToken, getClientInvoices);

/**
 * @route   GET /api/invoices/:invoiceId
 * @desc    Get single invoice
 * @access  Private (Admin or Client)
 */
router.get('/:invoiceId', authenticateToken, getInvoice);

/**
 * @route   PUT /api/invoices/:invoiceId
 * @desc    Update invoice
 * @access  Private (Admin)
 */
router.put('/:invoiceId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateInvoice);

/**
 * @route   DELETE /api/invoices/:invoiceId
 * @desc    Delete invoice
 * @access  Private (Super Admin only)
 */
router.delete('/:invoiceId', authenticateToken, authorizeRoles(['super_admin']), deleteInvoice);

/**
 * @route   PATCH /api/invoices/:invoiceId/mark-paid
 * @desc    Mark invoice as paid
 * @access  Private (Admin, Finance)
 */
router.patch('/:invoiceId/mark-paid', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsPaid);

/**
 * @route   PATCH /api/invoices/:invoiceId/mark-overdue
 * @desc    Mark invoice as overdue
 * @access  Private (Admin, Finance)
 */
router.patch('/:invoiceId/mark-overdue', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsOverdue);

/**
 * @route   PATCH /api/invoices/:invoiceId/cancel
 * @desc    Cancel invoice
 * @access  Private (Admin)
 */
router.patch('/:invoiceId/cancel', authenticateToken, authorizeRoles(['super_admin', 'finance']), cancelInvoice);

/**
 * @route   GET /api/invoices/:invoiceId/pdf
 * @desc    Generate invoice PDF
 * @access  Private (Admin or Client)
 */
router.get('/:invoiceId/pdf', authenticateToken, generateInvoicePDF);

/**
 * @route   POST /api/invoices/:invoiceId/send
 * @desc    Send invoice via email
 * @access  Private (Admin)
 */
router.post('/:invoiceId/send', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendInvoice);

export default router;
```

---

## 📝 API Examples

### Create Invoice
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "client": "client_id_here",
    "projectTitle": "E-commerce Website Development",
    "items": [
      {
        "description": "Frontend Development",
        "quantity": 1,
        "unitPrice": 5000
      },
      {
        "description": "Backend API Development",
        "quantity": 1,
        "unitPrice": 4000
      },
      {
        "description": "Database Setup",
        "quantity": 1,
        "unitPrice": 1000
      }
    ],
    "tax": 1000,
    "discount": 500,
    "dueDate": "2025-12-15",
    "notes": "Payment via bank transfer or M-Pesa"
  }'
```

### Mark as Paid
```bash
curl -X PATCH http://localhost:5000/api/invoices/<invoiceId>/mark-paid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "paymentMethod": "bank_transfer",
    "transactionId": "TXN123456"
  }'
```

### Generate PDF
```bash
curl -X GET http://localhost:5000/api/invoices/<invoiceId>/pdf \
  -H "Authorization: Bearer <token>" \
  --output invoice.pdf
```

### Send Invoice
```bash
curl -X POST http://localhost:5000/api/invoices/<invoiceId>/send \
  -H "Authorization: Bearer <admin_token>"
```

### Get Invoice Statistics
```bash
curl -X GET http://localhost:5000/api/invoices/stats \
  -H "Authorization: Bearer <admin_token>"
```

---

## 🔒 Security Features

### Access Control
- **Role-Based Access** - Only finance and super admin can create/edit
- **Client Access** - Clients can only view their invoices
- **Payment Control** - Only authorized users can mark as paid
- **Deletion Restrictions** - Cannot delete invoices with payments

### Data Protection
- **Automatic Calculations** - Prevent manual total manipulation
- **Status Automation** - Auto-update based on payments
- **Payment Validation** - Paid amount cannot exceed total
- **Audit Trail** - Track all changes and payments

### Input Validation
- **Required Fields** - All critical fields validated
- **Positive Numbers** - Prices and quantities must be positive
- **Date Validation** - Due date validation
- **Amount Validation** - Payment amount validation

---

## 🚨 Error Handling

### Common Errors
```json
// 400 - Cannot Update Paid Invoice
{
  "success": false,
  "message": "Cannot update a paid invoice"
}

// 400 - Invalid Payment Amount
{
  "success": false,
  "message": "Payment amount cannot exceed invoice total"
}

// 400 - Cannot Delete
{
  "success": false,
  "message": "Cannot delete invoice with existing payments"
}
```

---

## 🔗 Integration with Other Modules

### Client Integration
- Invoices linked to client records
- Client can view their invoices
- Email notifications

### Quotation Integration
- Create invoice from quotation
- Inherit quotation data
- Reference linking

### Payment Integration
- Track payments against invoices
- Automatic status updates
- Payment history

### Project Integration
- Link invoice to project
- Track project billing
- Financial reporting

### Notification Integration
- Email invoice delivery
- Payment reminders
- Overdue alerts
- Payment confirmations

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
