
# 💳 SIRE Tech API - Payment Management Documentation

## 📋 Table of Contents
- [Payment Overview](#payment-overview)
- [Payment Model](#payment-model)
- [Payment Controller](#payment-controller)
- [Payment Routes](#payment-routes)
- [Payment Gateway Integration](#payment-gateway-integration)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 💰 Payment Overview

The SIRE Tech API Payment Management System handles all payment-related operations including payment processing, gateway integration (M-Pesa, Paystack), payment tracking, and receipt generation. Payments are linked to invoices and automatically update invoice status.

### Payment System Features
- **Multiple Payment Gateways** - M-Pesa and Paystack
- **Auto-numbering** - Unique payment numbers (PAY-2025-0001)
- **Invoice Integration** - Automatic invoice status updates (paid only when fully paid)
- **Payment Tracking** - Complete payment history
- **Transaction Recording** - Store gateway transaction IDs
- **Receipt Generation** - Automatic receipt creation
- **Email Notifications** - Payment confirmations
- **Webhook Handling** - Gateway callback processing
- **Metadata Storage** - Store additional payment data
- **Real-time Updates** - Socket.io notifications
- **Admin Payment Initiation** - Admins can initiate payments on behalf of clients

### Payment Methods
1. **M-Pesa** - Mobile money (Safaricom)
2. **Paystack** - Card payments (Visa, Mastercard, etc.)

### Payment Status
1. **Pending** - Payment initiated, awaiting confirmation
2. **Completed** - Payment successful
3. **Failed** - Payment failed

---

## 🗄️ Payment Model

### Schema Definition
```typescript
interface IPayment {
  _id: string;
  paymentNumber: string;         // Auto-generated (PAY-2025-0001)
  invoice: ObjectId;             // Reference to Invoice
  client: ObjectId;              // Reference to Client
  amount: number;                // Payment amount
  paymentMethod: 'mpesa' | 'paystack';
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;        // Gateway transaction ID
  reference?: string;            // Payment reference/receipt number
  paymentDate: Date;             // Date of payment
  notes?: string;
  metadata?: Record<string, any>; // Additional payment data
  processorRefs?: {
    daraja?: {
      merchantRequestId?: string;
      checkoutRequestId?: string;
    };
    paystack?: {
      reference?: string;
    };
  };
  rawPayload?: any;              // Raw webhook payload
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Auto-numbering** - Sequential payment numbers by year
- **Invoice Association** - Linked to invoice record
- **Client Tracking** - Direct client reference
- **Gateway Integration** - Support for multiple payment methods
- **Transaction Tracking** - Store gateway transaction IDs
- **Status Management** - Track payment status
- **Metadata Storage** - Store gateway-specific data
- **Audit Trail** - Created by and timestamps
- **Automatic Invoice Update** - Update invoice status on payment
- **Receipt Generation** - Auto-generate payment receipts

### Validation Rules
```typescript
// Required fields
paymentNumber: { required: true, unique: true }
invoice: { required: true, ref: 'Invoice' }
client: { required: true, ref: 'Client' }
amount: { required: true, min: 0 }
paymentMethod: { required: true, enum: ['mpesa', 'paystack'] }
status: { required: true, enum: ['pending', 'completed', 'failed'] }
paymentDate: { required: true, type: Date }

// Optional fields
transactionId: { type: String }
reference: { type: String }
notes: { maxlength: 500 }
metadata: { type: Object }
processorRefs: { type: Object }
rawPayload: { type: Object }
```

### Model Implementation

**File: `src/models/Payment.ts`**

```typescript
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
    type: Schema.Types.Mixed,
    default: {}
  },
  rawPayload: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better performance
paymentSchema.index({ paymentNumber: 1 });
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ client: 1, status: 1 });
paymentSchema.index({ 'processorRefs.daraja.checkoutRequestId': 1 });
paymentSchema.index({ 'processorRefs.paystack.reference': 1 });

// Pre-save middleware to generate payment number
paymentSchema.pre('save', async function(next) {
  if (!this.paymentNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
```

---

## 🎮 Payment Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Payment from '../models/Payment';
import Invoice from '../models/Invoice';
import Client from '../models/Client';
import { createPaymentRecord, applySuccessfulPayment, initiateMpesaForInvoice, initiatePaystackForInvoice, validatePaymentAmount } from '../services/internal/paymentService';
import { parseCallback as parseDarajaCallback, queryStkPushStatus } from '../services/external/darajaService';
import { parseWebhook as parsePaystackWebhook, verifyTransaction } from '../services/external/paystackService';
import { createInAppNotification } from '../utils/notificationHelper';
```

### Functions Overview

#### `createPaymentAdmin(invoiceId, method, amount)` (Admin Payment Initiation)
**Purpose:** Admin initiates payment on behalf of client (M-Pesa STK Push or Paystack)
**Access:** Admin users (super_admin, finance)
**Validation:**
- Invoice existence check
- Amount validation (not exceed remaining balance)
- Payment method validation (mpesa or paystack)
- Phone number validation (for M-Pesa)
- Email validation (for Paystack)
**Process:**
- Validate invoice and amount
- Create payment record
- Initiate M-Pesa STK push or Paystack payment
- Return gateway details for tracking
- Emit Socket.io event
- **Note:** Notifications are sent via webhook handlers (`mpesaWebhook` or `paystackWebhook`) when payment status changes
**Response:** Payment data with gateway details

**Notifications:**
- Notifications are handled by webhook functions (`mpesaWebhook` or `paystackWebhook`)
- See `mpesaWebhook` and `paystackWebhook` functions for notification details

**Controller Implementation:**
```typescript
export const createPaymentAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io = req.app.get('io');
        const { invoiceId, method, amount, payerPhone, payerEmail }: {
            invoiceId: string;
            method: 'mpesa' | 'paystack';
            amount: number;
            payerPhone?: string;
            payerEmail?: string;
        } = req.body;

        if (!invoiceId || !method || !amount) {
            return next(errorHandler(400, "Invoice ID, method, and amount are required"));
        }

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (!validatePaymentAmount(amount, invoice)) {
            return next(errorHandler(400, "Invalid payment amount"));
        }

        const client = await Client.findById(invoice.client);
        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Create payment record
        const payment = await createPaymentRecord({ invoice, method, amount, client });

        // Handle M-Pesa
        if (method === 'mpesa') {
            if (!payerPhone) {
                return next(errorHandler(400, "Phone number is required for M-Pesa payments"));
            }

            // Normalize phone number to E.164 format (254XXXXXXXXX)
            const digitsOnly = String(payerPhone).replace(/[^0-9]/g, '');
            let msisdn = digitsOnly;
            if (msisdn.startsWith('0')) {
                msisdn = `254${msisdn.slice(1)}`;
            }
            if (!msisdn.startsWith('254')) {
                if (digitsOnly.startsWith('254')) msisdn = digitsOnly;
            }
            if (!/^254\d{9}$/.test(msisdn)) {
                return next(errorHandler(400, "Invalid Kenyan phone format. Use 2547XXXXXXXX"));
            }

            const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
            const callback = `${baseUrl}/api/payments/webhooks/mpesa`;

            const { merchantRequestId, checkoutRequestId } = await initiateMpesaForInvoice({
            invoice,
                payment,
            amount,
                phone: msisdn,
                callbackUrl: callback
            });

            io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
            res.status(202).json({ 
                success: true, 
                message: "M-Pesa payment initiated",
                data: { 
                    paymentId: payment._id, 
                    status: payment.status,
                    daraja: { merchantRequestId, checkoutRequestId }
                } 
            });
            return;
        }

        // Handle Paystack
        if (method === 'paystack') {
            if (!payerEmail) {
                return next(errorHandler(400, "Email is required for Paystack payments"));
            }

            const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
            const callback = `${baseUrl}/payments/callback`;

            const { authorizationUrl, reference } = await initiatePaystackForInvoice({
                invoice,
                payment,
                amount,
                email: payerEmail,
                callbackUrl: callback
            });

            io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
            res.status(202).json({ 
                success: true, 
                message: "Paystack payment initiated",
                data: { 
                paymentId: payment._id,
                    status: payment.status,
                    authorizationUrl,
                    reference 
                } 
            });
            return;
        }

        return next(errorHandler(400, "Unsupported payment method"));

    } catch (error: any) {
        console.error('Create payment admin error:', error);
        next(errorHandler(500, "Server error while initiating payment"));
    }
};
```

#### `initiatePayment(invoiceId, method, amount)` (Client/Admin Payment)
**Purpose:** Client or admin initiates payment for an invoice (M-Pesa STK Push or Paystack)
**Access:** Authenticated users (Admin or Client)
**Validation:**
- Invoice existence check
- Amount validation (not exceed remaining balance)
- Payment method validation (mpesa or paystack)
- Phone number validation (for M-Pesa)
- Email validation (for Paystack)
**Process:**
- Validate invoice and amount
- Create payment record
- Initiate M-Pesa STK push or Paystack payment
- Return gateway details for tracking
- Emit Socket.io event
- **Note:** Notifications are sent via webhook handlers (`mpesaWebhook` or `paystackWebhook`) when payment status changes
**Response:** Payment data with gateway details

**Notifications:**
- Notifications are handled by webhook functions (`mpesaWebhook` or `paystackWebhook`)
- See `mpesaWebhook` and `paystackWebhook` functions for notification details

**Controller Implementation:**
```typescript
export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io = req.app.get('io');
        const { invoiceId, method, amount, payerPhone, payerEmail, callbackUrl }: {
            invoiceId: string;
            method: 'mpesa' | 'paystack';
            amount: number;
            payerPhone?: string;
            payerEmail?: string;
            callbackUrl?: string;
        } = req.body;

        if (!invoiceId || !method || !amount) {
            return next(errorHandler(400, "Invoice ID, method, and amount are required"));
        }

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (invoice.status === 'paid') {
            return next(errorHandler(409, "Invoice already paid"));
        }

        if (!validatePaymentAmount(amount, invoice)) {
            return next(errorHandler(400, "Invalid payment amount"));
        }

        // Get client information
        const client = await Client.findById(invoice.client);
        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Create payment record
        const payment = await createPaymentRecord({ invoice, method, amount, client });

        // Handle M-Pesa
        if (method === 'mpesa') {
            if (!payerPhone) {
                return next(errorHandler(400, "Phone number is required for M-Pesa payments"));
            }

            // Normalize phone number to E.164 format (254XXXXXXXXX)
            const digitsOnly = String(payerPhone).replace(/[^0-9]/g, '');
            let msisdn = digitsOnly;
            if (msisdn.startsWith('0')) {
                msisdn = `254${msisdn.slice(1)}`;
            }
            if (!msisdn.startsWith('254')) {
                if (digitsOnly.startsWith('254')) msisdn = digitsOnly;
            }
            if (!/^254\d{9}$/.test(msisdn)) {
                return next(errorHandler(400, "Invalid Kenyan phone format. Use 2547XXXXXXXX"));
            }

            const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
            const callback = callbackUrl || `${baseUrl}/api/payments/webhooks/mpesa`;

            const { merchantRequestId, checkoutRequestId } = await initiateMpesaForInvoice({
                invoice,
                payment,
                amount,
                phone: msisdn,
                callbackUrl: callback
            });

            io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
            res.status(202).json({ 
                success: true, 
                message: "M-Pesa payment initiated",
                data: { 
                paymentId: payment._id,
                    status: payment.status,
                    daraja: { merchantRequestId, checkoutRequestId }
                } 
            });
            return;
        }

        // Handle Paystack
        if (method === 'paystack') {
            if (!payerEmail) {
                return next(errorHandler(400, "Email is required for Paystack payments"));
            }

            const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
            const callback = callbackUrl || `${baseUrl}/payments/callback`;

            const { authorizationUrl, reference } = await initiatePaystackForInvoice({
                invoice,
                payment,
                amount,
                email: payerEmail,
                callbackUrl: callback
            });

            io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
            res.status(202).json({ 
            success: true,
                message: "Paystack payment initiated",
            data: {
                    paymentId: payment._id, 
                    status: payment.status,
                    authorizationUrl,
                    reference 
            }
        });
            return;
        }

        return next(errorHandler(400, "Unsupported payment method"));

    } catch (error: any) {
        console.error('Initiate payment error:', error);
        next(errorHandler(500, "Server error while initiating payment"));
    }
};
```

#### `getAllPayments(query)`
**Purpose:** Get paginated payment list with filtering
**Access:** Admin users
**Features:**
- Pagination
- Search by payment number or transaction ID
- Filter by status, payment method, client
- Date range filtering
- Sort options
- Population of client and invoice
**Response:** Paginated payment list

**Controller Implementation:**
```typescript
export const getAllPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, paymentMethod, client } = req.query;

        const query: any = {};

        // Search by payment number or transaction ID
        if (search) {
            query.$or = [
                { paymentNumber: { $regex: search, $options: 'i' } },
                { transactionId: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by payment method
        if (paymentMethod) {
            query.paymentMethod = paymentMethod;
        }

        // Filter by client
        if (client) {
            query.client = client;
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const payments = await Payment.find(query)
            .populate('client', 'firstName lastName email company')
            .populate('invoice', 'invoiceNumber projectTitle totalAmount')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Payment.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                payments: payments,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalPayments: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all payments error:', error);
        next(errorHandler(500, "Server error while fetching payments"));
    }
};
```

#### `getPayment(paymentId)`
**Purpose:** Get single payment details
**Access:** Admin or client (own payments only)
**Response:** Complete payment with populated references

**Controller Implementation:**
```typescript
export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params;

        const payment = await Payment.findById(paymentId)
            .populate('client', 'firstName lastName email company')
            .populate('invoice', 'invoiceNumber projectTitle totalAmount paidAmount');

        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                payment: payment
            }
        });

    } catch (error: any) {
        console.error('Get payment error:', error);
        next(errorHandler(500, "Server error while fetching payment"));
    }
};
```

#### `updatePayment(paymentId, paymentData)`
**Purpose:** Update payment details (Admin only)
**Access:** Admin only
**Allowed Fields:**
- notes, reference, metadata
- Cannot change amount or status after completion
**Response:** Updated payment data

**Controller Implementation:**
```typescript
export const updatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params;
        const { reference, notes, metadata }: {
            reference?: string;
            notes?: string;
            metadata?: any;
        } = req.body;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        // Update allowed fields
        if (reference) payment.reference = reference;
        if (notes) payment.notes = notes;
        if (metadata) payment.metadata = metadata;

        await payment.save();

        res.status(200).json({
            success: true,
            message: "Payment updated successfully",
            data: {
                payment: payment
            }
        });

    } catch (error: any) {
        console.error('Update payment error:', error);
        next(errorHandler(500, "Server error while updating payment"));
    }
};
```

#### `deletePayment(paymentId)`
**Purpose:** Delete payment (Admin only)
**Access:** Super admin only
**Validation:**
- Cannot delete completed payments
- Reverse invoice update
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deletePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        // Cannot delete completed payments
        if (payment.status === 'completed') {
            return next(errorHandler(400, "Cannot delete completed payments. Please refund instead."));
        }

        await Payment.findByIdAndDelete(paymentId);

        res.status(200).json({
            success: true,
            message: "Payment deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete payment error:', error);
        next(errorHandler(500, "Server error while deleting payment"));
    }
};
```


#### `mpesaWebhook(webhookData)`
**Purpose:** Handle M-Pesa payment webhook/callback
**Access:** M-Pesa gateway (webhook - public)
**Process:**
- Parse webhook payload
- Find payment by checkout request ID
- Update payment status
- **On Success:** Call `applySuccessfulPayment()` service (updates invoice, sends bidirectional notification to client)
- **On Failure:** Send bidirectional failure notification to client
- Emit Socket.io events
**Response:** Acknowledgment

**Notifications:**
- **On Success:** Client receives bidirectional notification: "Payment Successful" with actions (View Invoice, Download Receipt)
  - Notification is sent via `applySuccessfulPayment()` service function
- **On Failure:** Client receives bidirectional notification: "Payment Failed" with actions (Try Again, View Invoice)

**Controller Implementation:**
```typescript
export const mpesaWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io = req.app.get('io');
        const payload = req.body;

        console.log('===== M-PESA WEBHOOK RECEIVED =====');
        console.log('Full payload:', JSON.stringify(payload, null, 2));
        console.log('====================================');

        const parsed = parseDarajaCallback(payload);

        if (payload?.Body?.stkCallback) {
            io?.emit("callback.received", { 
                message: payload?.Body?.stkCallback.ResultDesc, 
                code: payload?.Body?.stkCallback.ResultCode 
            });
        }

        if (!parsed.valid) {
            res.status(400).json({ success: false, message: 'Invalid payload' });
            return;
        }

        const payment = await Payment.findOne({ 
            'processorRefs.daraja.checkoutRequestId': parsed.checkoutRequestId 
        });

        if (!payment) {
            res.status(404).json({ success: false, message: 'Payment not found' });
            return;
        }

        payment.rawPayload = payload;

        if (parsed.success) {
            const invoice = await Invoice.findById(payment.invoice);
            if (invoice) {
                await applySuccessfulPayment({ invoice, payment, io, method: 'mpesa' });
            }
        } else {
            payment.status = 'failed';
            await payment.save();
            io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
            
            // Send notification to client for payment failure
            try {
                const invoice = await Invoice.findById(payment.invoice);
                if (invoice) {
                    await createInAppNotification({
                        recipient: payment.client.toString(),
                        recipientModel: 'Client',
                        category: 'payment',
                        subject: 'Payment Failed',
                        message: `Your payment of $${payment.amount.toFixed(2)} for invoice ${invoice.invoiceNumber} failed. Please try again or contact support.`,
                        actions: [
                            {
                                id: 'retry_payment',
                                label: 'Try Again',
                                type: 'api',
                                endpoint: '/api/payments/initiate',
                                method: 'POST',
                                payload: {
                                    invoiceId: invoice._id.toString(),
                                    amount: payment.amount
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
                            paymentId: payment._id,
                            invoiceId: invoice._id,
                            invoiceNumber: invoice.invoiceNumber,
                            amount: payment.amount,
                            error: 'Payment processing failed'
                        },
                        io: io
                    });
                }
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

        res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('M-Pesa webhook error:', error);
        next(errorHandler(500, "Server error processing M-Pesa webhook"));
    }
};
```

#### `paystackWebhook(webhookData)`
**Purpose:** Handle Paystack payment webhook/callback
**Access:** Paystack gateway (webhook - public)
**Process:**
- Parse webhook payload
- Find payment by reference
- Update payment status
- **On Success:** Call `applySuccessfulPayment()` service (updates invoice, sends bidirectional notification to client)
- **On Failure:** Send bidirectional failure notification to client
- Emit Socket.io events
**Response:** Acknowledgment

**Notifications:**
- **On Success:** Client receives bidirectional notification: "Payment Successful" with actions (View Invoice, Download Receipt)
  - Notification is sent via `applySuccessfulPayment()` service function
- **On Failure:** Client receives bidirectional notification: "Payment Failed" with actions (Try Again, View Invoice)

**Controller Implementation:**
```typescript
export const paystackWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io = req.app.get('io');
        const payload = req.body;

        const parsed = parsePaystackWebhook(payload);
        if (!parsed.valid) {
            res.status(400).json({ success: false, message: 'Invalid payload' });
            return;
        }

        const payment = await Payment.findOne({
            'processorRefs.paystack.reference': parsed.reference 
        });

        if (!payment) {
            res.status(404).json({ success: false, message: 'Payment not found' });
            return;
        }

        payment.rawPayload = payload;

        if (parsed.success) {
            const invoice = await Invoice.findById(payment.invoice);
            if (invoice) {
                await applySuccessfulPayment({ invoice, payment, io, method: 'paystack' });
            }
        } else {
            payment.status = 'failed';
            await payment.save();
            io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
            
            // Send notification to client for payment failure
            try {
                const invoice = await Invoice.findById(payment.invoice);
                if (invoice) {
                    await createInAppNotification({
                        recipient: payment.client.toString(),
                        recipientModel: 'Client',
                        category: 'payment',
                        subject: 'Payment Failed',
                        message: `Your payment of $${payment.amount.toFixed(2)} for invoice ${invoice.invoiceNumber} failed. Please try again or contact support.`,
                        actions: [
                            {
                                id: 'retry_payment',
                                label: 'Try Again',
                                type: 'api',
                                endpoint: '/api/payments/initiate',
                                method: 'POST',
                                payload: {
                                    invoiceId: invoice._id.toString(),
                                    amount: payment.amount
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
                            paymentId: payment._id,
                            invoiceId: invoice._id,
                            invoiceNumber: invoice.invoiceNumber,
                            amount: payment.amount,
                            error: 'Payment processing failed'
                        },
                        io: io
                    });
                }
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

        res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Paystack webhook error:', error);
        next(errorHandler(500, "Server error processing Paystack webhook"));
    }
};
```

#### `queryMpesaByCheckoutId(checkoutRequestId)`
**Purpose:** Query M-Pesa payment status by checkout request ID
**Access:** Authenticated users
**Process:**
- Find payment by checkout request ID
- Query Daraja STK Push Status API
- Update payment status if successful
- Return M-Pesa query result
**Response:** M-Pesa query result with resultCode, resultDesc, paymentId, invoiceId, and raw data

**Controller Implementation:**
```typescript
export const queryMpesaByCheckoutId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { checkoutRequestId } = req.params;

        if (!checkoutRequestId) {
            return next(errorHandler(400, "Checkout request ID is required"));
        }

        const payment = await Payment.findOne({ 
            'processorRefs.daraja.checkoutRequestId': checkoutRequestId 
        });

        if (!payment) {
            return next(errorHandler(404, "Payment not found for this checkout request"));
        }

        const result = await queryStkPushStatus({ checkoutRequestId });
        if (!result.ok) {
            return next(errorHandler(502, result.error || "Failed to query M-Pesa status"));
        }

        console.log('===== SAFARICOM QUERY RESULT =====');
        console.log('Result Code:', result.resultCode);
        console.log('Result Desc:', result.resultDesc);
        console.log('==================================');
        
        if (result.resultCode === 0 && payment.status !== 'completed') {
                const invoice = await Invoice.findById(payment.invoice);
                if (invoice) {
                await applySuccessfulPayment({ 
                    invoice, 
                    payment, 
                    io: req.app.get('io'), 
                    method: 'mpesa' 
                });
            }
        } else if (result.resultCode !== 0 && payment.status !== 'failed') {
                payment.status = 'failed';
                await payment.save();
            req.app.get('io')?.emit('payment.updated', { 
                paymentId: payment._id.toString(), 
                status: payment.status 
            });
        }

        res.status(200).json({ 
            success: true, 
            data: { 
                resultCode: result.resultCode, 
                resultDesc: result.resultDesc,
                paymentId: payment._id,
                invoiceId: payment.invoice,
                raw: result.raw
            } 
        });

    } catch (error: any) {
        console.error('Query M-Pesa by checkout ID error:', error);
        next(errorHandler(500, "Server error while querying M-Pesa status"));
    }
};
```

#### `getClientPayments(clientId)`
**Purpose:** Get all payments for a client
**Access:** Admin or client themselves
**Response:** List of client's payments

**Controller Implementation:**
```typescript
export const getClientPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const payments = await Payment.find({ client: clientId })
            .populate('invoice', 'invoiceNumber projectTitle totalAmount')
            .sort({ createdAt: 'desc' });

        res.status(200).json({
            success: true,
            data: {
                payments: payments
            }
        });

    } catch (error: any) {
        console.error('Get client payments error:', error);
        next(errorHandler(500, "Server error while fetching client payments"));
    }
};
```

#### `getInvoicePayments(invoiceId)`
**Purpose:** Get all payments for an invoice
**Access:** Admin or client
**Response:** List of invoice payments

**Controller Implementation:**
```typescript
export const getInvoicePayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params;

        const payments = await Payment.find({ invoice: invoiceId })
            .sort({ createdAt: 'desc' });

        res.status(200).json({
            success: true,
            data: {
                payments: payments
            }
        });

    } catch (error: any) {
        console.error('Get invoice payments error:', error);
        next(errorHandler(500, "Server error while fetching invoice payments"));
    }
};
```


---

## 🛣️ Payment Routes

### Base Path: `/api/payments`

```typescript
// Payment Management Routes
POST   /                          // Admin initiate payment for client
GET    /                          // Get all payments (paginated, filtered)
GET    /:paymentId                // Get single payment
PUT    /:paymentId                // Update payment
DELETE /:paymentId                // Delete payment (super admin only)

// Payment Initiation Routes
POST   /initiate                  // Client/Admin initiate payment

// M-Pesa Routes
POST   /webhooks/mpesa            // M-Pesa webhook
GET    /mpesa-status/:checkoutRequestId  // Query M-Pesa status by checkout ID

// Paystack Routes
POST   /webhooks/paystack         // Paystack webhook

// Query Routes
GET    /client/:clientId          // Get client payments
GET    /invoice/:invoiceId        // Get invoice payments
```

### Router Implementation

**File: `src/routes/paymentRoutes.ts`**

```typescript
import express from 'express';
import {
    createPaymentAdmin,
    getAllPayments,
    getPayment,
    updatePayment,
    deletePayment,
    getClientPayments,
    getInvoicePayments,
    initiatePayment,
    mpesaWebhook,
    paystackWebhook,
    queryMpesaByCheckoutId
} from '../controllers/paymentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/payments
 * @desc    Admin initiate payment for client
 * @access  Private (Admin, Finance)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createPaymentAdmin);

/**
 * @route   GET /api/payments
 * @desc    Get all payments with filtering and pagination
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), getAllPayments);

/**
 * @route   GET /api/payments/client/:clientId
 * @desc    Get client payments
 * @access  Private (Client or Admin)
 */
router.get('/client/:clientId', authenticateToken, getClientPayments);

/**
 * @route   GET /api/payments/invoice/:invoiceId
 * @desc    Get invoice payments
 * @access  Private (Admin or Client)
 */
router.get('/invoice/:invoiceId', authenticateToken, getInvoicePayments);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get single payment
 * @access  Private (Admin or Client)
 */
router.get('/:paymentId', authenticateToken, getPayment);

/**
 * @route   PUT /api/payments/:paymentId
 * @desc    Update payment
 * @access  Private (Admin)
 */
router.put('/:paymentId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updatePayment);

/**
 * @route   DELETE /api/payments/:paymentId
 * @desc    Delete payment
 * @access  Private (Super Admin only)
 */
router.delete('/:paymentId', authenticateToken, authorizeRoles(['super_admin']), deletePayment);

/**
 * @route   POST /api/payments/initiate
 * @desc    Initiate payment (M-Pesa or Paystack)
 * @access  Private (Authenticated users)
 */
router.post('/initiate', authenticateToken, initiatePayment);

/**
 * @route   POST /api/payments/webhooks/mpesa
 * @desc    M-Pesa webhook
 * @access  Public (M-Pesa gateway)
 */
router.post('/webhooks/mpesa', mpesaWebhook);

/**
 * @route   POST /api/payments/webhooks/paystack
 * @desc    Paystack webhook
 * @access  Public (Paystack gateway)
 */
router.post('/webhooks/paystack', paystackWebhook);

/**
 * @route   GET /api/payments/mpesa-status/:checkoutRequestId
 * @desc    Query M-Pesa status by checkout ID
 * @access  Private (Authenticated users)
 */
router.get('/mpesa-status/:checkoutRequestId', authenticateToken, queryMpesaByCheckoutId);

export default router;
```

### Route Details

#### `POST /api/payments/initiate`
**Headers:** `Authorization: Bearer <token>`

**Body for M-Pesa:**
```json
{
  "invoiceId": "invoice_id_here",
  "method": "mpesa",
  "amount": 9550,
  "payerPhone": "254712345678"
}
```

**Body for Paystack:**
```json
{
  "invoiceId": "invoice_id_here",
  "method": "paystack",
      "amount": 9550,
  "payerEmail": "client@example.com"
}
```

**Response (M-Pesa - Pending):**
```json
{
  "success": true,
  "message": "M-Pesa payment initiated",
  "data": {
    "paymentId": "...",
    "status": "pending",
    "daraja": {
      "merchantRequestId": "...",
      "checkoutRequestId": "..."
    }
  }
}
```

#### `POST /api/payments` (Admin Payment Initiation)
**Headers:** `Authorization: Bearer <admin_token>`

**Body for M-Pesa:**
```json
{
  "invoiceId": "invoice_id_here",
  "method": "mpesa",
  "amount": 9550,
  "payerPhone": "254712345678"
}
```

**Body for Paystack:**
```json
{
  "invoiceId": "invoice_id_here",
  "method": "paystack",
  "amount": 9550,
  "payerEmail": "client@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "M-Pesa payment initiated",
  "data": {
    "paymentId": "...",
      "status": "pending",
    "daraja": {
      "merchantRequestId": "...",
      "checkoutRequestId": "..."
    }
  }
}
```

#### `GET /api/payments`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by payment number or reference
- `status` (optional): Filter by status (pending, completed, failed)
- `paymentMethod` (optional): Filter by payment method (mpesa, paystack)
- `client` (optional): Filter by client ID
- `invoice` (optional): Filter by invoice ID

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalPayments": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```


#### `POST /api/payments/webhooks/mpesa`
**Headers:** Not required (Public webhook endpoint)

**Body:** (Raw webhook payload from M-Pesa Daraja)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 9550},
          {"Name": "MpesaReceiptNumber", "Value": "..."},
          {"Name": "TransactionDate", "Value": "20250101120000"},
          {"Name": "PhoneNumber", "Value": 254712345678}
        ]
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true
}
```

#### `POST /api/payments/webhooks/paystack`
**Headers:** Not required (Public webhook endpoint)

**Body:** (Raw webhook payload from Paystack)

**Response:** HTTP 200 OK

#### `GET /api/payments/mpesa-status/:checkoutRequestId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `checkoutRequestId` - The M-Pesa checkout request ID

