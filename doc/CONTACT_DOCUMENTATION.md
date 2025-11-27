
# 📧 SIRE Tech API - Contact Message Management Documentation

## 📋 Table of Contents
- [Contact Overview](#contact-overview)
- [Contact Message Model](#contact-message-model)
- [Contact Controller](#contact-controller)
- [Contact Routes](#contact-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 📧 Contact Overview

The SIRE Tech API Contact Message Management System handles all contact form submissions and message management operations. Contact messages allow visitors and clients to send inquiries, support requests, and feedback to the company.

### Contact System Features
- **Public Submission** - Anyone can submit contact messages via contact form
- **Message Management** - Admin can view, read, reply, and archive messages
- **Status Tracking** - Track message status (unread, read, replied, archived)
- **Reply System** - Admin can reply to messages directly
- **Email Integration** - Send email notifications on new messages
- **Archiving** - Archive messages for record keeping

### Contact Message Lifecycle
1. **Unread** - New message submitted (default status)
2. **Read** - Admin has viewed the message
3. **Replied** - Admin has replied to the message
4. **Archived** - Message archived for record keeping

---

## 🗄️ Contact Message Model

### Schema Definition
```typescript
interface IContactMessage {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  repliedBy?: ObjectId;          // Reference to User (admin who replied)
  repliedAt?: Date;               // Reply timestamp
  reply?: string;                 // Reply message
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Sender Information** - Name, email, and optional phone
- **Message Content** - Subject and message text
- **Status Management** - Track message lifecycle
- **Reply System** - Store reply message and metadata
- **Audit Trail** - Track who replied and when
- **Timestamps** - Automatic creation and update tracking

### Validation Rules
```typescript
// Required fields
name: { required: true, maxlength: 100 }
email: { required: true, format: email }
subject: { required: true, maxlength: 200 }
message: { required: true, minlength: 10, maxlength: 2000 }
status: { required: true, enum: ['unread', 'read', 'replied', 'archived'], default: 'unread' }

// Optional fields
phone: { format: phone, maxlength: 20 }
repliedBy: { ref: 'User' }
repliedAt: { type: Date }
reply: { maxlength: 2000 }
```

### Model Implementation

**File: `src/models/ContactMessage.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IContactMessage } from '../types/index';

const contactMessageSchema = new Schema<IContactMessage>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'],
    maxlength: [20, 'Phone number cannot exceed 20 characters']
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
    trim: true,
    minlength: [10, 'Message must be at least 10 characters'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['unread', 'read', 'replied', 'archived'],
      message: 'Status must be unread, read, replied, or archived'
    },
    default: 'unread'
  },
  repliedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  repliedAt: {
    type: Date
  },
  reply: {
    type: String,
    trim: true,
    maxlength: [2000, 'Reply cannot exceed 2000 characters']
  }
}, {
  timestamps: true
});

// Indexes for better performance
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ status: 1 });
contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ status: 1, createdAt: -1 });

const ContactMessage = mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);

export default ContactMessage;
```

---

## 🎮 Contact Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import ContactMessage from '../models/ContactMessage';
import User from '../models/User';
import { sendContactFormNotification } from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';
```

### Functions Overview

#### `submitContactMessage(contactData)`
**Purpose:** Submit new contact message (Public)
**Access:** Public
**Validation:**
- Name, email, subject, message required
- Email format validation
- Phone format validation (if provided)
- Message length validation
**Process:**
- Create contact message with unread status
- Send email notification to admin
- **Send in-app notification to admins** (new contact message)
**Response:** Created contact message (without sensitive data)

**Notifications:**
- **Admins** receive in-app notification: "New Contact Message" with sender details and subject

