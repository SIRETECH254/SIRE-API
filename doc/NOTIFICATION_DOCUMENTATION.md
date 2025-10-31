
# 🔔 SIRE Tech API - Notification System Documentation

## 📋 Table of Contents
- [Notification Overview](#notification-overview)
- [Notification Model](#notification-model)
- [Notification Controller](#notification-controller)
- [Notification Routes](#notification-routes)
- [Notification Services](#notification-services)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 📢 Notification Overview

The SIRE Tech API Notification System handles all notification-related operations including multi-channel delivery (email, SMS, in-app, push), notification management, read status tracking, and real-time updates. Notifications keep users and clients informed about important events.

### Notification System Features
- **Multi-Channel Delivery** - Email, SMS, In-app, Push notifications
- **Category-Based** - Invoice, payment, project, quotation, general
- **Real-time Notifications** - Socket.io for instant delivery
- **Email Templates** - Professional HTML email templates
- **SMS Integration** - Africa's Talking SMS service
- **Read Status Tracking** - Mark as read/unread
- **Notification Preferences** - User-configurable preferences
- **Bulk Operations** - Mark all as read, batch sending
- **Priority Levels** - High, medium, low priority
- **Notification History** - Complete notification log
- **Recipient Management** - Support for Users and Clients

### Notification Types
1. **Email** - HTML formatted emails via Nodemailer
2. **SMS** - Text messages via Africa's Talking
3. **In-app** - Real-time notifications via Socket.io
4. **Push** - Push notifications (future enhancement)

### Notification Categories
1. **Invoice** - Invoice sent, payment due, overdue reminders
2. **Payment** - Payment received, payment confirmation
3. **Project** - Status updates, milestone completion, assignment
4. **Quotation** - Quotation sent, acceptance, rejection
5. **General** - System announcements, account updates

---

## 🗄️ Notification Model

### Schema Definition
```typescript
interface INotification {
  _id: string;
  recipient: ObjectId;           // Reference to User or Client
  recipientModel: 'User' | 'Client';
  type: 'email' | 'sms' | 'push' | 'in_app';
  category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
  subject: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Recipient Flexibility** - Support for both Users and Clients
- **Multi-Channel** - Single notification can be sent via multiple channels
- **Category Organization** - Organized by business function
- **Status Tracking** - Track delivery status
- **Read Receipts** - Track when notifications are read
- **Metadata Storage** - Store additional notification data
- **Audit Trail** - Complete notification history
- **Filtering** - Filter by category, type, status

### Validation Rules
```typescript
// Required fields
recipient: { required: true, refPath: 'recipientModel' }
recipientModel: { required: true, enum: ['User', 'Client'] }
type: { required: true, enum: ['email', 'sms', 'push', 'in_app'] }
category: { required: true, enum: ['invoice', 'payment', 'project', 'quotation', 'general'] }
subject: { required: true, maxlength: 200 }
message: { required: true }
status: { required: true, enum: ['pending', 'sent', 'failed'], default: 'pending' }

// Optional fields
sentAt: { type: Date }
readAt: { type: Date }
metadata: { type: Object }
```

### Model Implementation

**File: `src/models/Notification.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { INotification } from '../types/index';

const notificationSchema = new Schema<INotification>({
  recipient: {
    type: Schema.Types.ObjectId,
    required: [true, 'Recipient is required'],
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: [true, 'Recipient model is required'],
    enum: {
      values: ['User', 'Client'],
      message: 'Recipient model must be User or Client'
    }
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: {
      values: ['email', 'sms', 'push', 'in_app'],
      message: 'Type must be email, sms, push, or in_app'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['invoice', 'payment', 'project', 'quotation', 'general'],
      message: 'Category must be invoice, payment, project, quotation, or general'
    }
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'sent', 'failed'],
      message: 'Status must be pending, sent, or failed'
    },
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ recipient: 1 });
notificationSchema.index({ recipientModel: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ readAt: 1 });
notificationSchema.index({ recipient: 1, readAt: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for unread status
notificationSchema.virtual('isUnread').get(function() {
  return !this.readAt;
});

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
```

---

## 🎮 Notification Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Notification from '../models/Notification';
import User from '../models/User';
import Client from '../models/Client';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Project from '../models/Project';
import { sendEmail } from '../services/external/emailService';
import { sendSMS } from '../services/external/smsService';
```

### Functions Overview

#### `sendNotification(notificationData)`
**Purpose:** Send notification to user or client
**Access:** Admin users or System
**Validation:**
- Recipient existence check
- Valid notification type and category
- Message content validation
**Process:**
- Create notification record
- Send via specified channel(s)
- Update status based on delivery
- Emit Socket.io event for in-app
**Response:** Notification data

**Controller Implementation:**
```typescript
export const sendNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipient, recipientModel, type, category, subject, message, metadata }: {
            recipient: string;
            recipientModel: 'User' | 'Client';
            type: 'email' | 'sms' | 'push' | 'in_app';
            category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
            subject: string;
            message: string;
            metadata?: any;
        } = req.body;

        // Validation
        if (!recipient || !recipientModel || !type || !category || !subject || !message) {
            return next(errorHandler(400, "All fields are required"));
        }

        // Verify recipient exists
        const RecipientModel = recipientModel === 'User' ? User : Client;
        const recipientExists = await RecipientModel.findById(recipient);
        if (!recipientExists) {
            return next(errorHandler(404, "Recipient not found"));
        }

        // Create notification
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

        // Send based on type
        try {
            if (type === 'email') {
                await sendEmail(recipientExists.email, subject, message);
                notification.status = 'sent';
                notification.sentAt = new Date();
            } else if (type === 'sms' && recipientExists.phone) {
                await sendSMS(recipientExists.phone, message);
                notification.status = 'sent';
                notification.sentAt = new Date();
            } else if (type === 'in_app') {
                // Emit Socket.io event
                const io = req.app.get('io');
                if (io) {
                    io.to(`user_${recipient}`).emit('notification', notification);
                }
                notification.status = 'sent';
                notification.sentAt = new Date();
            }
        } catch (sendError: any) {
            console.error('Send notification error:', sendError);
            notification.status = 'failed';
        }

        await notification.save();

        res.status(201).json({
            success: true,
            message: "Notification sent successfully",
            data: {
                notification: notification
            }
        });

    } catch (error: any) {
        console.error('Send notification error:', error);
        next(errorHandler(500, "Server error while sending notification"));
    }
};
```

#### `getUserNotifications(userId, query)`
**Purpose:** Get user's notifications with filtering
**Access:** User themselves or Admin
**Features:**
- Pagination
- Filter by category
- Filter by read/unread status
- Sort by date
- Mark as read on fetch (optional)
**Response:** Paginated notification list

**Controller Implementation:**
```typescript
export const getUserNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, category, status } = req.query;

        const query: any = {
            recipient: req.user?._id
        };

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Filter by read/unread
        if (status === 'unread') {
            query.readAt = null;
        } else if (status === 'read') {
            query.readAt = { $ne: null };
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Notification.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                notifications: notifications,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalNotifications: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get user notifications error:', error);
        next(errorHandler(500, "Server error while fetching notifications"));
    }
};
```

#### `getNotification(notificationId)`
**Purpose:** Get single notification details
**Access:** Recipient or Admin
**Response:** Complete notification data

**Controller Implementation:**
```typescript
export const getNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findById(notificationId);

        if (!notification) {
            return next(errorHandler(404, "Notification not found"));
        }

        // Verify ownership
        if (notification.recipient.toString() !== req.user?._id.toString()) {
            return next(errorHandler(403, "You can only access your own notifications"));
        }

        res.status(200).json({
            success: true,
            data: {
                notification: notification
            }
        });

    } catch (error: any) {
        console.error('Get notification error:', error);
        next(errorHandler(500, "Server error while fetching notification"));
    }
};
```

#### `markAsRead(notificationId)`
**Purpose:** Mark notification as read
**Access:** Recipient only
**Process:**
- Verify ownership
- Set readAt timestamp
- Emit Socket.io update
**Response:** Updated notification

**Controller Implementation:**
```typescript
export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findById(notificationId);

        if (!notification) {
            return next(errorHandler(404, "Notification not found"));
        }

        // Verify ownership
        if (notification.recipient.toString() !== req.user?._id.toString()) {
            return next(errorHandler(403, "You can only mark your own notifications as read"));
        }

        notification.readAt = new Date();
        await notification.save();

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: {
                notification: notification
            }
        });

    } catch (error: any) {
        console.error('Mark as read error:', error);
        next(errorHandler(500, "Server error while marking notification as read"));
    }
};
```

#### `markAllAsRead(userId)`
**Purpose:** Mark all user notifications as read
**Access:** User themselves
**Process:**
- Find all unread notifications
- Update readAt for all
- Return count of marked notifications
**Response:** Count of marked notifications

**Controller Implementation:**
```typescript
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await Notification.updateMany(
            {
                recipient: req.user?._id,
                readAt: null
            },
            {
                readAt: new Date()
            }
        );

        res.status(200).json({
            success: true,
            message: "All notifications marked as read",
            data: {
                count: result.modifiedCount
            }
        });

    } catch (error: any) {
        console.error('Mark all as read error:', error);
        next(errorHandler(500, "Server error while marking notifications as read"));
    }
};
```

#### `deleteNotification(notificationId)`
**Purpose:** Delete notification
**Access:** Recipient or Admin
**Validation:**
- Ownership check
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findById(notificationId);

        if (!notification) {
            return next(errorHandler(404, "Notification not found"));
        }

        // Verify ownership
        if (notification.recipient.toString() !== req.user?._id.toString()) {
            return next(errorHandler(403, "You can only delete your own notifications"));
        }

        await Notification.findByIdAndDelete(notificationId);

        res.status(200).json({
            success: true,
            message: "Notification deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete notification error:', error);
        next(errorHandler(500, "Server error while deleting notification"));
    }
};
```

#### `sendInvoiceReminder(invoiceId)`
**Purpose:** Send invoice payment reminder
**Access:** Admin or System (scheduled)
**Process:**
- Fetch invoice details
- Generate reminder message
- Send via email and SMS
- Create notification record
**Response:** Notification data

**Controller Implementation:**
```typescript
export const sendInvoiceReminder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { invoice }: { invoice: string } = req.body;

        if (!invoice) {
            return next(errorHandler(400, "Invoice ID is required"));
        }

        const invoiceDoc = await Invoice.findById(invoice)
            .populate('client', 'firstName lastName email phone');

        if (!invoiceDoc) {
            return next(errorHandler(404, "Invoice not found"));
        }

        const subject = `Payment Reminder - Invoice ${invoiceDoc.invoiceNumber}`;
        const message = `Dear ${invoiceDoc.client.firstName}, your invoice ${invoiceDoc.invoiceNumber} for $${invoiceDoc.totalAmount} is due on ${invoiceDoc.dueDate}. Please make payment at your earliest convenience.`;

        // Send email
        const notification = new Notification({
            recipient: invoiceDoc.client._id,
            recipientModel: 'Client',
            type: 'email',
            category: 'invoice',
            subject,
            message
        });

        await notification.save();
        await sendEmail(invoiceDoc.client.email, subject, message);

        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();

        res.status(200).json({
            success: true,
            message: "Invoice reminder sent successfully"
        });

    } catch (error: any) {
        console.error('Send invoice reminder error:', error);
        next(errorHandler(500, "Server error while sending invoice reminder"));
    }
};
```

#### `sendPaymentConfirmation(paymentId)`
**Purpose:** Send payment confirmation
**Access:** System (triggered by payment)
**Process:**
- Fetch payment and invoice details
- Generate confirmation message
- Send via email and SMS
- Create notification record
**Response:** Notification data

**Controller Implementation:**
```typescript
export const sendPaymentConfirmation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { payment }: { payment: string } = req.body;

        if (!payment) {
            return next(errorHandler(400, "Payment ID is required"));
        }

        const paymentDoc = await Payment.findById(payment)
            .populate('client', 'firstName lastName email phone')
            .populate('invoice', 'invoiceNumber projectTitle');

        if (!paymentDoc) {
            return next(errorHandler(404, "Payment not found"));
        }

        const subject = `Payment Confirmed - ${paymentDoc.invoice.invoiceNumber}`;
        const message = `Dear ${paymentDoc.client.firstName}, we have received your payment of $${paymentDoc.amount} for invoice ${paymentDoc.invoice.invoiceNumber}. Transaction ID: ${paymentDoc.transactionId || 'N/A'}. Thank you!`;

        // Create notification
        const notification = new Notification({
            recipient: paymentDoc.client._id,
            recipientModel: 'Client',
            type: 'email',
            category: 'payment',
            subject,
            message
        });

        await notification.save();
        await sendEmail(paymentDoc.client.email, subject, message);

        notification.status = 'sent';
        notification.sentAt = new Date();
        await notification.save();

        res.status(200).json({
            success: true,
            message: "Payment confirmation sent successfully"
        });

    } catch (error: any) {
        console.error('Send payment confirmation error:', error);
        next(errorHandler(500, "Server error while sending payment confirmation"));
    }
};
```

#### `sendProjectUpdate(projectId, message)`
**Purpose:** Notify team and client about project updates
**Access:** Admin or team members
**Process:**
- Get project team and client
- Create notifications for all
- Send via preferred channels
- Emit Socket.io event
**Response:** Notification count

**Controller Implementation:**
```typescript
export const sendProjectUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { project, message }: { project: string; message: string } = req.body;

        if (!project || !message) {
            return next(errorHandler(400, "Project ID and message are required"));
        }

        const projectDoc = await Project.findById(project)
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
            recipientModel: 'Client',
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

        // Emit Socket.io events
        const io = req.app.get('io');
        if (io) {
            io.to(`project_${project}`).emit('project_update', {
                projectId: project,
                message
            });
        }

        res.status(200).json({
            success: true,
            message: `Project update sent to ${sentCount} recipients`
        });

    } catch (error: any) {
        console.error('Send project update error:', error);
        next(errorHandler(500, "Server error while sending project update"));
    }
};
```

#### `sendBulkNotification(recipients, message)`
**Purpose:** Send notification to multiple recipients
**Access:** Admin only
**Process:**
- Validate all recipients
- Create notification for each
- Send via specified channels
- Track success/failure
**Response:** Delivery summary

**Controller Implementation:**
```typescript
export const sendBulkNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { recipients, recipientModel, type, category, subject, message }: {
            recipients: string[];
            recipientModel: 'User' | 'Client';
            type: 'email' | 'sms' | 'in_app';
            category: string;
            subject: string;
            message: string;
        } = req.body;

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

        res.status(200).json({
            success: true,
            message: "Bulk notification sent",
            data: {
                total: recipients.length,
                success: successCount,
                failed: failureCount
            }
        });

    } catch (error: any) {
        console.error('Send bulk notification error:', error);
        next(errorHandler(500, "Server error while sending bulk notification"));
    }
};
```

#### `getUnreadCount(userId)`
**Purpose:** Get count of unread notifications
**Access:** User themselves
**Response:** Unread notification count

**Controller Implementation:**
```typescript
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user?._id,
            readAt: null
        });

        res.status(200).json({
            success: true,
            data: {
                unreadCount: count
            }
        });

    } catch (error: any) {
        console.error('Get unread count error:', error);
        next(errorHandler(500, "Server error while fetching unread count"));
    }
};
```

#### `getUnreadNotifications()`
**Purpose:** Get all unread notifications
**Access:** User themselves
**Response:** List of unread notifications

**Controller Implementation:**
```typescript
export const getUnreadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const notifications = await Notification.find({
            recipient: req.user?._id,
            readAt: null
        })
            .sort({ createdAt: 'desc' })
            .limit(50);

        res.status(200).json({
            success: true,
            data: {
                notifications: notifications,
                count: notifications.length
            }
        });

    } catch (error: any) {
        console.error('Get unread notifications error:', error);
        next(errorHandler(500, "Server error while fetching unread notifications"));
    }
};
```

#### `getNotificationsByCategory(category)`
**Purpose:** Get notifications by category
**Access:** User themselves
**Response:** Filtered notification list

**Controller Implementation:**
```typescript
export const getNotificationsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { category } = req.params;

        const notifications = await Notification.find({
            recipient: req.user?._id,
            category
        })
            .sort({ createdAt: 'desc' })
            .limit(50);

        res.status(200).json({
            success: true,
            data: {
                notifications: notifications,
                count: notifications.length
            }
        });

    } catch (error: any) {
        console.error('Get notifications by category error:', error);
        next(errorHandler(500, "Server error while fetching notifications"));
    }
};
```

---

## 🛣️ Notification Routes

### Base Path: `/api/notifications`

```typescript
// Notification Management Routes
POST   /                          // Send notification
GET    /                          // Get user notifications (paginated)
GET    /unread-count              // Get unread count