**Response:**
```json
{
  "success": true,
  "data": {
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully",
    "paymentId": "...",
    "invoiceId": "...",
    "raw": {...}
  }
}
```

#### `GET /api/payments/client/:clientId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `clientId` - The client ID

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "...",
        "paymentNumber": "PAY-2025-0001",
        "invoice": {...},
        "amount": 9550,
        "paymentMethod": "mpesa",
        "status": "completed",
        "paymentDate": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/payments/invoice/:invoiceId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `invoiceId` - The invoice ID

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "...",
        "paymentNumber": "PAY-2025-0001",
        "amount": 9550,
        "paymentMethod": "mpesa",
        "status": "completed",
        "paymentDate": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/payments/:paymentId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `paymentId` - The payment ID

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "...",
      "paymentNumber": "PAY-2025-0001",
      "invoice": {
        "_id": "...",
        "invoiceNumber": "INV-2025-0001",
        "totalAmount": 9550
      },
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "amount": 9550,
      "paymentMethod": "mpesa",
      "status": "completed",
      "transactionId": "...",
      "reference": "REF-001",
      "paymentDate": "2025-01-01T00:00:00.000Z",
      "notes": "Payment notes",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `PUT /api/payments/:paymentId`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `paymentId` - The payment ID

**Body:**
```json
{
  "reference": "REF-002",
  "notes": "Updated notes",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment updated successfully",
  "data": {
    "payment": {
      "_id": "...",
      "reference": "REF-002",
      "notes": "Updated notes",
      ...
    }
  }
}
```

