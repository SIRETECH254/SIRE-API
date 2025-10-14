import mongoose, { Schema } from 'mongoose';
import type { IPayment } from '../types/index';

const paymentSchema = new Schema<IPayment>({
  paymentNumber: {
    type: String,
    required: [true, 'Payment number is required'],
    unique: true,
    trim: true
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    required: [true, 'Invoice is required']
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
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
      values: ['mpesa', 'bank_transfer', 'stripe', 'paypal', 'cash'],
      message: 'Payment method must be mpesa, bank_transfer, stripe, paypal, or cash'
    }
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'completed', 'failed', 'refunded'],
      message: 'Status must be pending, completed, failed, or refunded'
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

paymentSchema.pre('save', async function(next) {
  if (!this.paymentNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Payment').countDocuments();
    (this as any).paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;


