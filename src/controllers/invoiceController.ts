import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Invoice from '../models/Invoice';
import Client from '../models/Client';
import Payment from '../models/Payment';

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { client, quotation, projectTitle, items, tax, discount, dueDate, notes }: {
            client: string;
            quotation?: string;
            projectTitle: string;
            items: Array<{ description: string; quantity: number; unitPrice: number; }>;
            tax?: number;
            discount?: number;
            dueDate: Date;
            notes?: string;
        } = req.body;

        if (!client || !projectTitle || !items || items.length === 0 || !dueDate) {
            return next(errorHandler(400, "Client, project title, items, and due date are required"));
        }

        const clientExists = await Client.findById(client);
        if (!clientExists) {
            return next(errorHandler(404, "Client not found"));
        }

        const invoice = new Invoice({
            client,
            quotation,
            projectTitle,
            items,
            tax: tax || 0,
            discount: discount || 0,
            dueDate,
            notes,
            createdBy: (req as any).user?._id
        });

        await invoice.save();
        await invoice.populate('client', 'firstName lastName email company');
        if (quotation) await invoice.populate('quotation');

        res.status(201).json({ success: true, message: "Invoice created successfully", data: { invoice } });

    } catch (error: any) {
        console.error('Create invoice error:', error);
        next(errorHandler(500, "Server error while creating invoice"));
    }
};

export const getAllInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, client } = req.query as any;

        const query: any = {};

        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { projectTitle: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) query.status = status;
        if (client) query.client = client;

        const options = { page: parseInt(page), limit: parseInt(limit) };

        const invoices = await Invoice.find(query)
            .populate('client', 'firstName lastName email company')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Invoice.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                invoices,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalInvoices: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all invoices error:', error);
        next(errorHandler(500, "Server error while fetching invoices"));
    }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone address')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        const payments = await Payment.find({ invoice: invoiceId });

        res.status(200).json({ success: true, data: { invoice, payments } });

    } catch (error: any) {
        console.error('Get invoice error:', error);
        next(errorHandler(500, "Server error while fetching invoice"));
    }
};

export const updateInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;
        const { projectTitle, items, tax, discount, dueDate, notes } = req.body as any;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Cannot update a paid invoice"));
        }

        if (projectTitle) invoice.projectTitle = projectTitle;
        if (items) invoice.items = items;
        if (tax !== undefined) invoice.tax = tax;
        if (discount !== undefined) invoice.discount = discount;
        if (dueDate) invoice.dueDate = dueDate;
        if (notes) invoice.notes = notes;

        await invoice.save();

        res.status(200).json({ success: true, message: "Invoice updated successfully", data: { invoice } });

    } catch (error: any) {
        console.error('Update invoice error:', error);
        next(errorHandler(500, "Server error while updating invoice"));
    }
};

export const deleteInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        const paymentsExist = await Payment.findOne({ invoice: invoiceId });
        if (paymentsExist) {
            return next(errorHandler(400, "Cannot delete invoice with existing payments"));
        }

        await Invoice.findByIdAndDelete(invoiceId);

        res.status(200).json({ success: true, message: "Invoice deleted successfully" });

    } catch (error: any) {
        console.error('Delete invoice error:', error);
        next(errorHandler(500, "Server error while deleting invoice"));
    }
};

export const markAsPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;
        const { paymentMethod, transactionId } = req.body as any;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Invoice is already paid"));
        }

        invoice.paidAmount = invoice.totalAmount;
        invoice.status = 'paid';
        invoice.paidDate = new Date();
        await invoice.save();

        if (paymentMethod) {
            const payment = new Payment({
                invoice: invoice._id,
                client: invoice.client,
                amount: invoice.totalAmount,
                paymentMethod,
                status: 'completed',
                transactionId,
                paymentDate: new Date()
            });
            await payment.save();
        }

        res.status(200).json({ success: true, message: "Invoice marked as paid successfully", data: { invoice } });

    } catch (error: any) {
        console.error('Mark as paid error:', error);
        next(errorHandler(500, "Server error while marking invoice as paid"));
    }
};

export const markAsOverdue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        invoice.status = 'overdue';
        await invoice.save();

        res.status(200).json({ success: true, message: "Invoice marked as overdue", data: { invoice } });

    } catch (error: any) {
        console.error('Mark as overdue error:', error);
        next(errorHandler(500, "Server error while marking invoice as overdue"));
    }
};

export const cancelInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;
        const { reason } = req.body as any;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Cannot cancel a paid invoice"));
        }

        invoice.status = 'cancelled';
        if (reason) invoice.notes = `Cancellation reason: ${reason}`;
        await invoice.save();

        res.status(200).json({ success: true, message: "Invoice cancelled successfully", data: { invoice } });

    } catch (error: any) {
        console.error('Cancel invoice error:', error);
        next(errorHandler(500, "Server error while cancelling invoice"));
    }
};