// Notification Actions
GET    /:notificationId           // Get single notification
PATCH  /:notificationId/read      // Mark as read
DELETE /:notificationId           // Delete notification
PATCH  /read-all                  // Mark all as read

// Specific Notification Types
POST   /invoice-reminder          // Send invoice reminder
POST   /payment-confirmation      // Send payment confirmation
POST   /project-update            // Send project update
POST   /bulk                      // Send bulk notification

// Query Routes
GET    /category/:category        // Get notifications by category
GET    /unread                    // Get unread notifications
```

### Router Implementation

**File: `src/routes/notificationRoutes.ts`**

```typescript
import express from 'express';
import {
    sendNotification,
    getUserNotifications,
    getNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendInvoiceReminder,
    sendPaymentConfirmation,
    sendProjectUpdate,
    sendBulkNotification,
    getUnreadCount,
    getNotificationsByCategory,
    getUnreadNotifications
} from '../controllers/notificationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/notifications
 * @desc    Send notification
 * @access  Private (Admin)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), sendNotification);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', authenticateToken, getUserNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticateToken, getUnreadCount);

/**
 * @route   GET /api/notifications/unread
 * @desc    Get unread notifications
 * @access  Private
 */
router.get('/unread', authenticateToken, getUnreadNotifications);

/**
 * @route   GET /api/notifications/category/:category
 * @desc    Get notifications by category
 * @access  Private
 */
