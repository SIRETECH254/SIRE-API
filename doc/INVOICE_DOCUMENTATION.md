
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
  client: ObjectId;              // Reference to User
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
client: { required: true, ref: 'User' }
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
import { generateInvoicePDF } from '../utils/generatePDF';
import { sendInvoiceEmail } from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';
```

### Functions Overview

#### `createInvoice(quotation, dueDate?)`
**Purpose:** Create new invoice from quotation (Admin only)
**Access:** Admin users (super_admin, finance)
**Validation:**
- Quotation existence check
- Quotation not already converted
- Valid due date (optional, defaults to 30 days)
**Process:**
- Fetch quotation and populate project
- Generate unique invoice number
- Populate all data from quotation (client, items, tax, discount, notes, projectTitle)
- Calculate totals automatically
- Update quotation status to 'converted'
- Link invoice to quotation
- Update project with invoice reference
- **Send in-app notification to client** (invoice created)
- Save invoice
**Response:** Complete invoice data with populated references

**Notifications:**
- **Client** receives in-app notification: "New Invoice Created" with invoice number, amount, and due date

**Important:** 
- Only `quotation` ID is required in request body
- All invoice data is populated from the quotation
- Quotation must exist and not be already converted
- Workflow: Quotation → Invoice (created from quotation)

**Controller Implementation:**
```typescript
export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotation, dueDate }: {
            quotation: string;
            dueDate?: Date;
        } = req.body;

        // Validation - only quotation is required
        if (!quotation) {
            return next(errorHandler(400, "Quotation is required"));
        }

        // Check if quotation exists
        const quotationExists = await Quotation.findById(quotation)
            .populate('project', 'title');
        
        if (!quotationExists) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Check if quotation has already been converted
        if (quotationExists.convertedToInvoice) {
            return next(errorHandler(400, "This quotation has already been converted to an invoice"));
        }

        // Get project title from populated project
        const projectTitle = (quotationExists.project as any)?.title || '';

        // Create invoice from quotation data
        const invoice = new Invoice({
            client: quotationExists.client,
            quotation: quotationExists._id,
            projectTitle: projectTitle,
            items: quotationExists.items.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total
            })),
            tax: quotationExists.tax,
            discount: quotationExists.discount,
            dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            notes: quotationExists.notes,
            createdBy: req.user?._id
        });

        await invoice.save();

        // Update project with invoice reference
        if (quotationExists.project) {
            const project = await Project.findById(quotationExists.project);
            if (project) {
                project.invoice = invoice._id as any;
                await project.save();
            }
        }

        // Update quotation status to 'converted'
        quotationExists.status = 'converted';
        quotationExists.convertedToInvoice = invoice._id as any;
        await quotationExists.save();

        // Populate references
        await invoice.populate('client', 'firstName lastName email company');
        await invoice.populate('quotation', 'quotationNumber');
        await invoice.populate('createdBy', 'firstName lastName email');

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'New Invoice Created',
                message: `A new invoice ${invoice.invoiceNumber} has been created. Amount: $${invoice.totalAmount.toFixed(2)}`,
                metadata: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: invoice.totalAmount,
                    dueDate: invoice.dueDate
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
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
- **Send in-app notification to client** (invoice paid)
**Response:** Updated invoice

**Notifications:**
- **Client** receives in-app notification: "Invoice Paid" with invoice number and payment details

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
                amount: invoice.totalAmount,
                paymentMethod,
                status: 'completed',
                transactionId,
                paymentDate: new Date()
            });
            await payment.save();
        }

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'payment',
                subject: 'Invoice Paid',
                message: `Invoice ${invoice.invoiceNumber} has been marked as paid. Thank you for your payment!`,
                metadata: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    paidAmount: invoice.paidAmount,
                    paymentDate: invoice.paidDate
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
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
- **Send bidirectional in-app notification to client** (invoice overdue with actions)
- Send reminder emails
**Response:** List of marked invoices

