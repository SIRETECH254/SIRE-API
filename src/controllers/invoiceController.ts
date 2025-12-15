import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Invoice from '../models/Invoice';
import Quotation from '../models/Quotation';
import Project from '../models/Project';
import Payment from '../models/Payment';
import User from '../models/User';
import { generateInvoicePDF } from '../utils/generatePDF';
import { v2 as cloudinary } from 'cloudinary';
import { sendInvoiceEmail } from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotation, dueDate }: {
            quotation: string;
            dueDate?: string | Date;
        } = req.body;

        // Validation - only quotation is required
        if (!quotation) {
            return next(errorHandler(400, "Quotation is required"));
        }

        // Check if user is authenticated
        if (!req.user || !req.user._id) {
            return next(errorHandler(401, "Authentication required"));
        }

        // Check if quotation exists
        const quotationExists = await Quotation.findById(quotation)
            .populate('project', 'title');
        
        if (!quotationExists) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Check if quotation has already been converted
        if (quotationExists.convertedToInvoice) {
            return next(errorHandler(400, "This quotation has already been converted to an invoice"));
        }

        // Validate quotation has items
        if (!quotationExists.items || quotationExists.items.length === 0) {
            return next(errorHandler(400, "Quotation must have at least one item"));
        }

        // Get project title from populated project
        const projectTitle = (quotationExists.project as any)?.title || 'Untitled Project';

        // Map items from quotation
        const items = quotationExists.items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice
        }));

        // Calculate subtotal from items
        const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
        
        // Get tax and discount from quotation (with defaults)
        const tax = quotationExists.tax || 0;
        const discount = quotationExists.discount || 0;
        
        // Calculate total amount
        const totalAmount = subtotal + tax - discount;

        // Create invoice from quotation data
        const invoice = new Invoice({
            client: quotationExists.client,
            quotation: quotationExists._id,
            projectTitle: projectTitle,
            items: items,
            subtotal: subtotal,
            tax: tax,
            discount: discount,
            totalAmount: totalAmount,
            paidAmount: 0,
            status: 'draft',
            dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            notes: quotationExists.notes,
            createdBy: req.user._id
        });

        await invoice.save();

        // Update project with invoice reference
        if (quotationExists.project) {
            // Get the project ID (whether it's an ObjectId or populated object)
            const projectId = typeof quotationExists.project === 'object' && quotationExists.project !== null && '_id' in quotationExists.project
                ? (quotationExists.project as any)._id
                : quotationExists.project;
            
            const project = await Project.findById(projectId);
            if (project) {
                project.invoice = invoice._id as any;
                await project.save();
            }
        }

        // Update quotation status to 'converted'
        quotationExists.status = 'converted';
        quotationExists.convertedToInvoice = invoice._id as any;
        await quotationExists.save();

        // Populate references
        await invoice.populate('client', 'firstName lastName email company');
        await invoice.populate('quotation', 'quotationNumber');
        await invoice.populate('createdBy', 'firstName lastName email');

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'New Invoice Created',
                message: `A new invoice ${invoice.invoiceNumber} has been created. Amount: $${invoice.totalAmount.toFixed(2)}`,
                metadata: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    totalAmount: invoice.totalAmount,
                    dueDate: invoice.dueDate
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({ 
            success: true, 
            message: "Invoice created successfully", 
            data: { invoice } 
        });

    } catch (error: any) {
        console.error('Create invoice error:', error);
        // Provide more specific error messages
        if (error.name === 'ValidationError') {
            return next(errorHandler(400, `Validation error: ${error.message}`));
        }
        if (error.name === 'CastError') {
            return next(errorHandler(400, `Invalid quotation ID format`));
        }
        next(errorHandler(500, error.message || "Server error while creating invoice"));
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

export const getInvoiceStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const total = await Invoice.countDocuments();

        const byStatus = {
            draft: await Invoice.countDocuments({ status: 'draft' }),
            sent: await Invoice.countDocuments({ status: 'sent' }),
            paid: await Invoice.countDocuments({ status: 'paid' }),
            partiallyPaid: await Invoice.countDocuments({ status: 'partially_paid' }),
            overdue: await Invoice.countDocuments({ status: 'overdue' }),
            cancelled: await Invoice.countDocuments({ status: 'cancelled' })
        };

        // Calculate total amount, paid amount, and outstanding amount
        const allInvoices = await Invoice.find({});
        const totalAmount = allInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const paidAmount = allInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
        const outstandingAmount = allInvoices
            .filter(inv => ['sent', 'partially_paid', 'overdue'].includes(inv.status))
            .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total,
                    byStatus,
                    totalAmount,
                    paidAmount,
                    outstandingAmount
                }
            }
        });

    } catch (error: any) {
        console.error('Get invoice stats error:', error);
        next(errorHandler(500, "Server error while fetching invoice statistics"));
    }
};