router.get('/category/:category', authenticateToken, getNotificationsByCategory);

/**
 * @route   GET /api/notifications/:notificationId
 * @desc    Get single notification
 * @access  Private
 */
router.get('/:notificationId', authenticateToken, getNotification);

/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:notificationId/read', authenticateToken, markAsRead);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', authenticateToken, markAllAsRead);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:notificationId', authenticateToken, deleteNotification);

/**
 * @route   POST /api/notifications/invoice-reminder
 * @desc    Send invoice payment reminder
 * @access  Private (Admin)
 */
router.post('/invoice-reminder', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendInvoiceReminder);

/**
 * @route   POST /api/notifications/payment-confirmation
 * @desc    Send payment confirmation
 * @access  Private (Admin)
 */
router.post('/payment-confirmation', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendPaymentConfirmation);

/**
 * @route   POST /api/notifications/project-update
 * @desc    Send project update notification
 * @access  Private (Admin, Project Manager)
 */
router.post('/project-update', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), sendProjectUpdate);

/**
 * @route   POST /api/notifications/bulk
 * @desc    Send bulk notification
 * @access  Private (Admin)
 */
router.post('/bulk', authenticateToken, authorizeRoles(['super_admin']), sendBulkNotification);

export default router;
```

### Route Details

#### `POST /api/notifications`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "recipient": "user_id_here",
  "recipientModel": "User",
  "type": "in_app",
  "category": "project",
  "subject": "Project Update",
  "message": "Your project status has been updated to 'In Progress'",
  "metadata": {
    "projectId": "project_id_here"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": {
    "notification": {
      "_id": "...",
      "recipient": "...",
      "recipientModel": "User",
      "type": "in_app",
      "category": "project",
      "subject": "Project Update",
      "message": "Your project status has been updated to 'In Progress'",
      "status": "sent",
      "sentAt": "2025-01-01T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/notifications`
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `category` (optional): Filter by category (invoice, payment, project, quotation, general)
- `type` (optional): Filter by type (email, sms, push, in_app)
- `status` (optional): Filter by status (pending, sent, failed)

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalNotifications": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/notifications/unread-count`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