**Notifications:**
- **Client** receives bidirectional in-app notification: "Invoice Overdue" with actions:
  - **"Pay Now"** button (API action) - Directly initiates payment with confirmation
  - **"View Invoice"** button (Navigate action) - Opens invoice details page

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

        // Send bidirectional notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'Invoice Overdue',
                message: `Invoice ${invoice.invoiceNumber} is now overdue. Please make payment as soon as possible.`,
                actions: [
                    {
                        id: 'make_payment',
                        label: 'Pay Now',
                        type: 'api',
                        endpoint: '/api/payments/initiate',
                        method: 'POST',
                        payload: {
                            invoiceId: invoice._id.toString(),
                            method: 'mpesa',
                            amount: invoice.totalAmount - invoice.paidAmount
                        },
                        variant: 'primary',
                        requiresConfirmation: true,
                        confirmationMessage: `Pay $${invoice.totalAmount - invoice.paidAmount} for invoice ${invoice.invoiceNumber}?`
                    },
                    {
                        id: 'view_invoice',
                        label: 'View Invoice',
                        type: 'navigate',
                        route: `/invoices/${invoice._id}`,
                        variant: 'secondary'
                    }
                ],
                context: {
                    resourceId: invoice._id.toString(),
                    resourceType: 'invoice'
                },
                metadata: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    dueDate: invoice.dueDate,
                    totalAmount: invoice.totalAmount
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

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
- **Send in-app notification to client** (if invoice was sent or paid)
**Response:** Updated invoice

**Notifications:**
- **Client** receives in-app notification: "Invoice Cancelled" (only if invoice was previously sent or paid) with cancellation reason

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

        // Save old status before any checks
        const oldStatus = invoice.status;

        invoice.status = 'cancelled';
        if (reason) {
            invoice.notes = `Cancellation reason: ${reason}`;
        }
        await invoice.save();

        // Send notification to client if invoice was sent or paid
        if (oldStatus === 'sent' || oldStatus === 'paid') {
            try {
                await createInAppNotification({
                    recipient: invoice.client.toString(),
                    recipientModel: 'User',
                    category: 'invoice',
                    subject: 'Invoice Cancelled',
                    message: `Invoice ${invoice.invoiceNumber} has been cancelled. Reason: ${reason || 'No reason provided'}`,
                    metadata: {
                        invoiceId: invoice._id,
                        invoiceNumber: invoice.invoiceNumber,
                        reason: reason
                    },
                    io: req.app.get('io')
                });
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

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

#### `generateInvoicePDFController(invoiceId)`
**Purpose:** Generate PDF of invoice and upload to Cloudinary
**Access:** Admin or client (own invoices)
**Process:**
- Fetch invoice with populated data (client, quotation, createdBy)
- Generate professional PDF with tables
- Upload PDF to Cloudinary as raw file
- Return PDF URL
**Response:** JSON with PDF URL

**Controller Implementation:**
```typescript
export const generateInvoicePDFController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone address city country')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoice);

        // Upload PDF to Cloudinary as raw file
        const fileName = `invoice-${invoice.invoiceNumber || invoiceId}`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/invoices',
                    resource_type: 'raw',
                    public_id: fileName,
                    type: 'upload',
                    overwrite: true,
                    invalidate: true,
                    access_mode: 'public',
                    use_filename: true,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else if (result) {
                        resolve({
                            secure_url: result.secure_url || '',
                            url: result.url || '',
                            public_id: result.public_id || ''
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(pdfBuffer);
        });

        // Construct PDF URL with .pdf extension
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        if (!pdfUrl) {
            const publicId = uploadResult.public_id.includes('sire-tech/invoices') 
                ? uploadResult.public_id 
                : `sire-tech/invoices/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}.pdf`;
        } else {
            if (!pdfUrl.includes('.pdf')) {
                if (pdfUrl.includes('?')) {
                    pdfUrl = pdfUrl.replace('?', '.pdf?');
                } else {
                    pdfUrl += '.pdf';
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Invoice PDF generated successfully",
            pdfUrl: pdfUrl
        });

    } catch (error: any) {
        console.error('Generate invoice PDF error:', error);
        next(errorHandler(500, "Server error while generating invoice PDF"));
    }
};
```

#### `sendInvoice(invoiceId)`
**Purpose:** Send invoice to client via email
**Access:** Admin users (super_admin, finance)
**Process:**
- Fetch invoice with populated client and quotation
- Generate PDF
- Upload PDF to Cloudinary
- Send email with PDF attachment and URL
- Update status to 'sent' if currently 'draft'
- **Send bidirectional in-app notification to client** (invoice sent with actions)
- Track send details
**Response:** Confirmation message with PDF URL

**Notifications:**
- **Client** receives bidirectional in-app notification: "Invoice Sent" with actions:
  - **"Pay Now"** button (API action) - Directly initiates payment
  - **"View Invoice"** button (Navigate action) - Opens invoice details page

**Controller Implementation:**
```typescript
export const sendInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone')
            .populate('quotation', 'quotationNumber');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Check if invoice has a client with email
        if (!invoice.client) {
            return next(errorHandler(400, "Invoice must have an associated client"));
        }

        const client = invoice.client as any;
        if (!client.email) {
            return next(errorHandler(400, "Client email is required to send invoice"));
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoice);

        // Upload PDF to Cloudinary
        const fileName = `invoice-${invoice.invoiceNumber || invoiceId}`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/invoices',
                    resource_type: 'raw',
                    public_id: fileName,
                    type: 'upload',
                    overwrite: true,
                    invalidate: true,
                    access_mode: 'public',
                    use_filename: true,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else if (result) {
                        resolve({
                            secure_url: result.secure_url || '',
                            url: result.url || '',
                            public_id: result.public_id || ''
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(pdfBuffer);
        });

        // Construct PDF URL with .pdf extension
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        if (!pdfUrl) {
            const publicId = uploadResult.public_id.includes('sire-tech/invoices') 
                ? uploadResult.public_id 
                : `sire-tech/invoices/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}.pdf`;
        } else {
            if (!pdfUrl.includes('.pdf')) {
                if (pdfUrl.includes('?')) {
                    pdfUrl = pdfUrl.replace('?', '.pdf?');
                } else {
                    pdfUrl += '.pdf';
                }
            }
        }

        // Send email to client
        await sendInvoiceEmail(client.email, invoice, pdfUrl, pdfBuffer);

        // Update invoice status to 'sent'
        if (invoice.status === 'draft') {
            invoice.status = 'sent';
            await invoice.save();
        }

        // Send bidirectional notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client._id.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'Invoice Sent',
                message: `Invoice ${invoice.invoiceNumber} has been sent to your email. Please make payment by ${new Date(invoice.dueDate).toLocaleDateString()}.`,
                actions: [
                    {
                        id: 'make_payment',
                        label: 'Pay Now',
                        type: 'api',
                        endpoint: '/api/payments/initiate',
                        method: 'POST',
                        payload: {
                            invoiceId: invoice._id.toString(),
                            amount: invoice.totalAmount
                        },
                        variant: 'primary'
                    },
                    {
                        id: 'view_invoice',
                        label: 'View Invoice',
                        type: 'navigate',
                        route: `/invoices/${invoice._id}`,
                        variant: 'secondary'
                    }
                ],
                context: {
                    resourceId: invoice._id.toString(),
                    resourceType: 'invoice'
                },
                metadata: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    dueDate: invoice.dueDate,
                    pdfUrl: pdfUrl
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Invoice sent successfully",
            data: {
                invoiceId: invoice._id,
                sentTo: client.email,
                pdfUrl: pdfUrl
            }
        });

    } catch (error: any) {
        console.error('Send invoice error:', error);
        next(errorHandler(500, "Server error while sending invoice"));
    }
};
```


