import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Notification from '../models/Notification';
import User from '../models/User';
import Client from '../models/Client';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';

export const sendNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipient, recipientModel, type, category, subject, message, metadata } = req.body as any;

        if (!recipient || !recipientModel || !type || !category || !subject || !message) {
            return next(errorHandler(400, "All fields are required"));
        }

        const RecipientModel = recipientModel === 'User' ? User : Client;
        const recipientExists = await RecipientModel.findById(recipient);
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


