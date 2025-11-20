import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Quotation from '../models/Quotation';
import User from '../models/User';
import Role from '../models/Role';
import Invoice from '../models/Invoice';
import Project from '../models/Project';
import { generateQuotationPDF } from '../utils/generatePDF';
import { v2 as cloudinary } from 'cloudinary';
import { sendQuotationEmail } from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';

export const createQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { project, items, tax, discount, validUntil, notes }: {
            project: string;
            items: Array<{ description: string; quantity: number; unitPrice: number; }>;
            tax?: number;
            discount?: number;
            validUntil: Date | string;
            notes?: string;
        } = req.body;

        if (!project || !items || items.length === 0) {
            return next(errorHandler(400, "Project and items are required"));
        }

        // Check if project exists
        const projectExists = await Project.findById(project);
        if (!projectExists) {
            return next(errorHandler(404, "Project not found"));
        }

        // Validate that project has a client
        if (!projectExists.client) {
            return next(errorHandler(400, "Project must have an associated client"));
        }

        // Convert validUntil to Date if it's a string
        let validUntilDate: Date;
        if (typeof validUntil === 'string') {
            validUntilDate = new Date(validUntil);
            // Validate the date is valid
            if (isNaN(validUntilDate.getTime())) {
                return next(errorHandler(400, "Invalid validUntil date format. Please use ISO date format (YYYY-MM-DD)"));
            }
        } else if (validUntil instanceof Date) {
            validUntilDate = validUntil;
        } else {
            return next(errorHandler(400, "validUntil is required and must be a valid date"));
        }

        // Validate items structure
        for (const item of items) {
            if (!item.description || typeof item.quantity !== 'number' || typeof item.unitPrice !== 'number') {
                return next(errorHandler(400, "Each item must have description, quantity (number), and unitPrice (number)"));
            }
            if (item.quantity <= 0) {
                return next(errorHandler(400, "Item quantity must be greater than 0"));
            }
            if (item.unitPrice < 0) {
                return next(errorHandler(400, "Item unitPrice cannot be negative"));
            }
        }

        // Calculate item totals (required before validation)
        const itemsWithTotals = items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice
        }));

        // Calculate subtotal
        const subtotal = itemsWithTotals.reduce((sum, item) => sum + item.total, 0);

        // Calculate total amount
        const taxAmount = tax || 0;
        const discountAmount = discount || 0;
        const totalAmount = subtotal + taxAmount - discountAmount;

        // Generate quotation number
        const year = new Date().getFullYear();
        const count = await Quotation.countDocuments();
        const quotationNumber = `QT-${year}-${String(count + 1).padStart(4, '0')}`;

        // Create quotation with project reference
        // Client is inherited from project
        // Note: All calculated fields are included to satisfy Mongoose validation
        const quotation = new Quotation({
            quotationNumber,
            project: projectExists._id,
            client: projectExists.client,
            items: itemsWithTotals,
            subtotal,
            tax: taxAmount,
            discount: discountAmount,
            totalAmount,
            validUntil: validUntilDate,
            notes,
            createdBy: (req as any).user?._id
        });

        await quotation.save();

        // Update project with quotation reference
        projectExists.quotation = quotation._id as any;
        await projectExists.save();

        // Populate references
        await quotation.populate('project', 'title description projectNumber');
        await quotation.populate('client', 'firstName lastName email company');

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: quotation.client.toString(),
                recipientModel: 'User',
                category: 'quotation',
                subject: 'New Quotation Created',
                message: `A new quotation ${quotation.quotationNumber} has been created for your project.`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    projectId: quotation.project
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: { quotation }
        });

    } catch (error: any) {
        console.error('Create quotation error:', error);
        
        // Handle specific error types
        if (error.name === 'ValidationError') {
            // Mongoose validation error
            const errorMessage = error.message || "Validation error while creating quotation";
            return next(errorHandler(400, errorMessage));
        }
        
        if (error.code === 11000) {
            // Duplicate key error (e.g., duplicate quotation number)
            return next(errorHandler(409, "Quotation number already exists. Please try again."));
        }
        
        // Provide more detailed error message
        const errorMessage = error.message || "Server error while creating quotation";
        next(errorHandler(500, errorMessage));
    }
};

