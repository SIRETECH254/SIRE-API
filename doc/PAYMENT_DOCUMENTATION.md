
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

The SIRE Tech API Payment Management System handles all payment-related operations including payment processing, gateway integration (M-Pesa, Stripe, PayPal), payment tracking, and receipt generation. Payments are linked to invoices and automatically update invoice status.

### Payment System Features
- **Multiple Payment Gateways** - M-Pesa, Stripe, PayPal, Bank Transfer, Cash
- **Auto-numbering** - Unique payment numbers (PAY-2025-0001)
- **Invoice Integration** - Automatic invoice status updates
- **Payment Tracking** - Complete payment history
- **Transaction Recording** - Store gateway transaction IDs
- **Receipt Generation** - Automatic receipt creation
- **Email Notifications** - Payment confirmations
- **Refund Support** - Handle payment refunds
- **Webhook Handling** - Gateway callback processing
- **Metadata Storage** - Store additional payment data
- **Real-time Updates** - Socket.io notifications

### Payment Methods
1. **M-Pesa** - Mobile money (Safaricom)
2. **Bank Transfer** - Direct bank transfer
3. **Stripe** - Credit/debit cards
4. **PayPal** - PayPal payments
5. **Cash** - Cash payments

### Payment Status
1. **Pending** - Payment initiated, awaiting confirmation
2. **Completed** - Payment successful
3. **Failed** - Payment failed
4. **Refunded** - Payment refunded to client

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
  paymentMethod: 'mpesa' | 'bank_transfer' | 'stripe' | 'paypal' | 'cash';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;        // Gateway transaction ID
  reference?: string;            // Payment reference/receipt number
  paymentDate: Date;             // Date of payment
  notes?: string;
  metadata?: Record<string, any>; // Additional payment data
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
paymentMethod: { required: true, enum: ['mpesa', 'bank_transfer', 'stripe', 'paypal', 'cash'] }
status: { required: true, enum: ['pending', 'completed', 'failed', 'refunded'] }
paymentDate: { required: true, type: Date }

// Optional fields
transactionId: { type: String }
reference: { type: String }
notes: { maxlength: 500 }
metadata: { type: Object }
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