---

## 🛣️ Invoice Routes

### Base Path: `/api/invoices`

```typescript
// Admin Routes
POST   /                          // Create invoice (admin)
GET    /                          // Get all invoices (admin)

// Invoice Management Routes
GET    /:invoiceId                // Get single invoice
PUT    /:invoiceId                // Update invoice (admin)
DELETE /:invoiceId                // Delete invoice (super admin)
PATCH  /:invoiceId/mark-paid      // Mark as paid (admin)
PATCH  /:invoiceId/mark-overdue   // Mark as overdue (admin)
PATCH  /:invoiceId/cancel         // Cancel invoice (admin)
GET    /:invoiceId/pdf            // Generate PDF
POST   /:invoiceId/send           // Send invoice via email (admin)
```

### Router Implementation

**File: `src/routes/invoiceRoutes.ts`**

```typescript
import express from 'express';
import {
    createInvoice,
    getAllInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    markAsOverdue,
    cancelInvoice,
    generateInvoicePDFController,
    sendInvoice
} from '../controllers/invoiceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createInvoice);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllInvoices);
router.get('/:invoiceId', authenticateToken, getInvoice);
router.put('/:invoiceId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateInvoice);
router.delete('/:invoiceId', authenticateToken, authorizeRoles(['super_admin']), deleteInvoice);
router.patch('/:invoiceId/mark-paid', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsPaid);
router.patch('/:invoiceId/mark-overdue', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsOverdue);
router.patch('/:invoiceId/cancel', authenticateToken, authorizeRoles(['super_admin', 'finance']), cancelInvoice);
router.get('/:invoiceId/pdf', authenticateToken, generateInvoicePDFController);
router.post('/:invoiceId/send', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendInvoice);

export default router;
```