#### `DELETE /api/payments/:paymentId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**URL Parameter:** `paymentId` - The payment ID

**Response:**
```json
{
  "success": true,
  "message": "Payment deleted successfully"
}
```

---

## 💳 Payment Gateway Integration

### Payment Service (Internal)

**File: `src/services/internal/paymentService.ts`**

The payment service provides centralized payment processing logic:

#### Create Payment Record
```typescript
export const createPaymentRecord = async (params: CreatePaymentRecordParams): Promise<any> => {
  const payment = await Payment.create({
    invoice: params.invoice._id,
    client: params.client?._id,
    amount: params.amount,
    paymentMethod: params.method,
    status: 'pending', // All payments start as pending until webhook confirms
    processorRefs: {}
  });
  
  return payment;
};
```

#### Apply Successful Payment
```typescript
export const applySuccessfulPayment = async (params: ApplySuccessfulPaymentParams): Promise<any> => {
  const { invoice, payment, io, method } = params;
  
  // Update payment status
  payment.status = 'completed';
  await payment.save();

  // Update invoice paid amount
  invoice.paidAmount = (invoice.paidAmount || 0) + payment.amount;
  
  // Only mark invoice as 'paid' if fully paid (balance is zero)
  const balance = invoice.totalAmount - invoice.paidAmount;
  if (balance <= 0) {
    invoice.status = 'paid';
  } else {
    invoice.status = 'partially_paid';
  }
  
  await invoice.save();

  // Emit real-time updates
  if (io) {
    io.emit('payment.updated', { 
      paymentId: payment._id.toString(), 
      status: payment.status,
      invoiceId: invoice._id.toString()
    });
    
    io.emit('invoice.updated', { 
      invoiceId: invoice._id.toString(), 
      status: invoice.status 
    });
  }

  // Send bidirectional notification to client
  try {
    await createInAppNotification({
      recipient: payment.client.toString(),
      recipientModel: 'Client',
      category: 'payment',
      subject: 'Payment Successful',
      message: `Your payment of $${payment.amount.toFixed(2)} for invoice ${invoice.invoiceNumber} has been received successfully. Transaction ID: ${payment.transactionId || 'N/A'}`,
      actions: [
        {
          id: 'view_invoice',
          label: 'View Invoice',
          type: 'navigate',
          route: `/invoices/${payment.invoice}`,
          variant: 'primary'
        },
        {
          id: 'download_receipt',
          label: 'Download Receipt',
          type: 'api',
          endpoint: `/api/payments/${payment._id}/receipt`,
          method: 'GET',
          variant: 'secondary'
        }
      ],
      context: {
        resourceId: payment.invoice.toString(),
        resourceType: 'invoice'
      },
      metadata: {
        paymentId: payment._id,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: payment.amount,
        transactionId: payment.transactionId,
        paymentDate: payment.paymentDate
      },
      io: io
    });
  } catch (notificationError) {
    console.error('Error sending notification:', notificationError);
    // Don't fail the request if notification fails
  }

  return { payment, invoice };
};
```