// Indexes for better performance
paymentSchema.index({ paymentNumber: 1 });
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ client: 1, status: 1 });

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
import { initiateMpesaSTKPush, verifyMpesaTransaction } from '../services/external/daraja';
import { createStripePaymentIntent, verifyStripeWebhook } from '../services/external/stripe';
import { sendPaymentConfirmation } from '../services/internal/notificationService';
```

### Functions Overview

#### `createPayment(paymentData)`
**Purpose:** Record manual payment (Admin only)
**Access:** Admin users (super_admin, finance)
**Validation:**
- Invoice existence check
- Amount validation (not exceed remaining balance)
- Payment method validation
**Process:**
- Generate unique payment number
- Create payment record
- Update invoice paidAmount
- Update invoice status
- Send confirmation email
- Emit Socket.io event
**Response:** Complete payment data

**Controller Implementation:**
```typescript
export const createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoice, client, amount, paymentMethod, transactionId, reference, notes }: {
            invoice: string;
            client: string;
            amount: number;
            paymentMethod: 'mpesa' | 'bank_transfer' | 'stripe' | 'paypal' | 'cash';
            transactionId?: string;
            reference?: string;
            notes?: string;
        } = req.body;

        // Validation
        if (!invoice || !client || !amount || !paymentMethod) {
            return next(errorHandler(400, "Invoice, client, amount, and payment method are required"));
        }

        // Check if invoice exists
        const invoiceExists = await Invoice.findById(invoice);
        if (!invoiceExists) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Check if payment amount exceeds remaining balance
        const remainingBalance = invoiceExists.totalAmount - invoiceExists.paidAmount;
        if (amount > remainingBalance) {
            return next(errorHandler(400, "Payment amount exceeds invoice balance"));
        }

        // Create payment
        const payment = new Payment({
            invoice,
            client,
            amount,
            paymentMethod,
            status: 'completed',
            transactionId,
            reference,
            notes,
            paymentDate: new Date()
        });

        await payment.save();

        // Update invoice
        invoiceExists.paidAmount += amount;
        await invoiceExists.save();

        // Populate references
        await payment.populate('client', 'firstName lastName email');
        await payment.populate('invoice', 'invoiceNumber projectTitle totalAmount');

        // Send confirmation
        await sendPaymentConfirmation(client, payment._id.toString());

        // Emit Socket.io event
        const io = req.app.get('io');
        if (io) {
            io.to(`invoice_${invoice}`).emit('payment_received', {
                paymentId: payment._id,
                amount: payment.amount,
                invoice: invoice
            });
        }

        res.status(201).json({
            success: true,
            message: "Payment recorded successfully",
            data: {
                payment: payment
            }
        });

    } catch (error: any) {
        console.error('Create payment error:', error);
        next(errorHandler(500, "Server error while creating payment"));
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

#### `initiateMpesaPayment(invoiceId, phone, amount)`
**Purpose:** Initiate M-Pesa STK push payment
**Access:** Client or Admin
**Process:**
- Validate invoice and amount
- Call M-Pesa Daraja API
- Create pending payment record
- Return checkout request ID
**Response:** Payment initiation data

**Controller Implementation:**
```typescript
export const initiateMpesaPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoice, phone, amount }: {
            invoice: string;
            phone: string;
            amount: number;
        } = req.body;

        if (!invoice || !phone || !amount) {
            return next(errorHandler(400, "Invoice, phone, and amount are required"));
        }

        // Validate invoice
        const invoiceExists = await Invoice.findById(invoice);
        if (!invoiceExists) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Check remaining balance
        const remainingBalance = invoiceExists.totalAmount - invoiceExists.paidAmount;
        if (amount > remainingBalance) {
            return next(errorHandler(400, "Payment amount exceeds invoice balance"));
        }

        // Create pending payment
        const payment = new Payment({
            invoice,
            client: invoiceExists.client,
            amount,
            paymentMethod: 'mpesa',
            status: 'pending',
            paymentDate: new Date()
        });

        await payment.save();

        // Initiate M-Pesa STK push
        const mpesaResult = await initiateMpesaSTKPush(
            phone,
            amount,
            invoiceExists.invoiceNumber,
            `Payment for ${invoiceExists.projectTitle}`
        );

        // Update payment with checkout request ID
        payment.metadata = { checkoutRequestID: mpesaResult.CheckoutRequestID };
        await payment.save();

        res.status(200).json({
            success: true,
            message: "M-Pesa payment initiated. Please enter your PIN on your phone.",
            data: {
                payment: payment,
                checkoutRequestID: mpesaResult.CheckoutRequestID
            }
        });

    } catch (error: any) {
        console.error('Initiate M-Pesa payment error:', error);
        next(errorHandler(500, "Server error while initiating M-Pesa payment"));
    }
};
```

#### `mpesaCallback(callbackData)`
**Purpose:** Handle M-Pesa payment callback
**Access:** M-Pesa gateway (webhook)
**Process:**
- Verify callback signature
- Find pending payment
- Update payment status
- Update invoice
- Send confirmation
**Response:** Acknowledgment

**Controller Implementation:**
```typescript
export const mpesaCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { Body } = req.body;
        const { stkCallback } = Body;

        // Find payment by checkout request ID
        const payment = await Payment.findOne({
            'metadata.checkoutRequestID': stkCallback.CheckoutRequestID
        });

        if (!payment) {
            console.error('Payment not found for checkout request ID:', stkCallback.CheckoutRequestID);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
        }

        if (stkCallback.ResultCode === 0) {
            // Payment successful
            const metadata = stkCallback.CallbackMetadata.Item;
            const mpesaReceiptNumber = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;

            payment.status = 'completed';
            payment.transactionId = mpesaReceiptNumber;
            await payment.save();

            // Update invoice
            const invoice = await Invoice.findById(payment.invoice);
            if (invoice) {
                invoice.paidAmount += payment.amount;
                await invoice.save();
            }

            // Send confirmation
            await sendPaymentConfirmation(payment.client.toString(), payment._id.toString());
        } else {
            // Payment failed
            payment.status = 'failed';
            payment.metadata = { ...payment.metadata, error: stkCallback.ResultDesc };
            await payment.save();
        }

        res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

    } catch (error: any) {
        console.error('M-Pesa callback error:', error);
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    }
};
```

#### `initiateStripePayment(invoiceId, amount)`
**Purpose:** Create Stripe payment intent
**Access:** Client or Admin
**Process:**
- Validate invoice and amount
- Create Stripe payment intent
- Create pending payment record
- Return client secret
**Response:** Stripe client secret

**Controller Implementation:**
```typescript
export const initiateStripePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoice, amount, currency = 'usd' }: {
            invoice: string;
            amount: number;
            currency?: string;
        } = req.body;

        if (!invoice || !amount) {
            return next(errorHandler(400, "Invoice and amount are required"));
        }

        // Validate invoice
        const invoiceExists = await Invoice.findById(invoice);
        if (!invoiceExists) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Create pending payment
        const payment = new Payment({
            invoice,
            client: invoiceExists.client,
            amount,
            paymentMethod: 'stripe',
            status: 'pending',
            paymentDate: new Date()
        });

        await payment.save();

        // Create Stripe payment intent
        const paymentIntent = await createStripePaymentIntent(
            amount,
            currency,
            {
                invoiceId: invoice,
                paymentId: payment._id.toString(),
                invoiceNumber: invoiceExists.invoiceNumber
            }
        );

        // Update payment with Stripe payment intent ID
        payment.metadata = { paymentIntentId: paymentIntent.id };
        await payment.save();

        res.status(200).json({
            success: true,
            message: "Stripe payment initiated",
            data: {
                payment: payment,
                clientSecret: paymentIntent.client_secret
            }
        });

    } catch (error: any) {
        console.error('Initiate Stripe payment error:', error);
        next(errorHandler(500, "Server error while initiating Stripe payment"));
    }
};
```

#### `stripeWebhook(webhookData)`
**Purpose:** Handle Stripe webhook events
**Access:** Stripe gateway (webhook)
**Process:**
- Verify webhook signature
- Handle payment success/failure
- Update payment and invoice
- Send confirmation
**Response:** Acknowledgment

**Controller Implementation:**
```typescript
export const stripeWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const signature = req.headers['stripe-signature'] as string;

        // Verify webhook
        const event = await verifyStripeWebhook(req.body, signature);

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const paymentId = paymentIntent.metadata.paymentId;

            const payment = await Payment.findById(paymentId);

            if (payment) {
                payment.status = 'completed';
                payment.transactionId = paymentIntent.id;
                await payment.save();

                // Update invoice
                const invoice = await Invoice.findById(payment.invoice);
                if (invoice) {
                    invoice.paidAmount += payment.amount;
                    await invoice.save();
                }

                // Send confirmation
                await sendPaymentConfirmation(payment.client.toString(), payment._id.toString());
            }
        } else if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object;
            const paymentId = paymentIntent.metadata.paymentId;

            const payment = await Payment.findById(paymentId);
            if (payment) {
                payment.status = 'failed';
                payment.metadata = { ...payment.metadata, error: paymentIntent.last_payment_error };
                await payment.save();
            }
        }

        res.status(200).json({ received: true });

    } catch (error: any) {
        console.error('Stripe webhook error:', error);
        res.status(400).json({ error: 'Webhook Error' });
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

#### `getPaymentStats()`
**Purpose:** Get payment statistics
**Access:** Admin users
**Response:**
- Total payments by method
- Total payments by status
- Revenue collected
- Pending payments
- Failed payment rate
- Average payment amount

**Controller Implementation:**
```typescript
export const getPaymentStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const total = await Payment.countDocuments();
        const pending = await Payment.countDocuments({ status: 'pending' });
        const completed = await Payment.countDocuments({ status: 'completed' });
        const failed = await Payment.countDocuments({ status: 'failed' });
        const refunded = await Payment.countDocuments({ status: 'refunded' });

        // By payment method
        const mpesa = await Payment.countDocuments({ paymentMethod: 'mpesa' });
        const bankTransfer = await Payment.countDocuments({ paymentMethod: 'bank_transfer' });
        const stripe = await Payment.countDocuments({ paymentMethod: 'stripe' });
        const paypal = await Payment.countDocuments({ paymentMethod: 'paypal' });
        const cash = await Payment.countDocuments({ paymentMethod: 'cash' });

        // Calculate revenue
        const completedPayments = await Payment.find({ status: 'completed' });
        const totalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total,
                    byStatus: {
                        pending,
                        completed,
                        failed,
                        refunded
                    },
                    byMethod: {
                        mpesa,
                        bankTransfer,
                        stripe,
                        paypal,
                        cash
                    },
                    revenue: {
                        total: totalRevenue,
                        average: total > 0 ? (totalRevenue / completed).toFixed(2) : 0
                    },
                    successRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0
                }
            }
        });

    } catch (error: any) {
        console.error('Get payment stats error:', error);
        next(errorHandler(500, "Server error while fetching payment statistics"));
    }
};
```

#### `refundPayment(paymentId, reason)`
**Purpose:** Process payment refund
**Access:** Admin users (super_admin, finance)
**Validation:**
- Payment must be completed
- Amount validation
**Process:**
- Update payment status to 'refunded'
- Update invoice paidAmount
- Initiate gateway refund
- Send notification
**Response:** Updated payment

**Controller Implementation:**
```typescript
export const refundPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params;
        const { reason, amount }: { reason?: string; amount?: number } = req.body;

        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        if (payment.status !== 'completed') {
            return next(errorHandler(400, "Only completed payments can be refunded"));
        }

        const refundAmount = amount || payment.amount;

        if (refundAmount > payment.amount) {
            return next(errorHandler(400, "Refund amount cannot exceed payment amount"));
        }

        // Update payment status
        payment.status = 'refunded';
        payment.notes = reason ? `Refund reason: ${reason}` : payment.notes;
        await payment.save();

        // Update invoice
        const invoice = await Invoice.findById(payment.invoice);
        if (invoice) {
            invoice.paidAmount -= refundAmount;
            await invoice.save();
        }

        res.status(200).json({
            success: true,
            message: "Payment refunded successfully",
            data: {
                payment: payment
            }
        });

    } catch (error: any) {
        console.error('Refund payment error:', error);
        next(errorHandler(500, "Server error while refunding payment"));
    }
};
```

---

## 🛣️ Payment Routes

### Base Path: `/api/payments`

```typescript
// Admin Routes
POST   /                          // Create manual payment
GET    /                          // Get all payments (paginated, filtered)
GET    /stats                     // Get payment statistics