### Route Details

#### `POST /api/invoices`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "quotation": "quotation_id_here",
  "dueDate": "2025-12-31"
}
```

**Note:** 
- `quotation` is required (reference to existing quotation)
- `dueDate` is optional (defaults to 30 days from creation)
- All invoice data (client, items, tax, discount, notes, projectTitle) is automatically populated from the quotation
- The quotation's status is automatically updated to 'converted'
- The project's `invoice` field is automatically updated when invoice is created

**Response:**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "invoice": {
      "_id": "...",
      "invoiceNumber": "INV-2025-0001",
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "company": "Example Corp"
      },
      "quotation": {
        "_id": "...",
        "quotationNumber": "QT-2025-0001"
      },
      "projectTitle": "E-commerce Website Development",
      "items": [
        {
          "description": "Frontend Development (React/Next.js)",
          "quantity": 1,
          "unitPrice": 5000,
          "total": 5000
        }
      ],
      "subtotal": 9000,
      "tax": 1050,
      "discount": 500,
      "totalAmount": 9550,
      "paidAmount": 0,
      "status": "draft",
      "dueDate": "2025-12-31T00:00:00.000Z",
      "createdBy": {...},
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/invoices`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by invoice number or project title
- `status` (optional): Filter by status (draft, sent, paid, partially_paid, overdue, cancelled)
- `client` (optional): Filter by client ID

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalInvoices": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/invoices/stats`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 100,
      "byStatus": {
        "draft": 5,
        "sent": 30,
        "paid": 40,
        "partiallyPaid": 10,
        "overdue": 10,
        "cancelled": 5
      },
      "totalAmount": 500000,
      "paidAmount": 350000,
      "outstandingAmount": 150000
    }
  }
}
```

#### `GET /api/invoices/overdue`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "...",
        "invoiceNumber": "INV-2025-0001",
        "client": {...},
        "totalAmount": 9550,
        "paidAmount": 0,
        "dueDate": "2025-01-15T00:00:00.000Z",
        "status": "overdue"
      }
    ]
  }
}
```

#### `GET /api/invoices/client/:clientId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `clientId` - The client ID

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "...",
        "invoiceNumber": "INV-2025-0001",
        "projectTitle": "E-commerce Website Development",
        "status": "sent",
        "totalAmount": 9550,
        "paidAmount": 0,
        "dueDate": "2025-12-31T00:00:00.000Z",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/invoices/:invoiceId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "...",
      "invoiceNumber": "INV-2025-0001",
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "+254712345678",
        "company": "Example Corp"
      },
      "quotation": {...},
      "projectTitle": "E-commerce Website Development",
      "items": [
        {
          "description": "Frontend Development",
          "quantity": 1,
          "unitPrice": 5000,
          "total": 5000
        }
      ],
      "subtotal": 9000,
      "tax": 1050,
      "discount": 500,
      "totalAmount": 9550,
      "paidAmount": 0,
      "status": "sent",
      "dueDate": "2025-12-31T00:00:00.000Z",
      "notes": "Payment terms: Net 30",
      "createdBy": {...},
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `PUT /api/invoices/:invoiceId`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Body:**
```json
{
  "projectTitle": "Updated Project Title",
  "items": [
    {
      "description": "Updated Item",
      "quantity": 2,
      "unitPrice": 3000
    }
  ],
  "tax": 1200,
  "discount": 600,
  "dueDate": "2025-12-31",
  "notes": "Updated notes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice updated successfully",
  "data": {
    "invoice": {
      "_id": "...",
      "projectTitle": "Updated Project Title",
      "totalAmount": 6600,
      ...
    }
  }
}
```

#### `DELETE /api/invoices/:invoiceId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

#### `PATCH /api/invoices/:invoiceId/mark-paid`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "message": "Invoice marked as paid successfully",
  "data": {
    "invoice": {
      "_id": "...",
      "status": "paid",
      "paidAmount": 9550,
      "paidDate": "2025-01-01T00:00:00.000Z",
      ...
    }
  }
}
```

#### `PATCH /api/invoices/:invoiceId/mark-overdue`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "message": "Invoice marked as overdue successfully",
  "data": {
    "invoice": {
      "_id": "...",
      "status": "overdue",
      ...
    }
  }
}
```