**Controller Implementation:**
```typescript
export const submitContactMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, email, phone, subject, message }: {
            name: string;
            email: string;
            phone?: string;
            subject: string;
            message: string;
        } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return next(errorHandler(400, "Name, email, subject, and message are required"));
        }

        // Validate email format
        if (!validator.isEmail(email)) {
            return next(errorHandler(400, "Please provide a valid email"));
        }

        // Validate phone format (if provided)
        if (phone && !validator.isMobilePhone(phone)) {
            return next(errorHandler(400, "Please provide a valid phone number"));
        }

        // Validate message length
        if (message.length < 10 || message.length > 2000) {
            return next(errorHandler(400, "Message must be between 10 and 2000 characters"));
        }

        // Create contact message
        const contactMessage = new ContactMessage({
            name,
            email: email.toLowerCase(),
            phone,
            subject,
            message,
            status: 'unread'
        });

        await contactMessage.save();

        // Send email notification to admin
        try {
            await sendContactFormNotification(email, name, subject, message);
        } catch (emailError) {
            console.error('Error sending email notification:', emailError);
            // Don't fail the request if email fails
        }

        // Send in-app notification to all admins
        try {
            const admins = await User.find({ 
                role: { $in: ['super_admin', 'finance', 'project_manager'] },
                isActive: true 
            });

            const notificationPromises = admins.map(admin => 
                createInAppNotification({
                    recipient: admin._id.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'New Contact Message',
                    message: `New contact message from ${name}: ${subject}`,
                    metadata: {
                        contactMessageId: contactMessage._id,
                        senderName: name,
                        senderEmail: email,
                        subject: subject
                    },
                    io: req.app.get('io')
                })
            );

            await Promise.all(notificationPromises);
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Contact message submitted successfully. We will get back to you soon!",
            data: {
                contactMessage: {
                    id: contactMessage._id,
                    name: contactMessage.name,
                    subject: contactMessage.subject,
                    status: contactMessage.status,
                    createdAt: contactMessage.createdAt
                }
            }
        });

    } catch (error: any) {
        console.error('Submit contact message error:', error);
        next(errorHandler(500, "Server error while submitting contact message"));
    }
};
```

#### `getMyMessages(query)`
**Purpose:** Get contact messages for authenticated client (Client only)
**Access:** Client users only
**Features:**
- Pagination
- Filter by status
- Automatically filters by authenticated user's email
- Sort by creation date (newest first)
**Response:** Paginated contact message list for the client

**Controller Implementation:**
```typescript
export const getMyMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user || !req.user.email) {
            return next(errorHandler(401, "Authentication required"));
        }

        const { page = 1, limit = 10, status } = req.query;

        // Build query to filter messages by authenticated user's email
        const query: any = {
            email: req.user.email.toLowerCase()
        };

        // Filter by status if provided
        if (status) {
            query.status = status;
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        // Fetch messages for the authenticated client
        const messages = await ContactMessage.find(query)
            .populate('repliedBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await ContactMessage.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                messages: messages,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalMessages: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get my messages error:', error);
        next(errorHandler(500, "Server error while fetching your contact messages"));
    }
};
```

#### `getAllMessages(query)`
**Purpose:** Get all contact messages with filtering (Admin only)
**Access:** Admin users only
**Features:**
- Pagination
- Filter by status
- Search by name, email, subject, or message
- Sort options
- Date range filtering
**Response:** Paginated contact message list

**Controller Implementation:**
```typescript
export const getAllMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, status, search, startDate, endDate } = req.query;

        const query: any = {};

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Search by name, email, subject, or message
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        // Date range filtering
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate as string);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate as string);
            }
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const messages = await ContactMessage.find(query)
            .populate('repliedBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await ContactMessage.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                messages: messages,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalMessages: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all messages error:', error);
        next(errorHandler(500, "Server error while fetching contact messages"));
    }
};
```

#### `getMessage(messageId)`
**Purpose:** Get single contact message details
**Access:** Admin users (any message) or Client users (own messages only)
**Process:**
- Fetch message with populated references
- Check authorization: Admins can view any message, Clients can only view their own messages
- Mark as read if currently unread
**Response:** Complete contact message with reply details

**Controller Implementation:**
```typescript
export const getMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            return next(errorHandler(401, "Authentication required"));
        }

        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId)
            .populate('repliedBy', 'firstName lastName email');

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        // Check if user is admin
        const userRoleNames = req.user.roleNames || [];
        const isAdmin = userRoleNames.some(role => 
            ['super_admin', 'finance', 'project_manager'].includes(role)
        );

        // If not admin, check if message belongs to the client
        if (!isAdmin) {
            if (!req.user.email) {
                return next(errorHandler(403, "Access denied. You can only view your own messages."));
            }

            // Check if message email matches authenticated user's email
            if (message.email.toLowerCase() !== req.user.email.toLowerCase()) {
                return next(errorHandler(403, "Access denied. You can only view your own messages."));
            }
        }

        // Mark as read if currently unread
        if (message.status === 'unread') {
            message.status = 'read';
            await message.save();
        }

        res.status(200).json({
            success: true,
            data: {
                message: message
            }
        });

    } catch (error: any) {
        console.error('Get message error:', error);
        next(errorHandler(500, "Server error while fetching contact message"));
    }
};
```