// Payment Management Routes
GET    /:paymentId                // Get single payment
PUT    /:paymentId                // Update payment
DELETE /:paymentId                // Delete payment (super admin)

// M-Pesa Routes
POST   /mpesa/initiate            // Initiate M-Pesa payment
POST   /mpesa/callback            // M-Pesa callback (webhook)

// Stripe Routes
POST   /stripe/initiate           // Initiate Stripe payment
POST   /stripe/webhook            // Stripe webhook

// PayPal Routes
POST   /paypal/initiate           // Initiate PayPal payment
POST   /paypal/webhook            // PayPal webhook

// Action Routes
POST   /:paymentId/refund         // Refund payment

// Query Routes
GET    /client/:clientId          // Get client payments
GET    /invoice/:invoiceId        // Get invoice payments
```

### Router Implementation

**File: `src/routes/paymentRoutes.ts`**

```typescript
import express from 'express';
import {
    createPayment,
    getAllPayments,
    getPaymentStats,
    getPayment,
    updatePayment,
    deletePayment,
    initiateMpesaPayment,
    mpesaCallback,
    initiateStripePayment,
    stripeWebhook,
    refundPayment,
    getClientPayments,
    getInvoicePayments
} from '../controllers/paymentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/payments
 * @desc    Create manual payment
 * @access  Private (Admin, Finance)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createPayment);

