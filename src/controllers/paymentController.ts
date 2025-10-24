import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Payment from '../models/Payment';
import Invoice from '../models/Invoice';
import Client from '../models/Client';
import { createPaymentRecord, applySuccessfulPayment, initiateMpesaForInvoice, initiatePaystackForInvoice, validatePaymentAmount } from '../services/internal/paymentService';
import { parseCallback as parseDarajaCallback, queryStkPushStatus } from '../services/external/darajaService';
import { parseWebhook as parsePaystackWebhook, verifyTransaction } from '../services/external/paystackService';

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

        if (!invoice || !client || !amount || !paymentMethod) {
            return next(errorHandler(400, "Invoice, client, amount, and payment method are required"));
        }

        const invoiceExists = await Invoice.findById(invoice);
        if (!invoiceExists) {
            return next(errorHandler(404, "Invoice not found"));
        }

        const remainingBalance = (invoiceExists.totalAmount - invoiceExists.paidAmount);
        if (amount > remainingBalance) {
            return next(errorHandler(400, "Payment amount exceeds invoice balance"));
        }

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

        invoiceExists.paidAmount += amount;
        await invoiceExists.save();

        await payment.populate('client', 'firstName lastName email');
        await payment.populate('invoice', 'invoiceNumber projectTitle totalAmount');

        res.status(201).json({ success: true, message: "Payment recorded successfully", data: { payment } });

    } catch (error: any) {
        console.error('Create payment error:', error);
        next(errorHandler(500, "Server error while creating payment"));
    }
};

export const getAllPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, paymentMethod, client } = req.query as any;

        const query: any = {};
        if (search) {
            query.$or = [
                { paymentNumber: { $regex: search, $options: 'i' } },
                { transactionId: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) query.status = status;
        if (paymentMethod) query.paymentMethod = paymentMethod;
        if (client) query.client = client;

        const options = { page: parseInt(page), limit: parseInt(limit) };

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
                payments,
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

export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params as any;
        const payment = await Payment.findById(paymentId)
            .populate('client', 'firstName lastName email company')
            .populate('invoice', 'invoiceNumber projectTitle totalAmount paidAmount');

        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        res.status(200).json({ success: true, data: { payment } });

    } catch (error: any) {
        console.error('Get payment error:', error);
        next(errorHandler(500, "Server error while fetching payment"));
    }
};

export const updatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params as any;
        const { reference, notes, metadata } = req.body as any;

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        if (reference) payment.reference = reference;
        if (notes) payment.notes = notes;
        if (metadata) payment.metadata = metadata;

        await payment.save();

        res.status(200).json({ success: true, message: "Payment updated successfully", data: { payment } });

    } catch (error: any) {
        console.error('Update payment error:', error);
        next(errorHandler(500, "Server error while updating payment"));
    }
};

export const deletePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params as any;
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        if (payment.status === 'completed') {
            return next(errorHandler(400, "Cannot delete completed payments. Please refund instead."));
        }

        await Payment.findByIdAndDelete(paymentId);

        res.status(200).json({ success: true, message: "Payment deleted successfully" });

    } catch (error: any) {
        console.error('Delete payment error:', error);
        next(errorHandler(500, "Server error while deleting payment"));
    }
};

export const getClientPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params as any;
        const payments = await Payment.find({ client: clientId })
            .populate('invoice', 'invoiceNumber projectTitle totalAmount')
            .sort({ createdAt: 'desc' });

        res.status(200).json({ success: true, data: { payments } });

    } catch (error: any) {
        console.error('Get client payments error:', error);
        next(errorHandler(500, "Server error while fetching client payments"));
    }
};

export const getInvoicePayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;
        const payments = await Payment.find({ invoice: invoiceId }).sort({ createdAt: 'desc' });
        res.status(200).json({ success: true, data: { payments } });
    } catch (error: any) {
        console.error('Get invoice payments error:', error);
        next(errorHandler(500, "Server error while fetching invoice payments"));
    }
};

// ===== PAYMENT GATEWAY METHODS =====

export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const io = req.app.get('io');
        const { invoiceId, method, amount, payerPhone, payerEmail, callbackUrl }: {
            invoiceId: string;
            method: 'mpesa' | 'paystack' | 'cash' | 'bank_transfer';
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

        // Handle offline methods
        if (['cash', 'bank_transfer'].includes(method)) {
            payment.status = 'completed';
            await payment.save();

            await applySuccessfulPayment({ invoice, payment, io, method });
            
            res.status(200).json({ 
                success: true, 
                message: "Payment recorded successfully",
                data: { paymentId: payment._id, status: payment.status } 
            });
            return;
        }

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

// M-Pesa Webhook
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
        }

        res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('M-Pesa webhook error:', error);
        next(errorHandler(500, "Server error processing M-Pesa webhook"));
    }
};

// Paystack Webhook
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
        }

        res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Paystack webhook error:', error);
        next(errorHandler(500, "Server error processing Paystack webhook"));
    }
};

// Query M-Pesa Status
export const queryMpesaStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { paymentId } = req.params;
        const { invoiceId } = req.query;

        let payment = await Payment.findById(paymentId);
        if (!payment && invoiceId) {
            payment = await Payment.findOne({ invoice: invoiceId, paymentMethod: 'mpesa' }).sort({ createdAt: -1 });
        }

        if (!payment) {
            return next(errorHandler(404, "Payment not found"));
        }

        const checkoutRequestId = payment?.processorRefs?.daraja?.checkoutRequestId;
        if (!checkoutRequestId) {
            return next(errorHandler(400, "No M-Pesa reference for this payment"));
        }

        const result = await queryStkPushStatus({ checkoutRequestId });
        if (!result.ok) {
            return next(errorHandler(502, result.error || "Failed to query M-Pesa status"));
        }

        const status = result.resultCode === 0 ? 'completed' : (payment.status === 'completed' ? 'completed' : 'pending');
        
        res.status(200).json({ 
            success: true, 
            data: { 
                status, 
                resultCode: result.resultCode, 
                resultDesc: result.resultDesc 
            } 
        });

    } catch (error: any) {
        console.error('Query M-Pesa status error:', error);
        next(errorHandler(500, "Server error while querying M-Pesa status"));
    }
};

// Query M-Pesa Status by Checkout ID
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

        const status = result.resultCode === 0 ? 'completed' : 'failed';
        
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
                status, 
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