#### `markAsRead(messageId)`
**Purpose:** Mark message as read (Admin only)
**Access:** Admin users only
**Process:**
- Update status to 'read'
- Only if currently 'unread'
**Response:** Updated message status

**Controller Implementation:**
```typescript
export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        if (message.status === 'unread') {
            message.status = 'read';
            await message.save();
        }

        res.status(200).json({
            success: true,
            message: "Message marked as read",
            data: {
                message: {
                    id: message._id,
                    status: message.status
                }
            }
        });

    } catch (error: any) {
        console.error('Mark as read error:', error);
        next(errorHandler(500, "Server error while marking message as read"));
    }
};
```

#### `replyToMessage(messageId, replyData)`
**Purpose:** Reply to contact message (Admin only)
**Access:** Admin users only
**Validation:**
- Reply message required
- Reply length validation
**Process:**
- Update message with reply
- Set status to 'replied'
- Set repliedBy and repliedAt
- Send email reply to sender
- **Send in-app notification to sender** (if sender is a registered client)
**Response:** Updated message with reply

**Notifications:**
- **Client** receives in-app notification: "Contact Message Replied" (if sender is a registered client) with reply details

**Controller Implementation:**
```typescript
export const replyToMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { reply }: { reply: string } = req.body;

        if (!reply) {
            return next(errorHandler(400, "Reply message is required"));
        }

        if (reply.length < 10 || reply.length > 2000) {
            return next(errorHandler(400, "Reply must be between 10 and 2000 characters"));
        }

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        // Update message with reply
        message.reply = reply;
        message.status = 'replied';
        message.repliedBy = req.user?._id as any;
        message.repliedAt = new Date();
        await message.save();

        // Send email reply to sender
        try {
            await sendContactReplyEmail(message.email, message.name, message.subject, reply);
        } catch (emailError) {
            console.error('Error sending reply email:', emailError);
            // Don't fail the request if email fails
        }

        // Send in-app notification to sender if they are a registered user with client role
        try {
            const User = await import('../models/User').then(m => m.default);
            const Role = await import('../models/Role').then(m => m.default);
            const clientRole = await Role.findOne({ name: 'client' });
            
            if (clientRole) {
                const user = await User.findOne({ 
                    email: message.email,
                    roles: clientRole._id
                });

                if (user) {
                    await createInAppNotification({
                        recipient: user._id.toString(),
                        recipientModel: 'User',
                    category: 'general',
                    subject: 'Contact Message Replied',
                    message: `Your contact message "${message.subject}" has been replied to. Check your email for the reply.`,
                    metadata: {
                        contactMessageId: message._id,
                        subject: message.subject,
                        reply: reply
                    },
                    io: req.app.get('io')
                });
            }
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Reply sent successfully",
            data: {
                message: {
                    id: message._id,
                    status: message.status,
                    reply: message.reply,
                    repliedBy: message.repliedBy,
                    repliedAt: message.repliedAt
                }
            }
        });

    } catch (error: any) {
        console.error('Reply to message error:', error);
        next(errorHandler(500, "Server error while replying to message"));
    }
};
```

#### `deleteMessage(messageId)`
**Purpose:** Delete contact message (Admin only)
**Access:** Admin users only
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        await ContactMessage.findByIdAndDelete(messageId);

        res.status(200).json({
            success: true,
            message: "Contact message deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete message error:', error);
        next(errorHandler(500, "Server error while deleting contact message"));
    }
};
```

#### `archiveMessage(messageId)`
**Purpose:** Archive contact message (Admin only)
**Access:** Admin users only
**Process:**
- Update status to 'archived'
**Response:** Updated message status

**Controller Implementation:**
```typescript
export const archiveMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;

        const message = await ContactMessage.findById(messageId);

        if (!message) {
            return next(errorHandler(404, "Contact message not found"));
        }

        message.status = 'archived';
        await message.save();

        res.status(200).json({
            success: true,
            message: "Message archived successfully",
            data: {
                message: {
                    id: message._id,
                    status: message.status
                }
            }
        });

    } catch (error: any) {
        console.error('Archive message error:', error);
        next(errorHandler(500, "Server error while archiving message"));
    }
};
```

---

## 🛣️ Contact Routes

### Base Path: `/api/contact`

```typescript
// Public Routes
POST   /                          // Submit contact message