export const getAllQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, client, project } = req.query as any;

        const query: any = {};

        if (search) {
            query.$or = [
                { quotationNumber: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) {
            query.status = status;
        }

        if (client) {
            query.client = client;
        }

        if (project) {
            query.project = project;
        }

        const options = { page: parseInt(page), limit: parseInt(limit) };

        const quotations = await Quotation.find(query)
            .populate('project', 'title description projectNumber')
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
            .populate('project', 'title description projectNumber')
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
        const { items, tax, discount, validUntil, notes } = req.body as any;

        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        if (quotation.status === 'accepted' || quotation.status === 'converted') {
            return next(errorHandler(400, "Cannot update an accepted or converted quotation"));
        }

        // Note: project reference cannot be changed
        // projectTitle and projectDescription are inherited from project
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

        // Send bidirectional notification to admin who created the quotation
        try {
            await createInAppNotification({
                recipient: quotation.createdBy.toString(),
                recipientModel: 'User',
                category: 'quotation',
                subject: 'Quotation Accepted',
                message: `Client has accepted quotation ${quotation.quotationNumber}. You can now convert it to an invoice.`,
                actions: [
                    {
                        id: 'create_invoice',
                        label: 'Create Invoice',
                        type: 'api',
                        endpoint: `/api/quotation/${quotation._id}/convert-to-invoice`,
                        method: 'POST',
                        variant: 'primary'
                    },
                    {
                        id: 'view_quotation',
                        label: 'View Quotation',
                        type: 'navigate',
                        route: `/quotations/${quotation._id}`,
                        variant: 'secondary'
                    }
                ],
                context: {
                    resourceId: quotation._id.toString(),
                    resourceType: 'quotation'
                },
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    projectId: quotation.project
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

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

        // Send notification to admin who created the quotation
        try {
            await createInAppNotification({
                recipient: quotation.createdBy.toString(),
                recipientModel: 'User',
                category: 'quotation',
                subject: 'Quotation Rejected',
                message: `Client has rejected quotation ${quotation.quotationNumber}. Reason: ${reason || 'No reason provided'}`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
                    reason: reason
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

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

        // Populate project to get title
        await quotation.populate('project', 'title');
        const projectTitle = (quotation.project as any)?.title || '';

        const invoice = new Invoice({
            client: quotation.client,
            quotation: quotation._id,
            projectTitle: projectTitle,
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

        // Update project with invoice reference
        if (quotation.project) {
            const project = await Project.findById(quotation.project);
            if (project) {
                project.invoice = invoice._id as any;
                await project.save();
            }
        }

        quotation.status = 'converted';
        quotation.convertedToInvoice = invoice._id as any;
        await quotation.save();

        await invoice.populate('client', 'firstName lastName email company');

        // Send notifications to client and admin
        try {
            // For Client
            await createInAppNotification({
                recipient: invoice.client.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'Invoice Created from Quotation',
                message: `Your accepted quotation ${quotation.quotationNumber} has been converted to invoice ${invoice.invoiceNumber}. Payment is now due.`,
                metadata: {
                    quotationId: quotation._id,
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber
                },
                io: (req.app as any).get('io')
            });

            // For Admin/Finance confirmation
            await createInAppNotification({
                recipient: invoice.createdBy.toString(),
                recipientModel: 'User',
                category: 'invoice',
                subject: 'Invoice Created',
                message: `Invoice ${invoice.invoiceNumber} has been created from quotation ${quotation.quotationNumber}.`,
                metadata: {
                    quotationId: quotation._id,
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

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

export const generateQuotationPDFController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;

        const quotation = await Quotation.findById(quotationId)
            .populate('client', 'firstName lastName email company phone address city country')
            .populate('project', 'title description projectNumber')
            .populate('createdBy', 'firstName lastName email');

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Generate PDF
        const pdfBuffer = await generateQuotationPDF(quotation);

        // Upload PDF to Cloudinary as raw file using stream
        const fileName = `quotation-${quotation.quotationNumber || quotationId}`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/quotations',
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
        // Cloudinary returns secure_url for raw files, but we need to ensure .pdf extension is included
        let pdfUrl = uploadResult.secure_url || uploadResult.url;
        
        if (!pdfUrl) {
            // Fallback: construct URL manually with .pdf extension
            const publicId = uploadResult.public_id.includes('sire-tech/quotations') 
                ? uploadResult.public_id 
                : `sire-tech/quotations/${uploadResult.public_id}`;
            pdfUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}.pdf`;
        } else {
            // Ensure .pdf extension is present in the URL for browser viewing
            // Cloudinary URLs might not include the extension, so we add it
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
            message: "Quotation PDF generated successfully",
            pdfUrl: pdfUrl
        });

    } catch (error: any) {
        console.error('Generate quotation PDF error:', error);
        next(errorHandler(500, "Server error while generating quotation PDF"));
    }
};

export const sendQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { quotationId } = req.params as any;

        const quotation = await Quotation.findById(quotationId)
            .populate('client', 'firstName lastName email company phone')
            .populate('project', 'title description projectNumber');

        if (!quotation) {
            return next(errorHandler(404, "Quotation not found"));
        }

        // Check if quotation has a client with email
        if (!quotation.client) {
            return next(errorHandler(400, "Quotation must have an associated client"));
        }

        const client = quotation.client as any;
        if (!client.email) {
            return next(errorHandler(400, "Client email is required to send quotation"));
        }

        // Generate PDF
        const pdfBuffer = await generateQuotationPDF(quotation);

        // Upload PDF to Cloudinary
        const fileName = `quotation-${quotation.quotationNumber || quotationId}`;
        
        const uploadResult = await new Promise<{ secure_url: string; url: string; public_id: string }>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'sire-tech/quotations',
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
            const publicId = uploadResult.public_id.includes('sire-tech/quotations') 
                ? uploadResult.public_id 
                : `sire-tech/quotations/${uploadResult.public_id}`;
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
        await sendQuotationEmail(client.email, quotation, pdfUrl, pdfBuffer);

        // Update quotation status to 'sent'
        if (quotation.status === 'pending') {
            quotation.status = 'sent';
            await quotation.save();
        }

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: quotation.client._id.toString(),
                recipientModel: 'User',
                category: 'quotation',
                subject: 'Quotation Sent',
                message: `Quotation ${quotation.quotationNumber} has been sent to your email. Please review and respond.`,
                metadata: {
                    quotationId: quotation._id,
                    quotationNumber: quotation.quotationNumber,
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
            message: "Quotation sent successfully",
            data: {
                quotationId: quotation._id,
                sentTo: client.email,
                pdfUrl: pdfUrl
            }
        });

    } catch (error: any) {
        console.error('Send quotation error:', error);
        next(errorHandler(500, "Server error while sending quotation"));
    }
};


