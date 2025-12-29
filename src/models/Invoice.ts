import mongoose, { Schema } from 'mongoose';
import type { IInvoice } from '../types/index';

const invoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    trim: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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
  pdf: {
    url: {
      type: String,
      trim: true
    }
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
// Note: invoiceNumber already has unique: true which creates an index automatically
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdBy: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ client: 1, status: 1 });
invoiceSchema.index({ createdAt: -1 });

// Pre-validate hook runs before validation, ensuring invoiceNumber is set
invoiceSchema.pre('validate', async function(next) {
  try {
    // Only generate invoice number for new documents that don't have one
    if ((this as any).isNew && !(this as any).invoiceNumber) {
      const year = new Date().getFullYear();
      // Count documents created in the current year
      const startOfYear = new Date(year, 0, 1);
      const count = await mongoose.model('Invoice').countDocuments({
        createdAt: { $gte: startOfYear }
      });
      (this as any).invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
  } catch (error: any) {
    console.error('Error generating invoice number:', error);
    next(error);
  }
});

invoiceSchema.pre('save', function(next) {
  (this as any).items.forEach((item: any) => {
    item.total = item.quantity * item.unitPrice;
  });

  (this as any).subtotal = (this as any).items.reduce((sum: number, item: any) => sum + item.total, 0);
  (this as any).totalAmount = (this as any).subtotal + (this as any).tax - (this as any).discount;
  next();
});

invoiceSchema.pre('save', function(next) {
  if ((this as any).isModified('paidAmount')) {
    const current = this as any;
    if (current.paidAmount === 0) {
      if (new Date() > current.dueDate && current.status !== 'cancelled') {
        current.status = 'overdue';
      } else if (current.status === 'overdue' && new Date() <= current.dueDate) {
        current.status = 'sent';
      }
    } else if (current.paidAmount >= current.totalAmount) {
      current.status = 'paid';
      if (!current.paidDate) {
        current.paidDate = new Date();
      }
    } else if (current.paidAmount > 0 && current.paidAmount < current.totalAmount) {
      current.status = 'partially_paid';
    }
  }
  next();
});

invoiceSchema.virtual('remainingBalance').get(function() {
  const current = this as any;
  return current.totalAmount - current.paidAmount;
});

invoiceSchema.set('toJSON', { virtuals: true });

const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);

export default Invoice;


