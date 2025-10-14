import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Payment from '../models/Payment';
import Invoice from '../models/Invoice';
import Client from '../models/Client';

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