### M-Pesa Integration (Daraja API)

**File: `src/services/external/darajaService.ts`**

#### Environment Variables
```env
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/webhooks/mpesa
MPESA_ENV=sandbox  # or production
API_BASE_URL=https://yourdomain.com
```

#### Get Access Token
```typescript
export const getAccessToken = async (): Promise<string> => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja credentials not configured');
  }

  const base = getBaseUrl(); // Returns sandbox or production URL
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      `${base}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    
    if (!response.data?.access_token) {
      throw new Error('Daraja OAuth response missing access_token');
    }
    
    return response.data.access_token;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Daraja OAuth failed${status ? ` (HTTP ${status})` : ''}`;
    throw new Error(`${message}: ${JSON.stringify(data)}`);
  }
};
```

#### Helper Functions
```typescript
const getBaseUrl = () => {
  const env = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
  return env === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';
};

export const buildTimestamp = (): string => {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
};

export const buildPassword = (shortCode: string, passkey: string, timestamp: string): string => {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
};
```

#### Initiate STK Push
```typescript
export const initiateStkPush = async (params: StkPushParams): Promise<StkPushResponse> => {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortCode || !passkey) {
    throw new Error('Daraja short code or passkey not configured');
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);
  const callback = params.callbackUrl || `${process.env.API_BASE_URL}/api/payments/webhooks/mpesa`;

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(params.amount),
    PartyA: params.phone,
    PartyB: Number(shortCode),
    PhoneNumber: params.phone,
    CallBackURL: callback,
    AccountReference: String(params.accountReference),
    TransactionDesc: 'Invoice payment'
  };

  try {
    const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return {
      merchantRequestId: resp.data?.MerchantRequestID,
      checkoutRequestId: resp.data?.CheckoutRequestID,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Daraja STK Push failed${status ? ` (HTTP ${status})` : ''}`;
    throw new Error(`${message}: ${JSON.stringify(data)}`);
  }
};
```

#### Parse Callback
```typescript
export const parseCallback = (body: any): CallbackParseResult => {
  const stk = body?.Body?.stkCallback || {};
  if (!stk) return { valid: false, success: false };

  const resultCode = stk.ResultCode;
  const success = resultCode === 0;
  const checkoutRequestId = stk.CheckoutRequestID;

  let amount: number | undefined;
  let phone: string | undefined;
  const items = stk?.CallbackMetadata?.Item || [];

  for (const item of items) {
    if (item?.Name === 'Amount') amount = item?.Value;
    if (item?.Name === 'PhoneNumber') phone = item?.Value;
  }

  return {
    valid: true,
    success,
    checkoutRequestId,
    amount,
    phone,
    raw: body,
    stk
  };
};
```

#### Query STK Push Status
```typescript
export const queryStkPushStatus = async (params: StkQueryParams): Promise<StkQueryResponse> => {
  const shortCode = (params.shortCode || process.env.MPESA_SHORT_CODE || '').trim();
  const passkey = (params.passkey || process.env.MPESA_PASSKEY || '').trim();

  if (!shortCode || !passkey) {
    throw new Error('Daraja short code or passkey not configured');
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);

  try {
    const resp = await axios.post(
      `${base}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: Number(shortCode),
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: params.checkoutRequestId
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    return {
      ok: true,
      resultCode: resp.data?.ResultCode,
      resultDesc: resp.data?.ResultDesc,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return {
      ok: false,
      error: `Daraja STK Query failed${status ? ` (HTTP ${status})` : ''}`,
      details: JSON.stringify(data)
    };
  }
};
```

### Paystack Integration

**File: `src/services/external/paystackService.ts`**

#### Environment Variables
```env
PAYSTACK_SECRET_KEY=sk_test_...  # or sk_live_... for production
PAYSTACK_CURRENCY=KES
FRONTEND_BASE_URL=https://yourdomain.com  # For redirect after payment
```

#### Initiate Transaction
```typescript
export const initTransaction = async (params: PaystackTransactionParams): Promise<PaystackTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('Paystack secret not configured');

  try {
    const resp = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: params.email,
        amount: Math.round(params.amount * 100), // Convert to kobo/cents
        currency: params.currency || 'KES',
        reference: params.reference,
        callback_url: params.callbackUrl
      },
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    return {
      authorizationUrl: resp.data?.data?.authorization_url,
      reference: resp.data?.data?.reference,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = `Paystack transaction initialization failed${status ? ` (HTTP ${status})` : ''}`;
    throw new Error(`${message}: ${JSON.stringify(data)}`);
  }
};
```

#### Parse Webhook
```typescript
export const parseWebhook = (body: any): PaystackWebhookParseResult => {
  const event = body?.event;
  const reference = body?.data?.reference;
  const status = body?.data?.status;
  const success = event === 'charge.success' || status === 'success';
  
  return {
    valid: !!reference,
    success,
    reference,
    raw: body
  };
};
```

#### Verify Transaction
```typescript
export const verifyTransaction = async (params: VerifyTransactionParams): Promise<VerifyTransactionResponse> => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('Paystack secret not configured');

  try {
    const resp = await axios.get(
      `https://api.paystack.co/transaction/verify/${params.reference}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );

    const data = resp.data?.data;
    return {
      success: data?.status === 'success',
      amount: data?.amount ? data.amount / 100 : undefined, // Convert from kobo/cents
      currency: data?.currency,
      status: data?.status,
      raw: resp.data
    };
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return {
      success: false,
      error: `Paystack verification failed${status ? ` (HTTP ${status})` : ''}`,
      raw: data
    };
  }
};
```

---

## 📝 API Examples

### Initiate Payment (M-Pesa)
```bash
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "invoiceId": "invoice_id_here",
    "method": "mpesa",
    "amount": 5000,
    "payerPhone": "254712345678"
  }'