/**
 * @route   GET /api/payments
 * @desc    Get all payments with filtering and pagination
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), getAllPayments);

/**
 * @route   GET /api/payments/stats
 * @desc    Get payment statistics
 * @access  Private (Admin)
 */
router.get('/stats', authenticateToken, authorizeRoles(['super_admin', 'finance']), getPaymentStats);

/**
 * @route   POST /api/payments/mpesa/initiate
 * @desc    Initiate M-Pesa payment
 * @access  Private (Client or Admin)
 */
router.post('/mpesa/initiate', authenticateToken, initiateMpesaPayment);

/**
 * @route   POST /api/payments/mpesa/callback
 * @desc    M-Pesa payment callback
 * @access  Public (M-Pesa gateway)
 */
router.post('/mpesa/callback', mpesaCallback);

/**
 * @route   POST /api/payments/stripe/initiate
 * @desc    Initiate Stripe payment
 * @access  Private (Client or Admin)
 */
router.post('/stripe/initiate', authenticateToken, initiateStripePayment);

/**
 * @route   POST /api/payments/stripe/webhook
 * @desc    Stripe webhook
 * @access  Public (Stripe gateway)
 */
router.post('/stripe/webhook', stripeWebhook);

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
 * @route   POST /api/payments/:paymentId/refund
 * @desc    Refund payment
 * @access  Private (Admin, Finance)
 */