#### `GET /api/notifications/unread`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "subject": "Invoice Payment Due",
        "message": "Your invoice INV-2025-0001 is due in 3 days",
        "category": "invoice",
        "readAt": null,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/notifications/category/:category`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `category` - The notification category (invoice, payment, project, quotation, general)

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "subject": "Invoice Payment Due",
        "category": "invoice",
        "readAt": null,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/notifications/:notificationId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `notificationId` - The notification ID

**Response:**
```json
{
  "success": true,
  "data": {
    "notification": {
      "_id": "...",
      "recipient": {...},
      "recipientModel": "User",
      "type": "in_app",
      "category": "project",
      "subject": "Project Update",
      "message": "Your project status has been updated to 'In Progress'",
      "status": "sent",
      "sentAt": "2025-01-01T00:00:00.000Z",
      "readAt": null,
      "metadata": {
        "projectId": "project_id_here"
      },
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `PATCH /api/notifications/:notificationId/read`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `notificationId` - The notification ID

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "...",
      "readAt": "2025-01-01T00:00:00.000Z",
      ...
    }
  }
}
```

#### `PATCH /api/notifications/read-all`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 10
  }
}
```

#### `DELETE /api/notifications/:notificationId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `notificationId` - The notification ID

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

#### `POST /api/notifications/invoice-reminder`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "invoiceId": "invoice_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice reminder sent successfully",
  "data": {
    "notification": {
      "_id": "...",
      "subject": "Invoice Payment Reminder",
      "category": "invoice",
      ...
    }
  }
}
```

#### `POST /api/notifications/payment-confirmation`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "paymentId": "payment_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmation sent successfully",
  "data": {
    "notification": {
      "_id": "...",
      "subject": "Payment Confirmation",
      "category": "payment",
      ...
    }
  }
}
```