#### `PATCH /api/invoices/:invoiceId/cancel`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "message": "Invoice cancelled successfully",
  "data": {
    "invoice": {
      "_id": "...",
      "status": "cancelled",
      ...
    }
  }
}
```

#### `GET /api/invoices/:invoiceId/pdf`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "message": "Invoice PDF generated successfully",
  "pdfUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1234567890/sire-tech/invoices/invoice-INV-2025-0001.pdf"
}
```

#### `POST /api/invoices/:invoiceId/send`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "message": "Invoice sent successfully",
  "data": {
    "invoiceId": "...",
    "sentTo": "client@example.com",
    "pdfUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1234567890/sire-tech/invoices/invoice-INV-2025-0001.pdf"
  }
}
```

---

## 📝 API Examples

### Create Invoice from Quotation
```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "quotation": "quotation_id_here",
    "dueDate": "2025-12-15"
  }'
```

**Note:** 
- Only `quotation` ID is required
- All invoice data is automatically populated from the quotation
- Quotation must exist and not be already converted
- If `dueDate` is not provided, it defaults to 30 days from creation

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
  -H "Authorization: Bearer <token>"
```

**Response:** JSON with PDF URL
```json
{
  "success": true,
  "message": "Invoice PDF generated successfully",
  "pdfUrl": "https://res.cloudinary.com/your-cloud/raw/upload/v1234567890/sire-tech/invoices/invoice-INV-2025-0001.pdf"
}
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
- **Invoice creation from quotation** - Only quotation ID required
- **Automatic data population** - All invoice data (client, items, tax, discount, notes, projectTitle) automatically populated from quotation
- **Status management** - Quotation status automatically updated to 'converted' when invoice is created
- **Reference linking** - Invoice linked to quotation via `quotation` field, quotation linked to invoice via `convertedToInvoice` field
- **Project linking** - Project's `invoice` field automatically updated when invoice is created
- **Workflow:** Quotation (accepted) → Invoice (created from quotation)

### Payment Integration
- Track payments against invoices
- Automatic status updates
- Payment history

### Project Integration
- Link invoice to project
- Track project billing
- Financial reporting

### Notification Integration

The Invoice system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **Invoice Created** (`createInvoice`)
   - **Recipient:** Client
   - **Category:** `invoice`
   - **Subject:** "New Invoice Created"
   - **Message:** Includes invoice number, amount, and due date
   - **Metadata:** `invoiceId`, `invoiceNumber`, `totalAmount`, `dueDate`

2. **Invoice Sent** (`sendInvoice`)
   - **Recipient:** Client
   - **Category:** `invoice`
   - **Subject:** "Invoice Sent"
   - **Type:** **Bidirectional Notification** with actions
   - **Actions:**
     - **"Pay Now"** button (API action) - Directly initiates payment
     - **"View Invoice"** button (Navigate action) - Opens invoice details
   - **Metadata:** `invoiceId`, `invoiceNumber`, `dueDate`, `pdfUrl`

3. **Invoice Paid** (`markAsPaid`)
   - **Recipient:** Client
   - **Category:** `payment`
   - **Subject:** "Invoice Paid"
   - **Message:** Includes invoice number and payment details
   - **Metadata:** `invoiceId`, `invoiceNumber`, `paidAmount`, `paymentDate`

4. **Invoice Overdue** (`markAsOverdue`)
   - **Recipient:** Client
   - **Category:** `invoice`
   - **Subject:** "Invoice Overdue"
   - **Type:** **Bidirectional Notification** with actions
   - **Actions:**
     - **"Pay Now"** button (API action) - Directly initiates payment with confirmation dialog
     - **"View Invoice"** button (Navigate action) - Opens invoice details
   - **Metadata:** `invoiceId`, `invoiceNumber`, `dueDate`, `totalAmount`

5. **Invoice Cancelled** (`cancelInvoice`)
   - **Recipient:** Client (only if invoice was previously sent or paid)
   - **Category:** `invoice`
   - **Subject:** "Invoice Cancelled"
   - **Message:** Includes cancellation reason
   - **Metadata:** `invoiceId`, `invoiceNumber`, `reason`

#### Notification Preferences

All notifications respect user/client notification preferences:
- If `inApp` preference is `false`, notifications are skipped
- Default behavior: Notifications are sent unless explicitly disabled

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
