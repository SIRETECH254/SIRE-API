
# 🔔 SIRE Tech API - Notification System Documentation

## 📋 Table of Contents
- [Notification Overview](#notification-overview)
- [Notification Model](#notification-model)
- [Notification Controller](#notification-controller)
- [Notification Instances](#notification-instances)
- [Bidirectional Notifications](#bidirectional-notifications)
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
  
  // Bidirectional Notification Support
  actions?: NotificationAction[];      // Available actions
  context?: NotificationContext;       // Action context data
  expiresAt?: Date;                   // Action expiry (optional)
  
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationAction {
  id: string;                         // Unique action ID (e.g., 'create_invoice')
  label: string;                      // Button text (e.g., 'Create Invoice')
  type: 'api' | 'navigate' | 'modal' | 'confirm';
  endpoint?: string;                  // API endpoint (for 'api' type)
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, any>;      // Request payload
  route?: string;                     // Navigation route (for 'navigate' type)
  modal?: string;                     // Modal component (for 'modal' type)
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  requiresConfirmation?: boolean;      // Show confirmation dialog
  confirmationMessage?: string;
}

interface NotificationContext {
  resourceId: string;                 // Resource ID (e.g., quotationId)
  resourceType: string;               // Resource type (e.g., 'quotation')
  additionalData?: Record<string, any>;
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

## 📍 Notification Instances

This section identifies all instances across the application where **in-app notifications** should be sent. These notifications help users stay informed about important events and changes in the system.

### 📧 QUOTATION CONTROLLER (`quotationController.ts`)

#### 1. `createQuotation` ✅ **PRIORITY: HIGH**
**Event:** New quotation created  
**Recipients:** 
- **Client** (quotation recipient)
- **Finance Team** (optional - for awareness)

**Controller Location:** `src/controllers/quotationController.ts` - `createQuotation` function (after quotation is saved)

**Implementation:**
```typescript
// After quotation.save() in createQuotation function
await createInAppNotification({
  recipient: quotation.client.toString(),
  recipientModel: 'Client',
  category: 'quotation',
  subject: 'New Quotation Created',
  message: `A new quotation ${quotation.quotationNumber} has been created for your project.`,
  metadata: {
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    projectId: quotation.project
  },
  io: req.app.get('io')
});
```

---

#### 2. `sendQuotation` ✅ **PRIORITY: HIGH**
**Event:** Quotation sent to client via email  
**Recipients:**
- **Client** (to notify in-app that quotation was sent)

**Controller Location:** `src/controllers/quotationController.ts` - `sendQuotation` function (after email is sent)

**Implementation:**
```typescript
// After quotation.status is updated to 'sent' in sendQuotation function
await createInAppNotification({
  recipient: quotation.client._id.toString(),
  recipientModel: 'Client',
  category: 'quotation',
  subject: 'Quotation Sent',
  message: `Quotation ${quotation.quotationNumber} has been sent to your email. Please review and respond.`,
  metadata: {
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    pdfUrl: pdfUrl
  },
  io: req.app.get('io')
});
```

---

#### 3. `acceptQuotation` ✅ **PRIORITY: HIGH**
**Event:** Client accepts quotation  
**Recipients:**
- **Admin/Finance** (who created the quotation)
- **Project Manager** (if project exists)

**Controller Location:** `src/controllers/quotationController.ts` - `acceptQuotation` function (after quotation status is updated)

**Implementation:**
```typescript
// After quotation.status is updated to 'accepted' in acceptQuotation function
// For Admin/Finance who created the quotation
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
  io: req.app.get('io')
});
```

---

#### 4. `rejectQuotation` ✅ **PRIORITY: MEDIUM**
**Event:** Client rejects quotation  
**Recipients:**
- **Admin/Finance** (who created the quotation)

**Controller Location:** `src/controllers/quotationController.ts` - `rejectQuotation` function (after quotation status is updated)

**Implementation:**
```typescript
// After quotation.status is updated to 'rejected' in rejectQuotation function
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
  io: req.app.get('io')
});
```

---

#### 5. `updateQuotation` ⚠️ **PRIORITY: LOW**
**Event:** Quotation details updated (if status is 'sent')  
**Recipients:**
- **Client** (if quotation was already sent)

**Controller Location:** `src/controllers/quotationController.ts` - `updateQuotation` function (after quotation is updated, only if status is 'sent')

**Implementation:**
```typescript
// After quotation is updated in updateQuotation function (only if status is 'sent')
if (quotation.status === 'sent') {
  await createInAppNotification({
    recipient: quotation.client.toString(),
    recipientModel: 'Client',
    category: 'quotation',
    subject: 'Quotation Updated',
    message: `Quotation ${quotation.quotationNumber} has been updated. Please review the changes.`,
    metadata: {
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber
    },
    io: req.app.get('io')
  });
}
```

---

#### 6. `convertToInvoice` ✅ **PRIORITY: HIGH**
**Event:** Quotation converted to invoice  
**Recipients:**
- **Client** (to notify new invoice was created)
- **Admin/Finance** (confirmation)

**Controller Location:** `src/controllers/quotationController.ts` - `convertToInvoice` function (after invoice is created)

**Implementation:**
```typescript
// After invoice is created and quotation.convertedToInvoice is set in convertToInvoice function
// For Client
await createInAppNotification({
  recipient: invoice.client.toString(),
  recipientModel: 'Client',
  category: 'invoice',
  subject: 'Invoice Created from Quotation',
  message: `Your accepted quotation ${quotation.quotationNumber} has been converted to invoice ${invoice.invoiceNumber}. Payment is now due.`,
  metadata: {
    quotationId: quotation._id,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber
  },
  io: req.app.get('io')
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
  io: req.app.get('io')
});
```

---

### 💰 INVOICE CONTROLLER (`invoiceController.ts`)

#### 7. `createInvoice` ✅ **PRIORITY: HIGH**
**Event:** New invoice created (from quotation or standalone)  
**Recipients:**
- **Client** (invoice recipient)

**Controller Location:** `src/controllers/invoiceController.ts` - `createInvoice` function (after invoice is saved)

**Implementation:**
```typescript
// After invoice.save() in createInvoice function
await createInAppNotification({
  recipient: invoice.client.toString(),
  recipientModel: 'Client',
  category: 'invoice',
  subject: 'New Invoice Created',
  message: `A new invoice ${invoice.invoiceNumber} has been created. Amount: $${invoice.totalAmount.toFixed(2)}`,
  metadata: {
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount,
    dueDate: invoice.dueDate
  },
  io: req.app.get('io')
});
```

---

#### 8. `sendInvoice` ✅ **PRIORITY: HIGH**
**Event:** Invoice sent to client via email  
**Recipients:**
- **Client** (to notify in-app that invoice was sent)

**Controller Location:** `src/controllers/invoiceController.ts` - `sendInvoice` function (after email is sent)

**Implementation:**
```typescript
// After invoice.status is updated to 'sent' in sendInvoice function
await createInAppNotification({
  recipient: invoice.client._id.toString(),
  recipientModel: 'Client',
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
  io: req.app.get('io')
});
```

---

#### 9. `markAsPaid` ✅ **PRIORITY: HIGH**
**Event:** Invoice marked as paid (manually by admin)  
**Recipients:**
- **Client** (payment confirmation)
- **Finance Team** (optional)

**Controller Location:** `src/controllers/invoiceController.ts` - `markAsPaid` function (after invoice status is updated)

**Implementation:**
```typescript
// After invoice.status is updated to 'paid' in markAsPaid function
await createInAppNotification({
  recipient: invoice.client.toString(),
  recipientModel: 'Client',
  category: 'payment',
  subject: 'Invoice Paid',
  message: `Invoice ${invoice.invoiceNumber} has been marked as paid. Thank you for your payment!`,
  metadata: {
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    paidAmount: invoice.paidAmount,
    paymentDate: invoice.paidDate
  },
  io: req.app.get('io')
});
```

---

#### 10. `markAsOverdue` ✅ **PRIORITY: HIGH**
**Event:** Invoice marked as overdue  
**Recipients:**
- **Client** (payment reminder)
- **Finance Team** (alert)

**Controller Location:** `src/controllers/invoiceController.ts` - `markAsOverdue` function (after invoice status is updated)

**Implementation:**
```typescript
// After invoice.status is updated to 'overdue' in markAsOverdue function
await createInAppNotification({
  recipient: invoice.client.toString(),
  recipientModel: 'Client',
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
  io: req.app.get('io')
});
```

---

#### 11. `cancelInvoice` ⚠️ **PRIORITY: MEDIUM**
**Event:** Invoice cancelled  
**Recipients:**
- **Client** (if invoice was sent)
- **Finance Team**

**Controller Location:** `src/controllers/invoiceController.ts` - `cancelInvoice` function (after invoice status is updated)

**Implementation:**
```typescript
// After invoice.status is updated to 'cancelled' in cancelInvoice function
if (invoice.status === 'sent' || invoice.status === 'paid') {
  await createInAppNotification({
    recipient: invoice.client.toString(),
    recipientModel: 'Client',
    category: 'invoice',
    subject: 'Invoice Cancelled',
    message: `Invoice ${invoice.invoiceNumber} has been cancelled. Reason: ${reason}`,
    metadata: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      reason: reason
    },
    io: req.app.get('io')
  });
}
```

---

### 💳 PAYMENT CONTROLLER (`paymentController.ts`)

#### 12. `createPaymentAdmin` / `initiatePayment` ✅ **PRIORITY: HIGH**
**Event:** Payment initiated  
**Recipients:**
- **Client** (payment initiated confirmation)

**Controller Location:** `src/controllers/paymentController.ts` - `createPaymentAdmin` and `initiatePayment` functions (after payment record is created)

**Implementation:**
```typescript
// After payment record is created in createPaymentAdmin or initiatePayment function
await createInAppNotification({
  recipient: payment.client.toString(),
  recipientModel: 'Client',
  category: 'payment',
  subject: 'Payment Initiated',
  message: `Payment of $${payment.amount.toFixed(2)} for invoice ${invoice.invoiceNumber} has been initiated via ${payment.paymentMethod}. Please complete the payment.`,
  metadata: {
    paymentId: payment._id,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    amount: payment.amount,
    method: payment.paymentMethod,
    status: 'pending'
  },
  io: req.app.get('io')
});
```

---

#### 13. Payment Webhook - Success ✅ **PRIORITY: HIGH**
**Event:** Payment completed successfully (M-Pesa/Paystack callback)  
**Recipients:**
- **Client** (payment success confirmation)
- **Finance Team** (optional)

**Controller Location:** `src/controllers/paymentController.ts` - `mpesaWebhook` and `paystackWebhook` functions (when payment status is 'completed')

**Implementation:**
```typescript
// After payment.status is set to 'completed' in mpesaWebhook/paystackWebhook function
await createInAppNotification({
  recipient: payment.client.toString(),
  recipientModel: 'Client',
  category: 'payment',
  subject: 'Payment Successful',
  message: `Your payment of $${payment.amount.toFixed(2)} for invoice ${invoice.invoiceNumber} has been received successfully. Transaction ID: ${payment.transactionId}`,
  actions: [
    {
      id: 'view_invoice',
      label: 'View Invoice',
      type: 'navigate',
      route: `/invoices/${payment.invoice}`,
      variant: 'primary'
    },
    {
      id: 'download_receipt',
      label: 'Download Receipt',
      type: 'api',
      endpoint: `/api/payments/${payment._id}/receipt`,
      method: 'GET',
      variant: 'secondary'
    }
  ],
  context: {
    resourceId: payment.invoice.toString(),
    resourceType: 'invoice'
  },
  metadata: {
    paymentId: payment._id,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    amount: payment.amount,
    transactionId: payment.transactionId,
    paymentDate: payment.paymentDate
  },
  io: req.app.get('io')
});
```

---

#### 14. Payment Webhook - Failed ⚠️ **PRIORITY: MEDIUM**
**Event:** Payment failed  
**Recipients:**
- **Client** (payment failure notification)

**Controller Location:** `src/controllers/paymentController.ts` - `mpesaWebhook` and `paystackWebhook` functions (when payment status is 'failed')

**Implementation:**
```typescript
// After payment.status is set to 'failed' in mpesaWebhook/paystackWebhook function
await createInAppNotification({
  recipient: payment.client.toString(),
  recipientModel: 'Client',
  category: 'payment',
  subject: 'Payment Failed',
  message: `Your payment of $${payment.amount.toFixed(2)} for invoice ${invoice.invoiceNumber} failed. Please try again or contact support.`,
  actions: [
    {
      id: 'retry_payment',
      label: 'Try Again',
      type: 'api',
      endpoint: '/api/payments/initiate',
      method: 'POST',
      payload: {
        invoiceId: invoice._id.toString(),
        amount: payment.amount
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
    paymentId: payment._id,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    amount: payment.amount,
    error: errorMessage
  },
  io: req.app.get('io')
});
```

---

### 🚀 PROJECT CONTROLLER (`projectController.ts`)

#### 15. `createProject` ✅ **PRIORITY: HIGH**
**Event:** New project created  
**Recipients:**
- **Client** (project owner)
- **Assigned Team Members** (if assignedTo is provided)

**Controller Location:** `src/controllers/projectController.ts` - `createProject` function (after project is saved)

**Implementation:**
```typescript
// After project.save() in createProject function
// For Client
await createInAppNotification({
  recipient: project.client.toString(),
  recipientModel: 'Client',
  category: 'project',
  subject: 'New Project Created',
  message: `A new project "${project.title}" has been created.`,
  metadata: {
    projectId: project._id,
    projectNumber: project.projectNumber,
    title: project.title,
    priority: project.priority
  },
  io: req.app.get('io')
});

// For Assigned Team Members (if any)
if (project.assignedTo && project.assignedTo.length > 0) {
  for (const userId of project.assignedTo) {
    await createInAppNotification({
      recipient: userId.toString(),
      recipientModel: 'User',
      category: 'project',
      subject: 'New Project Created',
      message: `A new project "${project.title}" has been created and assigned to you.`,
      metadata: {
        projectId: project._id,
        projectNumber: project.projectNumber,
        title: project.title,
        priority: project.priority
      },
      io: req.app.get('io')
    });
  }
}
```

---

#### 16. `assignTeamMembers` ✅ **PRIORITY: HIGH**
**Event:** Team members assigned to project  
**Recipients:**
- **Newly Assigned Team Members** (only those newly added)
- **Client** (optional - to inform who's working on their project)

**Controller Location:** `src/controllers/projectController.ts` - `assignTeamMembers` function (after team members are assigned)

**Implementation:**
```typescript
// After project.assignedTo is updated in assignTeamMembers function
// For newly assigned team members
for (const userId of newUserIds) {
  await createInAppNotification({
    recipient: userId,
    recipientModel: 'User',
    category: 'project',
    subject: 'Assigned to Project',
    message: `You have been assigned to project "${project.title}". Priority: ${project.priority}`,
    actions: [
      {
        id: 'view_project',
        label: 'View Project',
        type: 'navigate',
        route: `/projects/${project._id}`,
        variant: 'primary'
      }
    ],
    context: {
      resourceId: project._id.toString(),
      resourceType: 'project'
    },
    metadata: {
      projectId: project._id,
      projectNumber: project.projectNumber,
      title: project.title,
      priority: project.priority
    },
    io: req.app.get('io')
  });
}
```

---

#### 17. `updateProjectStatus` ✅ **PRIORITY: HIGH**
**Event:** Project status changed  
**Recipients:**
- **Client** (status updates)
- **Assigned Team Members** (status changes)
- **Project Manager** (if status is 'completed' or 'cancelled')

**Controller Location:** `src/controllers/projectController.ts` - `updateProjectStatus` function (after project status is updated)

**Implementation:**
```typescript
// After project.status is updated in updateProjectStatus function
// For Client
await createInAppNotification({
  recipient: project.client.toString(),
  recipientModel: 'Client',
  category: 'project',
  subject: 'Project Status Updated',
  message: `Project "${project.title}" status has been updated to: ${project.status}`,
  actions: [
    {
      id: 'view_project',
      label: 'View Project',
      type: 'navigate',
      route: `/projects/${project._id}`,
      variant: 'primary'
    }
  ],
  metadata: {
    projectId: project._id,
    projectNumber: project.projectNumber,
    title: project.title,
    oldStatus: oldStatus,
    newStatus: project.status
  },
  io: req.app.get('io')
});

// For Assigned Team Members
if (project.assignedTo && project.assignedTo.length > 0) {
  for (const userId of project.assignedTo) {
    await createInAppNotification({
      recipient: userId.toString(),
      recipientModel: 'User',
      category: 'project',
      subject: 'Project Status Updated',
      message: `Project "${project.title}" status has been updated to: ${project.status}`,
      metadata: {
        projectId: project._id,
        projectNumber: project.projectNumber,
        title: project.title,
        oldStatus: oldStatus,
        newStatus: project.status
      },
      io: req.app.get('io')
    });
  }
}
```

---

#### 18. `updateProgress` ✅ **PRIORITY: MEDIUM**
**Event:** Project progress updated (especially milestones like 25%, 50%, 75%, 100%)  
**Recipients:**
- **Client** (for significant progress updates: 25%, 50%, 75%, 100%)
- **Project Manager** (for all updates)

**Controller Location:** `src/controllers/projectController.ts` - `updateProgress` function (after progress is updated, especially for milestone percentages)

**Implementation:**
```typescript
// After project.progress is updated in updateProgress function
// Check if it's a milestone percentage (25, 50, 75, 100)
const isMilestoneProgress = [25, 50, 75, 100].includes(progress);

// For Client (only for milestones)
if (isMilestoneProgress) {
  await createInAppNotification({
    recipient: project.client.toString(),
    recipientModel: 'Client',
    category: 'project',
    subject: 'Project Progress Updated',
    message: `Project "${project.title}" progress has been updated to ${progress}%`,
    metadata: {
      projectId: project._id,
      projectNumber: project.projectNumber,
      title: project.title,
      progress: progress,
      status: project.status
    },
    io: req.app.get('io')
  });
}
```

---

#### 19. `addMilestone` ✅ **PRIORITY: MEDIUM**
**Event:** New milestone added to project  
**Recipients:**
- **Client** (milestone information)
- **Assigned Team Members** (to know new deliverables)

**Controller Location:** `src/controllers/projectController.ts` - `addMilestone` function (after milestone is added)

**Implementation:**
```typescript
// After milestone is added in addMilestone function
const newMilestone = project.milestones[project.milestones.length - 1];

// For Client
await createInAppNotification({
  recipient: project.client.toString(),
  recipientModel: 'Client',
  category: 'project',
  subject: 'New Milestone Added',
  message: `A new milestone "${newMilestone.title}" has been added to project "${project.title}". Due date: ${new Date(newMilestone.dueDate).toLocaleDateString()}`,
  metadata: {
    projectId: project._id,
    projectNumber: project.projectNumber,
    milestoneTitle: newMilestone.title,
    dueDate: newMilestone.dueDate
  },
  io: req.app.get('io')
});

// For Assigned Team Members
if (project.assignedTo && project.assignedTo.length > 0) {
  for (const userId of project.assignedTo) {
    await createInAppNotification({
      recipient: userId.toString(),
      recipientModel: 'User',
      category: 'project',
      subject: 'New Milestone Added',
      message: `A new milestone "${newMilestone.title}" has been added to project "${project.title}". Due date: ${new Date(newMilestone.dueDate).toLocaleDateString()}`,
      metadata: {
        projectId: project._id,
        projectNumber: project.projectNumber,
        milestoneTitle: newMilestone.title,
        dueDate: newMilestone.dueDate
      },
      io: req.app.get('io')
    });
  }
}
```

---

#### 20. `updateMilestone` - Status Change ✅ **PRIORITY: HIGH**
**Event:** Milestone status changed (especially to 'completed')  
**Recipients:**
- **Client** (milestone completion notification)
- **Assigned Team Members** (milestone updates)

**Controller Location:** `src/controllers/projectController.ts` - `updateMilestone` function (after milestone status is updated)

**Implementation:**
```typescript
// After milestone status is updated in updateMilestone function
// For Client
await createInAppNotification({
  recipient: project.client.toString(),
  recipientModel: 'Client',
  category: 'project',
  subject: 'Milestone Updated',
  message: `Milestone "${milestone.title}" in project "${project.title}" has been marked as ${milestone.status}`,
  metadata: {
    projectId: project._id,
    projectNumber: project.projectNumber,
    milestoneId: milestone._id,
    milestoneTitle: milestone.title,
    status: milestone.status
  },
  io: req.app.get('io')
});

// For Assigned Team Members
if (project.assignedTo && project.assignedTo.length > 0) {
  for (const userId of project.assignedTo) {
    await createInAppNotification({
      recipient: userId.toString(),
      recipientModel: 'User',
      category: 'project',
      subject: 'Milestone Updated',
      message: `Milestone "${milestone.title}" in project "${project.title}" has been marked as ${milestone.status}`,
      metadata: {
        projectId: project._id,
        projectNumber: project.projectNumber,
        milestoneId: milestone._id,
        milestoneTitle: milestone.title,
        status: milestone.status
      },
      io: req.app.get('io')
    });
  }
}
```

---

#### 21. `uploadAttachment` ⚠️ **PRIORITY: LOW**
**Event:** New attachment uploaded to project  
**Recipients:**
- **Client** (new file notification)
- **Assigned Team Members** (if uploaded by someone else)

**Controller Location:** `src/controllers/projectController.ts` - `uploadAttachment` function (after attachment is uploaded)

**Implementation:**
```typescript
// After attachment is uploaded in uploadAttachment function
const newAttachment = project.attachments[project.attachments.length - 1];

// For Client
await createInAppNotification({
  recipient: project.client.toString(),
  recipientModel: 'Client',
  category: 'project',
  subject: 'New Project Attachment',
  message: `A new file "${newAttachment.name}" has been uploaded to project "${project.title}"`,
  metadata: {
    projectId: project._id,
    projectNumber: project.projectNumber,
    attachmentId: newAttachment._id,
    fileName: newAttachment.name,
    uploadedBy: req.user._id
  },
  io: req.app.get('io')
});
```

---

### 👤 CLIENT CONTROLLER (`clientController.ts`)

#### 22. `updateClientStatus` ⚠️ **PRIORITY: MEDIUM**
**Event:** Client account status changed (active/inactive)  
**Recipients:**
- **Client** (if account is deactivated)

**Controller Location:** `src/controllers/clientController.ts` - `updateClientStatus` function (after client status is updated)

**Implementation:**
```typescript
// After client.isActive is updated in updateClientStatus function
if (!client.isActive) {
  await createInAppNotification({
    recipient: client._id.toString(),
    recipientModel: 'Client',
    category: 'general',
    subject: 'Account Status Changed',
    message: `Your account has been deactivated. Please contact support for assistance.`,
    metadata: {
      clientId: client._id,
      isActive: false
    },
    io: req.app.get('io')
  });
}
```

---

### 👥 USER CONTROLLER (`userController.ts`)

#### 23. `updateUserStatus` ⚠️ **PRIORITY: MEDIUM**
**Event:** Admin user account status changed  
**Recipients:**
- **User** (if account is deactivated)

**Controller Location:** `src/controllers/userController.ts` - `updateUserStatus` function (after user status is updated)

**Implementation:**
```typescript
// After user.isActive is updated in updateUserStatus function
if (!user.isActive) {
  await createInAppNotification({
    recipient: user._id.toString(),
    recipientModel: 'User',
    category: 'general',
    subject: 'Account Status Changed',
    message: `Your admin account has been deactivated. Please contact super admin for assistance.`,
    metadata: {
      userId: user._id,
      isActive: false
    },
    io: req.app.get('io')
  });
}
```

---

### 📊 Priority Summary

#### ✅ HIGH PRIORITY (Must Implement)
1. Quotation created (Client)
2. Quotation sent (Client)
3. Quotation accepted (Admin/Finance)
4. Quotation converted to invoice (Client)
5. Invoice created (Client)
6. Invoice sent (Client)
7. Invoice marked as paid (Client)
8. Invoice marked as overdue (Client, Finance)
9. Payment initiated (Client)
10. Payment successful (Client)
11. Project created (Client, Team)
12. Team members assigned (Team, Client)
13. Project status updated (Client, Team)
14. Milestone completed (Client, Team)

#### ⚠️ MEDIUM PRIORITY (Should Implement)
1. Quotation rejected (Admin/Finance)
2. Invoice cancelled (Client, Finance)
3. Payment failed (Client)
4. Project progress updated (Client, PM)
5. Milestone updated (Client, Team)
6. Client status changed (Client)
7. User status changed (User)

#### 📝 LOW PRIORITY (Nice to Have)
1. Quotation updated (Client)
2. Project attachment uploaded (Client, Team)
3. User role changed (User)

---

### 🔧 Helper Function for Implementation

**File: `src/utils/notificationHelper.ts`**

```typescript
import Notification from '../models/Notification';
import User from '../models/User';
import Client from '../models/Client';
import { Server as SocketIOServer } from 'socket.io';

interface NotificationAction {
  id: string;
  label: string;
  type: 'api' | 'navigate' | 'modal' | 'confirm';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, any>;
  route?: string;
  modal?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

interface NotificationContext {
  resourceId: string;
  resourceType: string;
  additionalData?: Record<string, any>;
}

interface CreateInAppNotificationParams {
  recipient: string;
  recipientModel: 'User' | 'Client';
  category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
  subject: string;
  message: string;
  actions?: NotificationAction[];
  context?: NotificationContext;
  expiresAt?: Date;
  metadata?: any;
  io?: SocketIOServer;
}

export const createInAppNotification = async (params: CreateInAppNotificationParams): Promise<Notification | null> => {
  try {
    const { 
      recipient, 
      recipientModel, 
      category, 
      subject, 
      message, 
      actions,
      context,
      expiresAt,
      metadata, 
      io 
    } = params;

    // ✅ CHECK USER/CLIENT NOTIFICATION PREFERENCES
    const RecipientModel = recipientModel === 'User' ? User : Client;
    const recipientUser = await RecipientModel.findById(recipient).select('notificationPreferences');
    
    // Check if in-app notifications are enabled for this user
    if (recipientUser && recipientUser.notificationPreferences) {
      const inAppEnabled = recipientUser.notificationPreferences.inApp;
      
      // If in-app notifications are disabled, skip sending
      if (inAppEnabled === false) {
        console.log(`In-app notification skipped for ${recipientModel} ${recipient}: preference disabled`);
        return null;
      }
    }

    // Create notification record
    const notification = new Notification({
      recipient,
      recipientModel,
      type: 'in_app',
      category,
      subject,
      message,
      actions, // Actions array for bidirectional notifications
      context, // Context data for actions
      expiresAt, // Optional expiry for time-sensitive actions
      metadata,
      status: 'pending'
    });

    await notification.save();

    // Mark as sent
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();

    // Emit Socket.io event with full notification data including actions
    if (io) {
      const roomId = recipientModel === 'User' ? `user_${recipient}` : `client_${recipient}`;
      io.to(roomId).emit('notification', {
        notificationId: notification._id,
        category,
        subject,
        message,
        actions, // Include actions in Socket.io event
        context,
        expiresAt,
        metadata,
        createdAt: notification.createdAt
      });
    }

    console.log(`In-app notification with actions sent to ${recipientModel} ${recipient}: ${subject}`);
    return notification;
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    throw error; // Re-throw for caller to handle
  }
};
```

---

### 📝 Usage Example

```typescript
// In quotationController.ts - createQuotation
import { createInAppNotification } from '../utils/notificationHelper';

// After saving quotation
await createInAppNotification({
  recipient: quotation.client.toString(),
  recipientModel: 'Client',
  category: 'quotation',
  subject: 'New Quotation Created',
  message: `A new quotation ${quotation.quotationNumber} has been created for your project.`,
  metadata: {
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    projectId: quotation.project
  },
  io: req.app.get('io')
});
```

---

### ⚙️ **Notification Preferences Handling**

**IMPORTANT:** The `createInAppNotification` helper function automatically checks user and client notification preferences before sending notifications:

- **If `inApp` preference is `false`:** Notification is skipped and `null` is returned
- **If `inApp` preference is `true` or `undefined`:** Notification is sent normally
- **Default behavior:** All preferences default to `true`, so notifications are sent unless explicitly disabled

**Preferences Structure:**
```typescript
notificationPreferences: {
  email: boolean;      // Default: true
  sms: boolean;        // Default: true
  inApp: boolean;      // Default: true
}
```

**Users can manage their preferences via:**
- `GET /api/users/notifications` - Get current preferences
- `PUT /api/users/notifications` - Update preferences
- `GET /api/clients/notifications` - Get client preferences (if implemented)
- `PUT /api/clients/notifications` - Update client preferences (if implemented)

---

## 🔄 Bidirectional Notifications

### Overview

**Bidirectional Notifications** are interactive notifications that allow recipients to take **actions directly from the notification** without navigating away. Instead of just reading "Client accepted quotation", an admin can click **"Create Invoice"** right from the notification.

### Key Concept

**Traditional Notification:**
```
📬 "Client has accepted quotation QT-2025-0001"
   [Read more] → Navigates to quotation page
```

**Bidirectional Notification:**
```
📬 "Client has accepted quotation QT-2025-0001"
   [Create Invoice] → Directly creates invoice
   [View Quotation] → Opens quotation details
```

---

### Types of Actions in Notifications

#### 1. **Direct API Actions** (Primary)
Execute an action immediately from the notification

**Examples:**
- **Create Invoice** from quotation acceptance notification
- **Mark as Paid** from payment notification
- **Approve/Reject** from pending quotation notification
- **Assign Project** from new project notification

#### 2. **Navigation Actions**
Navigate to relevant pages with pre-filled data

**Examples:**
- **View Invoice** → Opens invoice page
- **View Project** → Opens project dashboard
- **View Payment** → Opens payment details

#### 3. **Quick Actions**
Show modal/drawer with form or confirmation

**Examples:**
- **Reply to Message** → Opens reply modal
- **Update Status** → Shows status selector
- **Add Note** → Shows note input modal

---

### Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Backend   │────────▶│ Notification │────────▶│  Frontend   │
│  (Action)   │         │   (Model)    │         │  (Display)  │
└─────────────┘         └──────────────┘         └─────────────┘
     │                        │                        │
     │ 1. Create Notification │                        │
     │    with actions        │                        │
     │                        │  2. Emit Socket.io     │
     │                        │     with actions       │
     │                        │                        │ 3. Display
     │                        │                        │    with buttons
     │                        │  4. User clicks action │
     │                        │                        │
     │                        │  5. Frontend calls API │
     │                        │                        │
     │  6. Backend processes  │                        │
     │     action & updates   │                        │
     │                        │  7. New notification   │
     │                        │     (result)           │
```

---

### Real-World Examples

#### Example 1: Quotation Acceptance → Create Invoice

**Backend: Notification Creation**

```typescript
// In quotationController.ts - acceptQuotation function
import { createInAppNotification } from '../utils/notificationHelper';

// After quotation is accepted
await createInAppNotification({
  recipient: quotation.createdBy.toString(), // Admin who created quotation
  recipientModel: 'User',
  category: 'quotation',
  subject: 'Quotation Accepted',
  message: `Client has accepted quotation ${quotation.quotationNumber}. You can now create an invoice.`,
  actions: [
    {
      id: 'create_invoice',
      label: 'Create Invoice',
      type: 'api',
      endpoint: '/api/invoices',
      method: 'POST',
      payload: {
        quotation: quotation._id.toString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      variant: 'primary',
      requiresConfirmation: false
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
    resourceType: 'quotation',
    additionalData: {
      quotationNumber: quotation.quotationNumber,
      totalAmount: quotation.totalAmount
    }
  },
  metadata: {
    quotationId: quotation._id,
    quotationNumber: quotation.quotationNumber,
    projectId: quotation.project
  },
  io: req.app.get('io')
});
```

#### Example 2: Payment Successful → View Invoice

**Backend: Notification Creation**

```typescript
// In paymentController.ts - mpesaWebhook (success)
await createInAppNotification({
  recipient: payment.client.toString(),
  recipientModel: 'Client',
  category: 'payment',
  subject: 'Payment Successful',
  message: `Your payment of ${amount} for invoice ${invoiceNumber} has been received.`,
  actions: [
    {
      id: 'view_invoice',
      label: 'View Invoice',
      type: 'navigate',
      route: `/invoices/${payment.invoice}`,
      variant: 'primary'
    },
    {
      id: 'download_receipt',
      label: 'Download Receipt',
      type: 'api',
      endpoint: `/api/payments/${payment._id}/receipt`,
      method: 'GET',
      variant: 'secondary'
    }
  ],
  context: {
    resourceId: payment.invoice.toString(),
    resourceType: 'invoice'
  },
  io: req.app.get('io')
});
```

#### Example 3: Invoice Overdue → Make Payment

**Backend: Notification Creation**

```typescript
// In invoiceController.ts - markAsOverdue
await createInAppNotification({
  recipient: invoice.client.toString(),
  recipientModel: 'Client',
  category: 'invoice',
  subject: 'Invoice Overdue',
  message: `Invoice ${invoiceNumber} is now overdue. Please make payment as soon as possible.`,
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
      confirmationMessage: `Pay ${invoice.totalAmount - invoice.paidAmount} for invoice ${invoiceNumber}?`
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
  io: req.app.get('io')
});
```

---

### Frontend Implementation Pattern

```typescript
// React component example
const NotificationCard: React.FC<NotificationCardProps> = ({ notification }) => {
  const handleAction = async (action: NotificationAction) => {
    if (action.type === 'api') {
      try {
        // Call API endpoint
        const response = await fetch(action.endpoint!, {
          method: action.method || 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(action.payload)
        });
        
        if (response.ok) {
          showToast('Action completed successfully!', 'success');
          // Remove notification or mark as resolved
          removeNotification(notificationId);
        }
      } catch (error) {
        showToast('Action failed. Please try again.', 'error');
      }
    } else if (action.type === 'navigate') {
      router.push(action.route);
    }
  };

  return (
    <div className="notification-card">
      <h4>{notification.subject}</h4>
      <p>{notification.message}</p>
      
      {notification.actions?.map(action => (
        <button
          key={action.id}
          onClick={() => handleAction(action)}
          className={`btn btn-${action.variant}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};
```

---

### Security Considerations

#### 1. Action Authorization
Actions should respect user permissions

```typescript
// Backend: Validate action permissions
const validateActionPermission = async (
  userId: string,
  action: NotificationAction,
  context: NotificationContext
): Promise<boolean> => {
  // Check if user has permission to perform this action
  if (action.id === 'create_invoice') {
    const user = await User.findById(userId);
    return ['super_admin', 'finance'].includes(user.role);
  }
  return true;
};
```

#### 2. Payload Validation
Always validate action payloads on the backend

```typescript
// In invoice controller - createInvoice
export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  // Validate that quotation exists and is accepted
  const quotation = await Quotation.findById(req.body.quotation);
  if (!quotation || quotation.status !== 'accepted') {
    return next(errorHandler(400, 'Invalid quotation for invoice creation'));
  }
  // Continue with invoice creation...
};
```

#### 3. Action Expiry
Expired actions should be disabled

```typescript
// Frontend: Check action expiry
const isActionValid = (action: NotificationAction, expiresAt?: Date): boolean => {
  if (!expiresAt) return true;
  return new Date(expiresAt) > new Date();
};
```

---

### Action Types Summary

| Type | Description | Use Case | Example |
|------|-------------|----------|---------|
| **`api`** | Direct API call | Immediate actions | Create Invoice, Mark as Paid |
| **`navigate`** | Page navigation | View details | View Invoice, View Project |
| **`modal`** | Open modal/drawer | Quick forms | Reply Message, Update Progress |
| **`confirm`** | Confirmation dialog | Critical actions | Delete, Decline Assignment |

---

### Best Practices

1. **Keep Actions Relevant**: Only add actions that make sense in context
2. **Limit Actions**: Maximum 2-3 actions per notification
3. **Clear Labels**: Action buttons should have clear, actionable labels
4. **Provide Feedback**: Show loading/success/error states
5. **Follow-Up Notifications**: Send result notifications after actions
6. **Expiry Dates**: Set expiry for time-sensitive actions (e.g., accept assignment)
7. **Permissions**: Always validate permissions on backend

---

## 🛣️ Notification Routes

### Routes Where Notifications Are Triggered

The following routes trigger notifications (see [Notification Instances](#notification-instances) for details):

#### Quotation Routes (`src/routes/quotationRoutes.ts`)
- `POST /api/quotations` → `createQuotation` (Instance #1)
- `POST /api/quotations/:id/send` → `sendQuotation` (Instance #2)
- `POST /api/quotations/:id/accept` → `acceptQuotation` (Instance #3)
- `POST /api/quotations/:id/reject` → `rejectQuotation` (Instance #4)
- `PUT /api/quotations/:id` → `updateQuotation` (Instance #5)
- `POST /api/quotations/:id/convert-to-invoice` → `convertToInvoice` (Instance #6)

#### Invoice Routes (`src/routes/invoiceRoutes.ts`)
- `POST /api/invoices` → `createInvoice` (Instance #7)
- `POST /api/invoices/:id/send` → `sendInvoice` (Instance #8)
- `PATCH /api/invoices/:id/mark-paid` → `markAsPaid` (Instance #9)
- `PATCH /api/invoices/:id/mark-overdue` → `markAsOverdue` (Instance #10)
- `PATCH /api/invoices/:id/cancel` → `cancelInvoice` (Instance #11)

#### Payment Routes (`src/routes/paymentRoutes.ts`)
- `POST /api/payments` → `createPaymentAdmin` (Instance #12)
- `POST /api/payments/initiate` → `initiatePayment` (Instance #12)
- `POST /api/payments/mpesa/callback` → `mpesaWebhook` (Instances #13, #14)
- `POST /api/payments/paystack/webhook` → `paystackWebhook` (Instances #13, #14)

#### Project Routes (`src/routes/projectRoutes.ts`)
- `POST /api/projects` → `createProject` (Instance #15)
- `POST /api/projects/:id/assign` → `assignTeamMembers` (Instance #16)
- `PATCH /api/projects/:id/status` → `updateProjectStatus` (Instance #17)
- `PATCH /api/projects/:id/progress` → `updateProgress` (Instance #18)
- `POST /api/projects/:id/milestones` → `addMilestone` (Instance #19)
- `PUT /api/projects/:id/milestones/:milestoneId` → `updateMilestone` (Instance #20)
- `POST /api/projects/:id/attachments` → `uploadAttachment` (Instance #21)

#### Client Routes (`src/routes/clientRoutes.ts`)
- `PATCH /api/clients/:id/status` → `updateClientStatus` (Instance #22)

#### User Routes (`src/routes/userRoutes.ts`)
- `PATCH /api/users/:id/status` → `updateUserStatus` (Instance #23)

---

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