#### `POST /api/notifications/project-update`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "projectId": "project_id_here",
  "message": "Project status updated to 'In Progress'"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project update notification sent successfully",
  "data": {
    "notification": {
      "_id": "...",
      "subject": "Project Update",
      "category": "project",
      ...
    }
  }
}
```

#### `POST /api/notifications/bulk`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Body:**
```json
{
  "recipients": ["user_id_1", "user_id_2", "user_id_3"],
  "recipientModel": "User",
  "type": "email",
  "category": "general",
  "subject": "System Maintenance",
  "message": "System will be under maintenance on January 5, 2025"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk notification sent successfully",
  "data": {
    "sentCount": 3,
    "failedCount": 0,
    "notifications": [...]
  }
}
```

---

## 📧 Notification Services

### Email Service

**File: `src/services/external/emailService.ts`**

```typescript
import nodemailer from 'nodemailer';

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email notification
export const sendEmail = async (
  to: string,
  subject: string,
  htmlContent: string
) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"SIRE Tech" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: htmlContent
  };
  
  const result = await transporter.sendMail(mailOptions);
  return { success: true, messageId: result.messageId };
};
```

### SMS Service

**File: `src/services/external/smsService.ts`**

```typescript
import AfricasTalking from 'africastalking';

// Initialize Africa's Talking
const africasTalking = AfricasTalking({
  apiKey: process.env.AFRICAS_TALKING_API_KEY,
  username: process.env.AFRICAS_TALKING_USERNAME
});