export const getOverdueInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const invoices = await Invoice.find({
            dueDate: { $lt: today },
            status: { $nin: ['paid', 'cancelled'] }
        })
            .populate('client', 'firstName lastName email company')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email')
            .sort({ dueDate: 'asc' });

        res.status(200).json({
            success: true,
            data: {
                invoices
            }
        });

    } catch (error: any) {
        console.error('Get overdue invoices error:', error);
        next(errorHandler(500, "Server error while fetching overdue invoices"));
    }
};

export const getClientInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params as any;
        const { page = 1, limit = 10, status } = req.query as any;

        // Validate client exists
        const client = await User.findById(clientId);
        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        const query: any = { client: clientId };

        if (status) {
            query.status = status;
        }

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
        console.error('Get client invoices error:', error);
        next(errorHandler(500, "Server error while fetching client invoices"));
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

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'payment',
                subject: 'Invoice Paid',
                message: `Invoice ${invoice.invoiceNumber} has been marked as paid. Thank you for your payment!`,
                metadata: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    paidAmount: invoice.paidAmount,
                    paymentDate: invoice.paidDate
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
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

        // Send bidirectional notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'Invoice Overdue',
                message: `Invoice ${invoice.invoiceNumber} is now overdue. Please make payment as soon as possible.`,
                actions: [
                    {
                        id: 'make_payment',
                        label: 'Pay Now',
                        type: 'api',
                        endpoint: '/api/payments/initiate',
                        method: 'POST',
                        payload: {
                            invoiceId: invoice._id.toString(),
                            method: 'mpesa',
                            amount: invoice.totalAmount - invoice.paidAmount
                        },
                        variant: 'primary',
                        requiresConfirmation: true,
                        confirmationMessage: `Pay $${invoice.totalAmount - invoice.paidAmount} for invoice ${invoice.invoiceNumber}?`
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
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    dueDate: invoice.dueDate,
                    totalAmount: invoice.totalAmount
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

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

        // Save old status before any checks
        const oldStatus = invoice.status as any;

        if (invoice.status === 'paid') {
            return next(errorHandler(400, "Cannot cancel a paid invoice"));
        }

        invoice.status = 'cancelled';
        if (reason) invoice.notes = `Cancellation reason: ${reason}`;
        await invoice.save();

        // Send notification to client if invoice was sent or paid
        if (oldStatus === 'sent' || oldStatus === 'paid') {
            try {
                await createInAppNotification({
                    recipient: invoice.client.toString(),
                    recipientModel: 'User',
                    category: 'invoice',
                    subject: 'Invoice Cancelled',
                    message: `Invoice ${invoice.invoiceNumber} has been cancelled. Reason: ${reason || 'No reason provided'}`,
                    metadata: {
                        invoiceId: invoice._id,
                        invoiceNumber: invoice.invoiceNumber,
                        reason: reason
                    },
                    io: (req.app as any).get('io')
                });
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

        res.status(200).json({ success: true, message: "Invoice cancelled successfully", data: { invoice } });

    } catch (error: any) {
        console.error('Cancel invoice error:', error);
        next(errorHandler(500, "Server error while cancelling invoice"));
    }
};

export const generateInvoicePDFController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone address city country')
            .populate('quotation', 'quotationNumber')
            .populate('createdBy', 'firstName lastName email');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoice);

        // Upload PDF to Cloudinary as raw file using stream
        // Include .pdf extension in public_id so Cloudinary serves it with correct content type
        const fileName = `invoice-${invoice.invoiceNumber || invoiceId}.pdf`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/invoices',
                    resource_type: 'raw',
                    public_id: fileName,
                    type: 'upload',
                    overwrite: true,
                    invalidate: true,
                    access_mode: 'public',
                    use_filename: false,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else if (result) {
                        resolve({
                            secure_url: result.secure_url || '',
                            url: result.url || '',
                            public_id: result.public_id || ''
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(pdfBuffer);
        });

        // Use the secure_url directly from Cloudinary - it will include the .pdf extension
        // Cloudinary automatically handles the file extension when it's in the public_id
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        
        if (!pdfUrl) {
            // Fallback: construct URL manually
            const publicId = uploadResult.public_id.includes('sire-tech/invoices') 
                ? uploadResult.public_id 
                : `sire-tech/invoices/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}`;
        }

        res.status(200).json({
            success: true,
            message: "Invoice PDF generated successfully",
            pdfUrl: pdfUrl
        });

    } catch (error: any) {
        console.error('Generate invoice PDF error:', error);
        next(errorHandler(500, "Server error while generating invoice PDF"));
    }
};

