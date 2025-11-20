import mongoose, { Schema, Types } from 'mongoose';
import type { IPayment } from '../types/index';

const paymentSchema = new Schema({
  paymentNumber: {
    type: String,
    required: [true, 'Payment number is required'],
    unique: true,
    trim: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: [true, 'Invoice is required']
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: {
      values: ['mpesa', 'paystack'],
      message: 'Payment method must be mpesa or paystack'
    }
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'completed', 'failed'],
      message: 'Status must be pending, completed, or failed'
    },
    default: 'pending'
  },
  transactionId: {
    type: String,
    trim: true
  },
  reference: {
    type: String,
    trim: true
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  processorRefs: {
    daraja: {
      merchantRequestId: { type: String },
      checkoutRequestId: { type: String }
    },
    paystack: {
      reference: { type: String }
    }
  },
  rawPayload: {
    type: Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

paymentSchema.index({ invoice: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ client: 1, status: 1 });
paymentSchema.index({ 'processorRefs.daraja.checkoutRequestId': 1 });
paymentSchema.index({ 'processorRefs.paystack.reference': 1 });

// Pre-validate hook runs before validation, ensuring paymentNumber is set
paymentSchema.pre('validate', async function(next) {
  try {
    // Only generate payment number for new documents that don't have one
    if ((this as any).isNew && !(this as any).paymentNumber) {
      const year = new Date().getFullYear();
      // Count documents created in the current year
      const startOfYear = new Date(year, 0, 1);
      const count = await mongoose.model('Payment').countDocuments({
        createdAt: { $gte: startOfYear }
      });
      (this as any).paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
  } catch (error: any) {
    console.error('Error generating payment number:', error);
    next(error);
  }
});

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;