const sms = africasTalking.SMS;

// Send SMS notification
export const sendSMS = async (
  phone: string,
  message: string
) => {
  const options = {
    to: [phone],
    message,
    from: 'SIRE_TECH'
  };
  
  const result = await sms.send(options);
  
  if (result.SMSMessageData.Recipients[0].status === 'Success') {
    return {
      success: true,
      messageId: result.SMSMessageData.Recipients[0].messageId
    };
  } else {
    return {
      success: false,
      error: result.SMSMessageData.Recipients[0].status
    };
  }
};
```

### Real-time Service (Socket.io)

**File: `src/services/internal/socketService.ts`**

```typescript
// Send in-app notification via Socket.io
export const sendInAppNotification = (
  io: any,
  userId: string,
  notification: any
) => {
  // Emit to specific user's socket
  io.to(userId).emit('notification', notification);
  
  // Also emit to general notification room
  io.to(`user_${userId}`).emit('new_notification', notification);
};
```

---

## 📝 API Examples

### Send Notification
```bash
curl -X POST http://localhost:5000/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "recipient": "user_id_or_client_id",
    "recipientModel": "Client",
    "type": "email",
    "category": "invoice",
    "subject": "Invoice Payment Due",
    "message": "Your invoice INV-2025-0001 is due on Dec 15, 2025"
  }'