// Client Routes
GET    /my-messages               // Get my messages (client)

// Admin Routes
GET    /                          // Get all messages (admin)
GET    /:id                       // Get single message (admin or client - own messages only)
PATCH  /:id/read                  // Mark as read (admin)
POST   /:id/reply                 // Reply to message (admin)
DELETE /:id                       // Delete message (admin)
PATCH  /:id/archive               // Archive message (admin)
```

### Router Implementation

**File: `src/routes/contactRoutes.ts`**

```typescript
import express from 'express';
import {
    submitContactMessage,
    getAllMessages,
    getMessage,
    markAsRead,
    replyToMessage,
    deleteMessage,
    archiveMessage
} from '../controllers/contactController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/contact
 * @desc    Submit contact message
 * @access  Public
 */
router.post('/', submitContactMessage);

/**
 * @route   GET /api/contact/my-messages
 * @desc    Get my contact messages (client)
 * @access  Private (Client)
 */
router.get('/my-messages', authenticateToken, authorizeRoles(['client']), getMyMessages);

/**
 * @route   GET /api/contact
 * @desc    Get all contact messages (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllMessages);

/**
 * @route   GET /api/contact/:messageId
 * @desc    Get single contact message (admin or client - own messages only)
 * @access  Private (Admin or Client)
 */
router.get('/:messageId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager', 'client']), getMessage);

/**
 * @route   PATCH /api/contact/:messageId/read
 * @desc    Mark message as read (admin)
 * @access  Private (Admin only)
 */
router.patch('/:messageId/read', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), markAsRead);

/**
 * @route   POST /api/contact/:messageId/reply
 * @desc    Reply to message (admin)
 * @access  Private (Admin only)
 */
router.post('/:messageId/reply', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), replyToMessage);

/**
 * @route   DELETE /api/contact/:messageId
 * @desc    Delete message (admin)
 * @access  Private (Admin only)
 */
router.delete('/:messageId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), deleteMessage);

/**
 * @route   PATCH /api/contact/:messageId/archive
 * @desc    Archive message (admin)
 * @access  Private (Admin only)
 */
router.patch('/:messageId/archive', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), archiveMessage);

export default router;
```

### Route Details

#### `POST /api/contact`
**Access:** Public (no authentication required)

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+254712345678",
  "subject": "Inquiry about services",
  "message": "I would like to know more about your web development services."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact message submitted successfully. We will get back to you soon!",
  "data": {
    "contactMessage": {
      "id": "...",
      "name": "John Doe",
      "subject": "Inquiry about services",
      "status": "unread",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/contact/my-messages`
**Headers:** `Authorization: Bearer <client_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (unread, read, replied, archived)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+254712345678",
        "subject": "Inquiry about services",
        "message": "I would like to know more...",
        "status": "replied",
        "reply": "Thank you for your inquiry...",
        "repliedBy": {
          "_id": "...",
          "firstName": "Admin",
          "lastName": "User",
          "email": "admin@example.com"
        },
        "repliedAt": "2025-01-01T12:00:00.000Z",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalMessages": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/contact`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (unread, read, replied, archived)