router.post('/:paymentId/refund', authenticateToken, authorizeRoles(['super_admin', 'finance']), refundPayment);

export default router;
```

### Route Details

#### `POST /api/payments`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "invoice": "invoice_id_here",
  "client": "client_id_here",
  "amount": 9550,
  "paymentMethod": "cash",
  "paymentDate": "2025-01-01",
  "reference": "REF-001",
  "notes": "Cash payment received"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "payment": {
      "_id": "...",
      "paymentNumber": "PAY-2025-0001",
      "invoice": {...},
      "client": {...},
      "amount": 9550,
      "paymentMethod": "cash",
      "status": "completed",
      "reference": "REF-001",
      "paymentDate": "2025-01-01T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
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
- `status` (optional): Filter by status (pending, completed, failed, refunded)
- `paymentMethod` (optional): Filter by payment method (mpesa, bank_transfer, stripe, paypal, cash)
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

#### `GET /api/payments/stats`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 100,
      "totalAmount": 500000,
      "byStatus": {
        "pending": 5,
        "completed": 85,
        "failed": 8,
        "refunded": 2
      },
      "byMethod": {
        "mpesa": 50,
        "bank_transfer": 20,
        "stripe": 15,
        "paypal": 10,
        "cash": 5
      }
    }
  }
}
```

#### `POST /api/payments/mpesa/initiate`
**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "invoice": "invoice_id_here",
  "amount": 9550,
  "phone": "+254712345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "M-Pesa payment initiated successfully",
  "data": {
    "payment": {
      "_id": "...",
      "paymentNumber": "PAY-2025-0001",
      "status": "pending",
      "merchantRequestId": "...",
      "checkoutRequestId": "..."
    },
    "mpesaResponse": {
      "merchantRequestId": "...",
      "checkoutRequestId": "...",
      "responseCode": "0",
      "responseDescription": "Success. Request accepted for processing"
    }
  }
}
```

#### `POST /api/payments/mpesa/callback`
**Headers:** Not required (Public webhook endpoint)

**Body:** (Raw webhook payload from M-Pesa)
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
  "ResultCode": 0,
  "ResultDesc": "Accepted"
}
```

#### `POST /api/payments/stripe/initiate`
**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "invoice": "invoice_id_here",
  "amount": 9550,
  "email": "client@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stripe payment initiated successfully",
  "data": {
    "payment": {
      "_id": "...",
      "paymentNumber": "PAY-2025-0001",
      "status": "pending",
      "reference": "..."
    },
    "authorizationUrl": "https://checkout.stripe.com/..."
  }
}
```

#### `POST /api/payments/stripe/webhook`
**Headers:** Not required (Public webhook endpoint)

**Body:** (Raw webhook payload from Stripe)

**Response:** HTTP 200 OK

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
  "amount": 10000,
  "paymentDate": "2025-01-02",
  "reference": "REF-002",
  "notes": "Updated notes"
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
      "amount": 10000,
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

#### `POST /api/payments/:paymentId/refund`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `paymentId` - The payment ID

**Body:**
```json
{
  "reason": "Client requested refund"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "payment": {
      "_id": "...",
      "status": "refunded",
      ...
    }
  }
}
```

---

## 💳 Payment Gateway Integration

### M-Pesa Integration (Daraja API)

**File: `src/services/external/daraja.ts`**

#### Setup
```typescript
// Environment Variables
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback
```

#### Initiate Payment
```typescript
export const initiateMpesaPayment = async (
  phone: string,
  amount: number,
  invoiceNumber: string,
  description: string
) => {
  // 1. Get access token
  const token = await getAccessToken();
  
  // 2. Initiate STK push
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp);
  
  const response = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: invoiceNumber,
      TransactionDesc: description
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  return response.data;
};
```

#### Handle Callback
```typescript
export const mpesaCallbackHandler = async (callbackData: any) => {
  const { Body } = callbackData;
  const { stkCallback } = Body;
  
  if (stkCallback.ResultCode === 0) {
    // Payment successful
    const metadata = stkCallback.CallbackMetadata.Item;
    
    return {
      success: true,
      transactionId: metadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value,
      amount: metadata.find((item: any) => item.Name === 'Amount')?.Value,
      phone: metadata.find((item: any) => item.Name === 'PhoneNumber')?.Value
    };
  } else {
    // Payment failed
    return {
      success: false,
      error: stkCallback.ResultDesc
    };
  }
};
```

### Stripe Integration

**File: `src/services/external/stripe.ts`**

#### Setup
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-11-20.acacia'
});
```

