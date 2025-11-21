import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Notification from '../models/Notification';
import User from '../models/User';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Project from '../models/Project';

export const sendNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipient, recipientModel, type, category, subject, message, metadata } = req.body as any;

        if (!recipient || !recipientModel || !type || !category || !subject || !message) {
            return next(errorHandler(400, "All fields are required"));
        }

        const recipientExists = await User.findById(recipient);
        if (!recipientExists) {
            return next(errorHandler(404, "Recipient not found"));
        }

        const notification = new Notification({
            recipient,
            recipientModel,
            type,
            category,
            subject,
            message,
            metadata,
            status: 'pending'
        });

        await notification.save();

        // For now, mark as sent immediately; integrate channel-specific delivery separately
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();

        res.status(201).json({ success: true, message: "Notification sent successfully", data: { notification } });

    } catch (error: any) {
        console.error('Send notification error:', error);
        next(errorHandler(500, "Server error while sending notification"));
    }
};

export const getUserNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, category, status } = req.query as any;
        const query: any = { recipient: (req as any).user?._id };

        if (category) query.category = category;
        if (status === 'unread') query.readAt = null;
        else if (status === 'read') query.readAt = { $ne: null };

        const options = { page: parseInt(page), limit: parseInt(limit) };

        const notifications = await Notification.find(query)
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Notification.countDocuments(query);

        res.status(200).json({ success: true, data: { notifications, pagination: {
            currentPage: options.page,
            totalPages: Math.ceil(total / options.limit),
            totalNotifications: total,
            hasNextPage: options.page < Math.ceil(total / options.limit),
            hasPrevPage: options.page > 1
        } } });

    } catch (error: any) {
        console.error('Get user notifications error:', error);
        next(errorHandler(500, "Server error while fetching notifications"));
    }
};

export const getNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { notificationId } = req.params as any;
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return next(errorHandler(404, "Notification not found"));
        }
        if (notification.recipient.toString() !== ((req as any).user?._id || '').toString()) {
            return next(errorHandler(403, "You can only access your own notifications"));
        }
        res.status(200).json({ success: true, data: { notification } });
    } catch (error: any) {
        console.error('Get notification error:', error);
        next(errorHandler(500, "Server error while fetching notification"));
    }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { notificationId } = req.params as any;
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return next(errorHandler(404, "Notification not found"));
        }
        if (notification.recipient.toString() !== ((req as any).user?._id || '').toString()) {
            return next(errorHandler(403, "You can only mark your own notifications as read"));
        }
        notification.readAt = new Date();
        await notification.save();
        res.status(200).json({ success: true, message: "Notification marked as read", data: { notification } });
    } catch (error: any) {
        console.error('Mark as read error:', error);
        next(errorHandler(500, "Server error while marking notification as read"));
    }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result: any = await Notification.updateMany({ recipient: (req as any).user?._id, readAt: null }, { readAt: new Date() });
        res.status(200).json({ success: true, message: "All notifications marked as read", data: { count: result.modifiedCount } });
    } catch (error: any) {
        console.error('Mark all as read error:', error);
        next(errorHandler(500, "Server error while marking notifications as read"));
    }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { notificationId } = req.params as any;
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return next(errorHandler(404, "Notification not found"));
        }
        if (notification.recipient.toString() !== ((req as any).user?._id || '').toString()) {
            return next(errorHandler(403, "You can only delete your own notifications"));
        }
        await Notification.findByIdAndDelete(notificationId);
        res.status(200).json({ success: true, message: "Notification deleted successfully" });
    } catch (error: any) {
        console.error('Delete notification error:', error);
        next(errorHandler(500, "Server error while deleting notification"));
    }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const count = await Notification.countDocuments({
            recipient: (req as any).user?._id,
            readAt: null
        });
        res.status(200).json({ success: true, data: { unreadCount: count } });
    } catch (error: any) {
        console.error('Get unread count error:', error);
        next(errorHandler(500, "Server error while fetching unread count"));
    }
};

export const getUnreadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notifications = await Notification.find({
            recipient: (req as any).user?._id,
            readAt: null
        })
            .sort({ createdAt: 'desc' })
            .limit(50);

        res.status(200).json({ success: true, data: { notifications, count: notifications.length } });
    } catch (error: any) {
        console.error('Get unread notifications error:', error);
        next(errorHandler(500, "Server error while fetching unread notifications"));
    }
};

export const getNotificationsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { category } = req.params as any;
        const notifications = await Notification.find({
            recipient: (req as any).user?._id,
            category
        })
            .sort({ createdAt: 'desc' })
            .limit(50);

        res.status(200).json({ success: true, data: { notifications, count: notifications.length } });
    } catch (error: any) {
        console.error('Get notifications by category error:', error);
        next(errorHandler(500, "Server error while fetching notifications"));
    }
};