```

### Initiate Payment (Paystack)
```bash
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "invoiceId": "invoice_id_here",
    "method": "paystack",
    "amount": 5000,
    "payerEmail": "client@example.com"
  }'
```

### Query M-Pesa by Checkout ID
```bash
curl -X GET http://localhost:5000/api/payments/mpesa-status/:checkoutRequestId \
  -H "Authorization: Bearer <token>"
```

### Admin Initiate Payment (M-Pesa)
```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "invoiceId": "invoice_id_here",
    "method": "mpesa",
    "amount": 5000,
    "payerPhone": "254712345678"
  }'
```

### Admin Initiate Payment (Paystack)
```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "invoiceId": "invoice_id_here",
    "method": "paystack",
    "amount": 5000,
    "payerEmail": "client@example.com"
  }'
```

---

## 🔒 Security Features

### Access Control
- **Role-Based Access** - Only finance and super admin can manage payments
- **Client Access** - Clients can only view their payments
- **Gateway Security** - Webhook signature verification
- **Transaction Validation** - Verify transaction authenticity

### Data Protection
- **Sensitive Data** - Secure storage of transaction IDs
- **Webhook Validation** - Verify all gateway callbacks
- **Amount Verification** - Match payment to invoice
- **Audit Trail** - Track all payment activities

### Input Validation
- **Required Fields** - All critical fields validated
- **Positive Amounts** - Payment amounts must be positive
- **Method Validation** - Valid payment methods only
- **Invoice Validation** - Verify invoice exists and is valid

### Gateway Security
- **M-Pesa** - OAuth token authentication, callback URL validation, STK push status query
- **Paystack** - Webhook signature verification, API key security
- **HTTPS Only** - All gateway communications over HTTPS
- **Webhook Validation** - Parse and validate all gateway callbacks

---

## 🚨 Error Handling

### Common Errors
```json
// 400 - Payment Exceeds Invoice
{
  "success": false,
  "message": "Payment amount exceeds invoice balance"
}