- `search` (optional): Search by name, email, subject, or message
- `startDate` (optional): Filter messages from date
- `endDate` (optional): Filter messages to date

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+254712345678",
        "subject": "Inquiry about services",
        "message": "I would like to know more...",
        "status": "unread",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalMessages": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `POST /api/contact/:messageId/reply`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "reply": "Thank you for your inquiry. We would be happy to discuss our web development services with you. Please let us know your availability for a call."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reply sent successfully",
  "data": {
    "message": {
      "id": "...",
      "status": "replied",
      "reply": "Thank you for your inquiry...",
      "repliedBy": "...",
      "repliedAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load admin user
**Usage in Contact Routes:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllMessages);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check admin permissions
**Usage:**
```typescript
router.post('/:messageId/reply', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), replyToMessage);
```

---

## 📝 API Examples

### Complete Contact Flow

#### 1. Submit Contact Message (Public)
```bash
curl -X POST http://localhost:5000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+254712345678",
    "subject": "Inquiry about services",
    "message": "I would like to know more about your web development services."
  }'
```

#### 2. Client Get My Messages
```bash
curl -X GET "http://localhost:5000/api/contact/my-messages?page=1&limit=10&status=replied" \
  -H "Authorization: Bearer <client_access_token>"
```

#### 3. Admin Get All Messages
```bash
curl -X GET "http://localhost:5000/api/contact?page=1&limit=10&status=unread" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 4. Client Get Single Message (Own Message)
```bash
curl -X GET http://localhost:5000/api/contact/<messageId> \
  -H "Authorization: Bearer <client_access_token>"
```

#### 5. Admin Get Single Message
```bash
curl -X GET http://localhost:5000/api/contact/<messageId> \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 6. Admin Reply to Message
```bash
curl -X POST http://localhost:5000/api/contact/<messageId>/reply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "reply": "Thank you for your inquiry. We would be happy to discuss our services with you."
  }'
```

#### 7. Admin Archive Message
```bash
curl -X PATCH http://localhost:5000/api/contact/<messageId>/archive \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🔒 Security Features

### Access Control
- **Public Submission** - Anyone can submit contact messages
- **Client Access** - Clients can view their own messages (filtered by email)
  - Clients can view single messages only if the message belongs to them
- **Admin Only Access** - Only admins can view and manage all messages
  - Admins can view any message regardless of sender
- **Reply Control** - Only admins can reply to messages
- **Deletion Control** - Only admins can delete messages

### Data Protection
- **Email Validation** - Email format validation
- **Phone Validation** - Phone format validation (if provided)
- **Message Length** - Minimum and maximum length validation
- **Input Sanitization** - Prevent injection attacks

### Input Validation
- **Required Fields** - All critical fields validated
- **Email Format** - Regex validation with uniqueness
- **Phone Format** - International format validation
- **Message Length** - 10-2000 character validation

---

## 🚨 Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Name, email, subject, and message are required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Contact message not found"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

---

## 🔗 Integration with Other Modules

### Email Integration
- **Submission Notification** - Email sent to admin on new message
- **Reply Email** - Email sent to sender when admin replies
- **Email Templates** - Professional email formatting

### Notification Integration

The Contact system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **New Contact Message** (`submitContactMessage`)
   - **Recipient:** All active admins
   - **Category:** `general`
   - **Subject:** "New Contact Message"
   - **Message:** Includes sender name and subject
   - **Metadata:** `contactMessageId`, `senderName`, `senderEmail`, `subject`

2. **Contact Message Replied** (`replyToMessage`)
   - **Recipient:** User with 'client' role (if sender is a registered user with client role)
   - **Category:** `general`
   - **Subject:** "Contact Message Replied"
   - **Message:** Notifies user that their message has been replied to
   - **Metadata:** `contactMessageId`, `subject`, `reply`

### User Integration
- If sender is a registered user with 'client' role, they receive in-app notifications
- User email lookup with role check for notification delivery

---

## 📊 Database Indexes

### Performance Optimizations
```typescript
// Email index for fast lookups
contactMessageSchema.index({ email: 1 });

// Status index for filtering
contactMessageSchema.index({ status: 1 });

// Created date index for sorting
contactMessageSchema.index({ createdAt: -1 });

// Compound index for status and date filtering
contactMessageSchema.index({ status: 1, createdAt: -1 });
```

---

## 🧪 Testing Considerations

### Unit Tests
- **Model Validation** - Test schema constraints
- **Email Format** - Verify email validation
- **Message Length** - Test minimum and maximum length
- **Status Enum** - Test status validation

### Integration Tests
- **Submission Flow** - Complete contact message submission
- **Admin Reply** - Admin reply workflow
- **Email Delivery** - Email notification testing
- **Notification Delivery** - In-app notification testing

### Security Tests
- **Access Control** - Unauthorized access prevention
- **Input Validation** - Malicious input rejection
- **Email Injection** - Email injection prevention

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