export const sendInvoiceReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoice } = req.body as any;
        if (!invoice) {
            return next(errorHandler(400, "Invoice ID is required"));
        }

        const invoiceDoc: any = await Invoice.findById(invoice).populate('client', 'firstName lastName email phone');
        if (!invoiceDoc) {
            return next(errorHandler(404, "Invoice not found"));
        }

        const subject = `Payment Reminder - Invoice ${invoiceDoc.invoiceNumber}`;
        const message = `Dear ${invoiceDoc.client.firstName}, your invoice ${invoiceDoc.invoiceNumber} for $${invoiceDoc.totalAmount} is due on ${invoiceDoc.dueDate}. Please make payment at your earliest convenience.`;

        const notification = new Notification({
            recipient: invoiceDoc.client._id,
            recipientModel: 'User',
            type: 'email',
            category: 'invoice',
            subject,
            message
        });

        await notification.save();
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();

        res.status(200).json({ success: true, message: "Invoice reminder sent successfully" });
    } catch (error: any) {
        console.error('Send invoice reminder error:', error);
        next(errorHandler(500, "Server error while sending invoice reminder"));
    }
};

export const sendPaymentConfirmation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { payment } = req.body as any;
        if (!payment) {
            return next(errorHandler(400, "Payment ID is required"));
        }

        const paymentDoc: any = await Payment.findById(payment)
            .populate('client', 'firstName lastName email phone')
            .populate('invoice', 'invoiceNumber projectTitle');

        if (!paymentDoc) {
            return next(errorHandler(404, "Payment not found"));
        }

        const subject = `Payment Confirmed - ${paymentDoc.invoice.invoiceNumber}`;
        const message = `Dear ${paymentDoc.client.firstName}, we have received your payment of $${paymentDoc.amount} for invoice ${paymentDoc.invoice.invoiceNumber}. Transaction ID: ${paymentDoc.transactionId || 'N/A'}. Thank you!`;

        const notification = new Notification({
            recipient: paymentDoc.client._id,
            recipientModel: 'User',
            type: 'email',
            category: 'payment',
            subject,
            message
        });

        await notification.save();
        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();

        res.status(200).json({ success: true, message: "Payment confirmation sent successfully" });
    } catch (error: any) {
        console.error('Send payment confirmation error:', error);
        next(errorHandler(500, "Server error while sending payment confirmation"));
    }
};

export const sendProjectUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { project, message } = req.body as any;
        if (!project || !message) {
            return next(errorHandler(400, "Project ID and message are required"));
        }

        const projectDoc: any = await Project.findById(project)
            .populate('client', 'firstName lastName email')
            .populate('assignedTo', 'firstName lastName email');

        if (!projectDoc) {
            return next(errorHandler(404, "Project not found"));
        }

        const subject = `Project Update - ${projectDoc.title}`;
        let sentCount = 0;

        // Notify client
        const clientNotification = new Notification({
            recipient: projectDoc.client._id,
            recipientModel: 'User',
            type: 'in_app',
            category: 'project',
            subject,
            message,
            status: 'sent',
            sentAt: new Date()
        });
        await clientNotification.save();
        sentCount++;

        // Notify team members
        for (const teamMember of projectDoc.assignedTo) {
            const teamNotification = new Notification({
                recipient: teamMember._id,
                recipientModel: 'User',
                type: 'in_app',
                category: 'project',
                subject,
                message,
                status: 'sent',
                sentAt: new Date()
            });
            await teamNotification.save();
            sentCount++;
        }

        res.status(200).json({ success: true, message: `Project update sent to ${sentCount} recipients` });
    } catch (error: any) {
        console.error('Send project update error:', error);
        next(errorHandler(500, "Server error while sending project update"));
    }
};

export const sendBulkNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipients, recipientModel, type, category, subject, message } = req.body as any;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return next(errorHandler(400, "Recipients array is required"));
        }

        let successCount = 0;
        let failureCount = 0;

        for (const recipientId of recipients) {
            try {
                const notification = new Notification({
                    recipient: recipientId,
                    recipientModel,
                    type,
                    category,
                    subject,
                    message,
                    status: 'sent',
                    sentAt: new Date()
                });
                await notification.save();
                successCount++;
            } catch (error) {
                failureCount++;
            }
        }

        res.status(200).json({ success: true, message: "Bulk notification sent", data: {
            total: recipients.length,
            success: successCount,
            failed: failureCount
        } });
    } catch (error: any) {
        console.error('Send bulk notification error:', error);
        next(errorHandler(500, "Server error while sending bulk notification"));
    }
};