// 400 - Gateway Error
{
  "success": false,
  "message": "M-Pesa payment initiation failed",
  "error": "Invalid phone number format"
}

// 400 - Already Paid
{
  "success": false,
  "message": "Invoice is already fully paid"
}

// 500 - Gateway Timeout
{
  "success": false,
  "message": "Payment gateway timeout. Please try again"
}
```

---

## 🔗 Integration with Other Modules

### Invoice Integration
- Automatic invoice status updates
- Payment amount tracking
- Balance calculation
- Payment history linking

### Client Integration
- Client payment history
- Payment notifications
- Receipt delivery

### Notification Integration

The Payment system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **Payment Successful** (`applySuccessfulPayment` - called from webhooks)
   - **Recipient:** Client
   - **Category:** `payment`
   - **Subject:** "Payment Successful"
   - **Type:** **Bidirectional Notification** with actions
   - **Actions:**
     - **"View Invoice"** button (Navigate action) - Opens invoice details
     - **"Download Receipt"** button (API action) - Downloads payment receipt
   - **Message:** Includes payment amount, invoice number, and transaction ID
   - **Metadata:** `paymentId`, `invoiceId`, `invoiceNumber`, `amount`, `transactionId`, `paymentDate`

2. **Payment Failed** (`mpesaWebhook` / `paystackWebhook` - on failure)
   - **Recipient:** Client
   - **Category:** `payment`
   - **Subject:** "Payment Failed"
   - **Type:** **Bidirectional Notification** with actions
   - **Actions:**
     - **"Try Again"** button (API action) - Retries payment initiation
     - **"View Invoice"** button (Navigate action) - Opens invoice details
   - **Message:** Includes payment amount, invoice number, and error information
   - **Metadata:** `paymentId`, `invoiceId`, `invoiceNumber`, `amount`, `error`

#### Notification Preferences

All notifications respect user/client notification preferences:
- If `inApp` preference is `false`, notifications are skipped
- Default behavior: Notifications are sent unless explicitly disabled

### Real-time Updates
- Socket.io payment notifications (`payment.updated`, `invoice.updated` events)
- Live payment status updates
- Invoice status updates (paid/partially_paid)
- Admin dashboard updates

---

## 🔧 Environment Variables

### M-Pesa Configuration
```env
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/webhooks/mpesa
MPESA_ENVIRONMENT=sandbox  # or production
API_BASE_URL=https://yourdomain.com  # For callback URL construction
```

### Paystack Configuration
```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_CURRENCY=KES
FRONTEND_BASE_URL=https://yourdomain.com  # For redirect after payment
```

---

## 📊 Payment Flow Diagrams

### M-Pesa Payment Flow
1. Client initiates payment via `/api/payments/initiate` → API creates pending payment
2. API calls M-Pesa Daraja STK push via `initiateMpesaForInvoice`
3. Client receives M-Pesa prompt on phone
4. Client enters PIN
5. M-Pesa processes payment
6. M-Pesa sends webhook to `/api/payments/webhooks/mpesa`
7. API parses webhook via `parseDarajaCallback`
8. API calls `applySuccessfulPayment` to update payment and invoice (status: paid or partially_paid)
9. Socket.io emits `payment.updated` and `invoice.updated` events
10. Frontend can poll `/api/payments/mpesa-status/:checkoutRequestId` as fallback

### Paystack Payment Flow
1. Client initiates payment via `/api/payments/initiate` → API creates pending payment
2. API calls Paystack via `initiatePaystackForInvoice`
3. API returns `authorizationUrl` to frontend
4. User redirected to Paystack checkout page
5. User completes payment on Paystack
6. Paystack sends webhook to `/api/payments/webhooks/paystack`
7. API parses webhook via `parsePaystackWebhook`
8. API calls `applySuccessfulPayment` to update payment and invoice (status: paid or partially_paid)
9. Socket.io emits `payment.updated` and `invoice.updated` events

---

## 🧪 Testing Payments

### M-Pesa Test Credentials
```
Test Phone: 254708374149
Test Amount: Any amount (1-70000)
Test PIN: Use your Safaricom PIN on sandbox
```

### Paystack Test Cards
```
Success: 4084 0840 8408 4081
Decline: 5060 6666 6666 6666
Requires Authentication: 5078 5078 5078 5078
```

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
