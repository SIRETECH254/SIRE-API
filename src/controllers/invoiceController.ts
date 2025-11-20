import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Invoice from '../models/Invoice';
import Quotation from '../models/Quotation';
import Project from '../models/Project';
import Payment from '../models/Payment';
import { generateInvoicePDF } from '../utils/generatePDF';
import { v2 as cloudinary } from 'cloudinary';
import { sendInvoiceEmail } from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotation, dueDate }: {
            quotation: string;
            dueDate?: Date;
        } = req.body;

        // Validation - only quotation is required
        if (!quotation) {
            return next(errorHandler(400, "Quotation is required"));
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

        // Get project title from populated project
        const projectTitle = (quotationExists.project as any)?.title || '';

        // Create invoice from quotation data
        const invoice = new Invoice({
            client: quotationExists.client,
            quotation: quotationExists._id,
            projectTitle: projectTitle,
            items: quotationExists.items.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total
            })),
            tax: quotationExists.tax,
            discount: quotationExists.discount,
            dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            notes: quotationExists.notes,
            createdBy: (req as any).user?._id
        });

        await invoice.save();

        // Update project with invoice reference
        if (quotationExists.project) {
            const project = await Project.findById(quotationExists.project);
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
        const fileName = `invoice-${invoice.invoiceNumber || invoiceId}`;
        
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
                    use_filename: true,
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

        // Construct the correct URL for raw files with .pdf extension
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        
        if (!pdfUrl) {
            // Fallback: construct URL manually with .pdf extension
            const publicId = uploadResult.public_id.includes('sire-tech/invoices') 
                ? uploadResult.public_id 
                : `sire-tech/invoices/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}.pdf`;
        } else {
            // Ensure .pdf extension is present in the URL for browser viewing
            if (!pdfUrl.includes('.pdf')) {
                // If URL has query params, insert .pdf before the query
                if (pdfUrl.includes('?')) {
                    pdfUrl = pdfUrl.replace('?', '.pdf?');
                } else {
                    pdfUrl += '.pdf';
                }
            }
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
        const fileName = `invoice-${invoice.invoiceNumber || invoiceId}`;
        
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
                    use_filename: true,
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

        // Construct PDF URL with .pdf extension
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        if (!pdfUrl) {
            const publicId = uploadResult.public_id.includes('sire-tech/invoices') 
                ? uploadResult.public_id 
                : `sire-tech/invoices/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}.pdf`;
        } else {
            if (!pdfUrl.includes('.pdf')) {
                if (pdfUrl.includes('?')) {
                    pdfUrl = pdfUrl.replace('?', '.pdf?');
                } else {
                    pdfUrl += '.pdf';
                }
            }
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


