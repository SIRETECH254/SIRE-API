import Payment from '../../models/Payment';
import Invoice from '../../models/Invoice';
import User from '../../models/User';
import { initiateStkPush } from '../external/darajaService';
import { initTransaction } from '../external/paystackService';
import { createInAppNotification } from '../../utils/notificationHelper';

export interface CreatePaymentRecordParams {
  invoice: any;
  method: string;
  amount: number;
  client?: any;
}

export interface ApplySuccessfulPaymentParams {
  invoice: any;
  payment: any;
  io?: any;
  method: string;
}

export interface InitiateMpesaParams {
  invoice: any;
  payment: any;
  amount: number;
  phone: string;
  callbackUrl?: string | undefined;
}

export interface InitiatePaystackParams {
  invoice: any;
  payment: any;
  amount: number;
  email: string;
  callbackUrl?: string | undefined;
}

export const createPaymentRecord = async (params: CreatePaymentRecordParams): Promise<any> => {
  // Generate payment number before creating the payment
  const paymentNumber = await generatePaymentNumber();
  
  const payment = await Payment.create({
    paymentNumber,
    invoice: params.invoice._id,
    client: params.client?._id,
    amount: params.amount,
    paymentMethod: params.method,
    status: 'pending', // All payments start as pending until webhook confirms
    processorRefs: {}
  });
  
  return payment;
};

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

  // Update client if exists
  if (payment.client) {
    const client = await User.findById(payment.client);
    if (client) {
      // Update client's last payment date or any other relevant fields
      (client as any).lastPaymentAt = new Date();
      await client.save();
    }
  }

  // Emit real-time updates if socket.io is available
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
      recipientModel: 'User',
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

export const initiateMpesaForInvoice = async (params: InitiateMpesaParams): Promise<any> => {
  const { invoice, payment, amount, phone, callbackUrl } = params;
  
  const accountReference = invoice.invoiceNumber || invoice._id;
  const res = await initiateStkPush({ 
    amount, 
    phone, 
    accountReference, 
    callbackUrl: callbackUrl || undefined
  });
  
  // Update payment with M-Pesa references
  payment.status = 'pending';
  if (!payment.processorRefs) payment.processorRefs = {};
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  };
  await payment.save();
  
  return res;
};

export const initiatePaystackForInvoice = async (params: InitiatePaystackParams): Promise<any> => {
  const { invoice, payment, amount, email, callbackUrl } = params;
  
  const reference = `INV-${invoice._id}-${Date.now()}`;
  const res = await initTransaction({ 
    amount, 
    email, 
    reference, 
    callbackUrl: callbackUrl || undefined, 
    currency: process.env.PAYSTACK_CURRENCY || 'KES' 
  });
  
  // Update payment with Paystack references
  payment.status = 'pending';
  if (!payment.processorRefs) payment.processorRefs = {};
  payment.processorRefs.paystack = { reference };
  await payment.save();
  
  return res;
};

export const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  // Count documents created in the current year
  const startOfYear = new Date(year, 0, 1);
  const count = await Payment.countDocuments({
    createdAt: { $gte: startOfYear }
  });
  return `PAY-${year}-${String(count + 1).padStart(4, '0')}`;
};

export const calculatePaymentFees = (amount: number, method: string): number => {
  // Calculate payment processing fees based on method
  const feeRates: { [key: string]: number } = {
    'mpesa': 0.015, // 1.5% for M-Pesa
    'paystack': 0.035 // 3.5% for Paystack
  };
  
  const rate = feeRates[method] || 0;
  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
};

export const validatePaymentAmount = (amount: number, invoice: any): boolean => {
  const remainingBalance = invoice.totalAmount - (invoice.paidAmount || 0);
  return amount > 0 && amount <= remainingBalance;
};