export const sendInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoiceId } = req.params as any;

        const invoice = await Invoice.findById(invoiceId)
            .populate('client', 'firstName lastName email company phone')
            .populate('quotation', 'quotationNumber');

        if (!invoice) {
            return next(errorHandler(404, "Invoice not found"));
        }

        // Check if invoice has a client with email
        if (!invoice.client) {
            return next(errorHandler(400, "Invoice must have an associated client"));
        }

        const client = invoice.client as any;
        if (!client.email) {
            return next(errorHandler(400, "Client email is required to send invoice"));
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoice);

        // Upload PDF to Cloudinary
        // Include .pdf extension in public_id so Cloudinary serves it with correct content type
        const fileName = `invoice-${invoice.invoiceNumber || invoiceId}.pdf`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/invoices',
                    resource_type: 'raw',
                    public_id: fileName,
                    type: 'upload',
                    overwrite: true,
                    invalidate: true,
                    access_mode: 'public',
                    use_filename: false,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else if (result) {
                        resolve({
                            secure_url: result.secure_url || '',
                            url: result.url || '',
                            public_id: result.public_id || ''
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );
            uploadStream.end(pdfBuffer);
        });

        // Use the secure_url directly from Cloudinary - it will include the .pdf extension
        // Cloudinary automatically handles the file extension when it's in the public_id
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        
        if (!pdfUrl) {
            // Fallback: construct URL manually
            const publicId = uploadResult.public_id.includes('sire-tech/invoices') 
                ? uploadResult.public_id 
                : `sire-tech/invoices/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}`;
        }

        // Send email to client
        await sendInvoiceEmail(client.email, invoice, pdfUrl, pdfBuffer);

        // Update invoice status to 'sent'
        if (invoice.status === 'draft') {
            invoice.status = 'sent';
            await invoice.save();
        }

        // Send bidirectional notification to client
        try {
            await createInAppNotification({
                recipient: invoice.client._id.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'Invoice Sent',
                message: `Invoice ${invoice.invoiceNumber} has been sent to your email. Please make payment by ${new Date(invoice.dueDate).toLocaleDateString()}.`,
                actions: [
                    {
                        id: 'make_payment',
                        label: 'Pay Now',
                        type: 'api',
                        endpoint: '/api/payments/initiate',
                        method: 'POST',
                        payload: {
                            invoiceId: invoice._id.toString(),
                            amount: invoice.totalAmount
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
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    dueDate: invoice.dueDate,
                    pdfUrl: pdfUrl
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Invoice sent successfully",
            data: {
                invoiceId: invoice._id,
                sentTo: client.email,
                pdfUrl: pdfUrl
            }
        });

    } catch (error: any) {
        console.error('Send invoice error:', error);
        next(errorHandler(500, "Server error while sending invoice"));
    }
};


