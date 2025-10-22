import Payment from '../../models/Payment';
import Invoice from '../../models/Invoice';
import Client from '../../models/Client';
import { initiateStkPush } from '../external/darajaService';
import { initTransaction } from '../external/paystackService';

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
  const payment = await Payment.create({
    invoice: params.invoice._id,
    client: params.client?._id,
    amount: params.amount,
    paymentMethod: params.method,
    status: ['cash', 'bank_transfer'].includes(params.method) ? 'completed' : 'pending',
    processorRefs: {}
  });
  
  return payment;
};

export const applySuccessfulPayment = async (params: ApplySuccessfulPaymentParams): Promise<any> => {
  const { invoice, payment, io, method } = params;
  
  // Update payment status
  payment.status = 'completed';
  await payment.save();

  // Update invoice status
  invoice.status = 'paid';
  invoice.paidAmount = (invoice.paidAmount || 0) + payment.amount;
  await invoice.save();

  // Update client if exists
  if (payment.client) {
    const client = await Client.findById(payment.client);
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

export const generatePaymentNumber = (): string => {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `PAY-${year}-${timestamp}`;
};

export const calculatePaymentFees = (amount: number, method: string): number => {
  // Calculate payment processing fees based on method
  const feeRates: { [key: string]: number } = {
    'mpesa': 0.015, // 1.5% for M-Pesa
    'paystack': 0.035, // 3.5% for Paystack
    'bank_transfer': 0.005, // 0.5% for bank transfer
    'cash': 0 // No fees for cash
  };
  
  const rate = feeRates[method] || 0;
  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
};

export const validatePaymentAmount = (amount: number, invoice: any): boolean => {
  const remainingBalance = invoice.totalAmount - (invoice.paidAmount || 0);
  return amount > 0 && amount <= remainingBalance;
};
