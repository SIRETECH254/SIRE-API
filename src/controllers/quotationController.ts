import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Quotation from '../models/Quotation';
import Client from '../models/Client';
import Invoice from '../models/Invoice';

export const createQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { client, projectTitle, projectDescription, items, tax, discount, validUntil, notes }: {
            client: string;
            projectTitle: string;
            projectDescription: string;
            items: Array<{ description: string; quantity: number; unitPrice: number; }>;
            tax?: number;
            discount?: number;
            validUntil: Date;
            notes?: string;
        } = req.body;

        if (!client || !projectTitle || !projectDescription || !items || items.length === 0) {
            return next(errorHandler(400, "Client, project title, description, and items are required"));
        }

        const clientExists = await Client.findById(client);
        if (!clientExists) {
            return next(errorHandler(404, "Client not found"));
        }

        const quotation = new Quotation({
            client,
            projectTitle,
            projectDescription,
            items,
            tax: tax || 0,
            discount: discount || 0,
            validUntil,
            notes,
            createdBy: (req as any).user?._id
        });

        await quotation.save();
        await quotation.populate('client', 'firstName lastName email company');

        res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: { quotation }
        });

    } catch (error: any) {
        console.error('Create quotation error:', error);
        next(errorHandler(500, "Server error while creating quotation"));
    }
};

export const getAllQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, client } = req.query as any;

        const query: any = {};

        if (search) {
            query.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } },
                { projectTitle: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) {
            query.status = status;
        }

        if (client) {
            query.client = client;
        }

        const options = { page: parseInt(page), limit: parseInt(limit) };

        const quotations = await Quotation.find(query)
            .populate('client', 'firstName lastName email company')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Quotation.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                quotations,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalQuotations: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all quotations error:', error);
        next(errorHandler(500, "Server error while fetching quotations"));
    }
};

export const getQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;

        const quotation = await Quotation.findById(quotationId)
            .populate('client', 'firstName lastName email company phone')
            .populate('createdBy', 'firstName lastName email')
            .populate('convertedToInvoice');

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        res.status(200).json({ success: true, data: { quotation } });

    } catch (error: any) {
        console.error('Get quotation error:', error);
        next(errorHandler(500, "Server error while fetching quotation"));
    }
};

export const updateQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;
        const { projectTitle, projectDescription, items, tax, discount, validUntil, notes } = req.body as any;

        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.status === 'accepted' || quotation.status === 'converted') {
            return next(errorHandler(400, "Cannot update an accepted or converted quotation"));
        }

        if (projectTitle) quotation.projectTitle = projectTitle;
        if (projectDescription) quotation.projectDescription = projectDescription;
        if (items) quotation.items = items;
        if (tax !== undefined) quotation.tax = tax;
        if (discount !== undefined) quotation.discount = discount;
        if (validUntil) quotation.validUntil = validUntil;
        if (notes) quotation.notes = notes;

        await quotation.save();

        res.status(200).json({ success: true, message: "Quotation updated successfully", data: { quotation } });

    } catch (error: any) {
        console.error('Update quotation error:', error);
        next(errorHandler(500, "Server error while updating quotation"));
    }
};

export const deleteQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;

        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.convertedToInvoice) {
            return next(errorHandler(400, "Cannot delete quotation that has been converted to invoice"));
        }

        await Quotation.findByIdAndDelete(quotationId);

        res.status(200).json({ success: true, message: "Quotation deleted successfully" });

    } catch (error: any) {
        console.error('Delete quotation error:', error);
        next(errorHandler(500, "Server error while deleting quotation"));
    }
};

export const acceptQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;

        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (new Date() > quotation.validUntil) {
            return next(errorHandler(400, "This quotation has expired"));
        }

        if (quotation.status !== 'sent') {
            return next(errorHandler(400, "Only sent quotations can be accepted"));
        }

        quotation.status = 'accepted';
        await quotation.save();

        res.status(200).json({ success: true, message: "Quotation accepted successfully", data: { quotation } });

    } catch (error: any) {
        console.error('Accept quotation error:', error);
        next(errorHandler(500, "Server error while accepting quotation"));
    }
};

export const rejectQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;
        const { reason } = req.body as any;

        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.status === 'accepted' || quotation.status === 'converted') {
            return next(errorHandler(400, "Cannot reject an accepted or converted quotation"));
        }

        quotation.status = 'rejected';
        if (reason) {
            quotation.notes = `Rejection reason: ${reason}`;
        }
        await quotation.save();

        res.status(200).json({ success: true, message: "Quotation rejected", data: { quotation } });

    } catch (error: any) {
        console.error('Reject quotation error:', error);
        next(errorHandler(500, "Server error while rejecting quotation"));
    }
};

export const convertToInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;
        const { dueDate } = req.body as any;

        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.status !== 'accepted') {
            return next(errorHandler(400, "Only accepted quotations can be converted to invoices"));
        }

        if (quotation.convertedToInvoice) {
            return next(errorHandler(400, "This quotation has already been converted to an invoice"));
        }

        const invoice = new Invoice({
            client: quotation.client,
            quotation: quotation._id,
            projectTitle: quotation.projectTitle,
            items: quotation.items.map((i: any) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.total
            })),
            tax: quotation.tax,
            discount: quotation.discount,
            dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdBy: (req as any).user?._id
        });

        await invoice.save();

        quotation.status = 'converted';
        quotation.convertedToInvoice = invoice._id as any;
        await quotation.save();

        await invoice.populate('client', 'firstName lastName email company');

        res.status(201).json({
            success: true,
            message: "Quotation converted to invoice successfully",
            data: { invoice, quotation }
        });

    } catch (error: any) {
        console.error('Convert to invoice error:', error);
        next(errorHandler(500, "Server error while converting quotation to invoice"));
    }
};