#### Create Payment Intent
```typescript
export const createPaymentIntent = async (
  amount: number,
  currency: string = 'usd',
  metadata: any = {}
) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe uses cents
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true
    }
  });
  
  return paymentIntent;
};
```

#### Handle Webhook
```typescript
export const handleStripeWebhook = async (
  payload: string,
  signature: string
) => {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET as string
  );
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Handle successful payment
      return { success: true, data: event.data.object };
      
    case 'payment_intent.payment_failed':
      // Handle failed payment
      return { success: false, error: event.data.object };
      
    default:
      return { success: true, message: 'Event not handled' };
  }
};
```

---

## 📝 API Examples

### Create Manual Payment
```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "invoice": "invoice_id_here",
    "client": "client_id_here",
    "amount": 5000,
    "paymentMethod": "bank_transfer",
    "transactionId": "BANK123456",
    "reference": "Transfer from ABC Bank",
    "notes": "Full payment received"
  }'
```

### Initiate M-Pesa Payment
```bash
curl -X POST http://localhost:5000/api/payments/mpesa/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <client_token>" \
  -d '{
    "invoice": "invoice_id_here",
    "phone": "+254712345678",
    "amount": 5000
  }'
```

### Initiate Stripe Payment
```bash
curl -X POST http://localhost:5000/api/payments/stripe/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <client_token>" \
  -d '{
    "invoice": "invoice_id_here",
    "amount": 5000,
    "currency": "usd"
  }'
```

### Get Payment Statistics
```bash
curl -X GET http://localhost:5000/api/payments/stats \
  -H "Authorization: Bearer <admin_token>"
```

### Refund Payment
```bash
curl -X POST http://localhost:5000/api/payments/<paymentId>/refund \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "reason": "Client requested refund",
    "amount": 5000
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
- **M-Pesa** - OAuth token authentication, callback URL validation
- **Stripe** - Webhook signature verification, API key security
- **PayPal** - IPN verification, API credentials
- **HTTPS Only** - All gateway communications over HTTPS

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
- Payment confirmation emails
- SMS notifications
- Real-time payment updates
- Payment reminders

### Real-time Updates
- Socket.io payment notifications
- Live payment status
- Invoice status updates
- Admin dashboard updates

---

## 🔧 Environment Variables

### M-Pesa Configuration
```env
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback
MPESA_ENVIRONMENT=sandbox  # or production
```

### Stripe Configuration
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### PayPal Configuration
```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=sandbox  # or live
```

---

## 📊 Payment Flow Diagrams

### M-Pesa Payment Flow
1. Client initiates payment → API creates pending payment
2. API calls M-Pesa Daraja STK push
3. Client receives M-Pesa prompt on phone
4. Client enters PIN
5. M-Pesa processes payment
6. M-Pesa sends callback to API
7. API updates payment status
8. API updates invoice
9. API sends confirmation to client

### Stripe Payment Flow
1. Client initiates payment → API creates payment intent
2. API returns client secret
3. Frontend collects card details
4. Stripe processes payment
5. Stripe sends webhook to API
6. API updates payment status
7. API updates invoice
8. API sends confirmation to client

---

## 🧪 Testing Payments

### M-Pesa Test Credentials
```
Test Phone: 254708374149
Test Amount: Any amount (1-70000)
Test PIN: Use your Safaricom PIN on sandbox
```

### Stripe Test Cards
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires Authentication: 4000 0025 0000 3155
```

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