```

### Get User Notifications
```bash
curl -X GET "http://localhost:5000/api/notifications?page=1&limit=10&category=invoice&status=unread" \
  -H "Authorization: Bearer <token>"
```

### Mark as Read
```bash
curl -X PATCH http://localhost:5000/api/notifications/<notificationId>/read \
  -H "Authorization: Bearer <token>"
```

### Mark All as Read
```bash
curl -X PATCH http://localhost:5000/api/notifications/read-all \
  -H "Authorization: Bearer <token>"
```

### Get Unread Count
```bash
curl -X GET http://localhost:5000/api/notifications/unread-count \
  -H "Authorization: Bearer <token>"
```

### Send Invoice Reminder
```bash
curl -X POST http://localhost:5000/api/notifications/invoice-reminder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "invoice": "invoice_id_here"
  }'
```

### Send Bulk Notification
```bash
curl -X POST http://localhost:5000/api/notifications/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "recipients": ["user_id_1", "user_id_2", "client_id_1"],
    "recipientModel": "Client",
    "type": "email",
    "category": "general",
    "subject": "System Maintenance Notice",
    "message": "Our system will be under maintenance on Dec 20, 2025"
  }'
```

---

## 🔧 Notification Templates

### Email Templates

#### Invoice Reminder Template
```typescript
export const invoiceReminderTemplate = (
  clientName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Payment Reminder</h2>
    <p>Dear ${clientName},</p>
    <p>This is a friendly reminder that your invoice <strong>${invoiceNumber}</strong> 
    for <strong>$${amount}</strong> is due on <strong>${dueDate}</strong>.</p>
    <a href="${process.env.FRONTEND_URL}/invoices/${invoiceNumber}" 
       style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      View Invoice
    </a>
  </div>
`;
```

#### Payment Confirmation Template
```typescript
export const paymentConfirmationTemplate = (
  clientName: string,
  amount: number,
  invoiceNumber: string,
  transactionId: string
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Payment Confirmed ✅</h2>
    <p>Dear ${clientName},</p>
    <p>We have received your payment of <strong>$${amount}</strong> 
    for invoice <strong>${invoiceNumber}</strong>.</p>
    <p>Transaction ID: <strong>${transactionId}</strong></p>
    <p>Thank you for your business!</p>
  </div>
`;
```

### SMS Templates

```typescript
// Invoice reminder SMS
`Hi ${name}! Invoice ${invoiceNumber} for $${amount} is due on ${dueDate}. Pay at ${paymentLink}`;

// Payment confirmation SMS
`Payment of $${amount} received for invoice ${invoiceNumber}. Transaction ID: ${transactionId}. Thank you!`;

// Project update SMS
`Project update: ${projectTitle} - ${message}. View details at ${projectLink}`;
```

---

## 🔒 Security Features

### Access Control
- **Recipient Verification** - Users can only access their notifications
- **Admin Override** - Admins can send system-wide notifications
- **Channel Permissions** - Validate user preferences
- **Bulk Send Restrictions** - Admin only

### Data Protection
- **Personal Data** - Respect user privacy
- **Preference Management** - Honor notification preferences
- **Opt-out Support** - Allow users to disable channels
- **Data Retention** - Auto-delete old notifications

### Input Validation
- **Required Fields** - Subject and message validation
- **Content Sanitization** - Prevent XSS in messages
- **Recipient Validation** - Verify recipient exists
- **Type Validation** - Valid notification types only

---

## 🚨 Error Handling

### Common Errors
```json
// 404 - Recipient Not Found
{
  "success": false,
  "message": "Recipient not found"
}

// 403 - Access Denied
{
  "success": false,
  "message": "You can only access your own notifications"
}

// 500 - Delivery Failed
{
  "success": false,
  "message": "Failed to send notification",
  "error": "Email service unavailable"
}
```

---

## 🔗 Integration with Other Modules

### User Integration
- User notification preferences
- In-app notifications
- Email and SMS delivery

### Client Integration
- Client notifications
- Invoice and payment alerts
- Project updates

### Invoice Integration
- Payment reminders
- Overdue notifications
- Invoice delivery

### Payment Integration
- Payment confirmations
- Receipt delivery
- Transaction alerts

### Project Integration
- Status change notifications
- Milestone alerts
- Team assignment notifications

### Real-time Integration
- Socket.io for instant delivery
- Live notification center
- Unread count badges
- Push notifications

---

## 📊 Notification Preferences

### User Preferences Schema
```typescript
notificationPreferences: {
  email: { type: Boolean, default: true },
  sms: { type: Boolean, default: true },
  inApp: { type: Boolean, default: true },
  categories: {
    invoice: { type: Boolean, default: true },
    payment: { type: Boolean, default: true },
    project: { type: Boolean, default: true },
    quotation: { type: Boolean, default: true },
    general: { type: Boolean, default: true }
  }
}
```

### Update Preferences
```bash
curl -X PUT http://localhost:5000/api/users/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "email": true,
    "sms": false,
    "inApp": true
  }'
