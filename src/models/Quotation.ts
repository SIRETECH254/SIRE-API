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
    ref: 'User',
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

quotationSchema.index({ project: 1 });
quotationSchema.index({ client: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdBy: 1 });
quotationSchema.index({ validUntil: 1 });
quotationSchema.index({ client: 1, status: 1 });
quotationSchema.index({ project: 1, status: 1 });
quotationSchema.index({ createdAt: -1 });

quotationSchema.pre('save', async function(next) {
  if (!(this as any).quotationNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Quotation').countDocuments();
    (this as any).quotationNumber = `QT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

quotationSchema.pre('save', function(next) {
  (this as any).items.forEach((item: any) => {
    item.total = item.quantity * item.unitPrice;
  });

  (this as any).subtotal = (this as any).items.reduce((sum: number, item: any) => sum + item.total, 0);
  (this as any).totalAmount = (this as any).subtotal + (this as any).tax - (this as any).discount;
  next();
});

const Quotation = mongoose.model<IQuotation>('Quotation', quotationSchema);

export default Quotation;