```

---

## 🎯 Best Practices

### Notification Design
1. **Clear Subject** - Descriptive and actionable
2. **Concise Message** - Brief but informative
3. **Call to Action** - Include relevant links
4. **Branding** - Professional templates
5. **Timing** - Send at appropriate times

### Technical Best Practices
1. **Queue System** - Use message queue for high volume (Bull/Redis)
2. **Retry Logic** - Retry failed deliveries
3. **Rate Limiting** - Prevent notification spam
4. **Batch Processing** - Efficient bulk sending
5. **Error Logging** - Track delivery failures

### User Experience
1. **Respect Preferences** - Honor user settings
2. **Unsubscribe Option** - Easy opt-out
3. **Notification Grouping** - Group similar notifications
4. **Priority Levels** - Important vs regular
5. **Do Not Disturb** - Quiet hours support

---

## 🔄 Future Enhancements

### Planned Features
- **Push Notifications** - Firebase Cloud Messaging
- **WhatsApp Integration** - WhatsApp Business API
- **Notification Templates** - Handlebars template engine
- **Scheduled Notifications** - Cron job scheduling
- **Notification Analytics** - Open rates, click rates
- **A/B Testing** - Test notification variations
- **Rich Notifications** - Images, buttons, actions
- **Multi-language** - Internationalization support

### Technical Improvements
- **Message Queue** - Bull/Redis for scalability
- **Delivery Tracking** - Detailed delivery logs
- **Failed Retry System** - Automatic retry with backoff
- **Webhook Management** - Centralized webhook handling
- **Performance Monitoring** - Delivery time tracking

---

## 🔧 Environment Variables

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# SMS Configuration
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username

# Push Notifications (Future)
FIREBASE_SERVER_KEY=your_firebase_server_key
FIREBASE_PROJECT_ID=your_project_id

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
