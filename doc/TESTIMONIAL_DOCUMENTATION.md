
# ⭐ SIRE Tech API - Testimonial Management Documentation

## 📋 Table of Contents
- [Testimonial Overview](#testimonial-overview)
- [Testimonial Model](#testimonial-model)
- [Testimonial Controller](#testimonial-controller)
- [Testimonial Routes](#testimonial-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## ⭐ Testimonial Overview

The SIRE Tech API Testimonial Management System handles all testimonial-related operations including submission, approval, publishing, and public display. Testimonials allow clients to share feedback and reviews about completed projects and services.

### Testimonial System Features
- **Client Submission** - Clients can submit testimonials for completed projects
- **Rating System** - 1-5 star rating system
- **Admin Approval** - Admin moderation before publishing
- **Public Display** - Published testimonials visible on public pages
- **Project Association** - Link testimonials to specific projects
- **Status Management** - Approval and publishing workflow

### Testimonial Lifecycle
1. **Submitted** - Client submits testimonial (unapproved, unpublished)
2. **Approved** - Admin approves testimonial (approved, unpublished)
3. **Published** - Admin publishes testimonial (approved, published)
4. **Unpublished** - Admin can unpublish testimonials

---

## 🗄️ Testimonial Model

### Schema Definition
```typescript
interface ITestimonial {
  _id: string;
  client: ObjectId;              // Reference to User
  project?: ObjectId;            // Reference to Project (optional)
  rating: number;                // 1-5 star rating
  message: string;               // Testimonial text
  isApproved: boolean;           // Admin approval status
  isPublished: boolean;          // Public visibility status
  approvedBy?: ObjectId;          // Reference to User (admin who approved)
  approvedAt?: Date;             // Approval timestamp
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Client Association** - Linked to client record
- **Project Link** - Optional reference to completed project
- **Rating System** - 1-5 star rating validation
- **Approval Workflow** - Admin moderation required
- **Publishing Control** - Separate approval and publishing
- **Audit Trail** - Track who approved and when

### Validation Rules
```typescript
// Required fields
client: { required: true, ref: 'User' }
rating: { required: true, min: 1, max: 5 }
message: { required: true, minlength: 10, maxlength: 1000 }
isApproved: { default: false }
isPublished: { default: false }

// Optional fields
project: { ref: 'Project' }
approvedBy: { ref: 'User' }
approvedAt: { type: Date }
```

### Model Implementation

**File: `src/models/Testimonial.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { ITestimonial } from '../types/index';

const testimonialSchema = new Schema<ITestimonial>({
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
testimonialSchema.index({ client: 1 });
testimonialSchema.index({ project: 1 });
testimonialSchema.index({ isApproved: 1 });
testimonialSchema.index({ isPublished: 1 });
testimonialSchema.index({ rating: 1 });

// Compound index for published testimonials
testimonialSchema.index({ isPublished: 1, isApproved: 1 });

const Testimonial = mongoose.model<ITestimonial>('Testimonial', testimonialSchema);

export default Testimonial;
```

---

## 🎮 Testimonial Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Testimonial from '../models/Testimonial';
import Client from '../models/Client';
import Project from '../models/Project';
import { createInAppNotification } from '../utils/notificationHelper';
```

### Functions Overview

#### `createTestimonial(testimonialData)`
**Purpose:** Submit new testimonial (Client only)
**Access:** Authenticated clients only
**Validation:**
- Client existence check
- Project existence check (if provided)
- Rating validation (1-5)
- Message length validation
- Client must own the project (if provided)
**Process:**
- Create testimonial with unapproved status
- Link to client and optional project
- Set default status (unapproved, unpublished)
**Response:** Created testimonial data

**Controller Implementation:**
```typescript
export const createTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { project, rating, message }: {
            project?: string;
            rating: number;
            message: string;
        } = req.body;

        // Validation
        if (!rating || !message) {
            return next(errorHandler(400, "Rating and message are required"));
        }

        if (rating < 1 || rating > 5) {
            return next(errorHandler(400, "Rating must be between 1 and 5"));
        }

        if (message.length < 10 || message.length > 1000) {
            return next(errorHandler(400, "Message must be between 10 and 1000 characters"));
        }

        // Get client from authenticated user
        const clientId = req.user?._id;
        if (!clientId) {
            return next(errorHandler(401, "Client authentication required"));
        }

        // Verify project exists and belongs to client (if provided)
        if (project) {
            const projectExists = await Project.findOne({
                _id: project,
                client: clientId
            });

            if (!projectExists) {
                return next(errorHandler(404, "Project not found or does not belong to you"));
            }
        }

        // Create testimonial
        const testimonial = new Testimonial({
            client: clientId,
            project: project || undefined,
            rating,
            message,
            isApproved: false,
            isPublished: false
        });

        await testimonial.save();

        // Populate references
        await testimonial.populate('client', 'firstName lastName email');
        if (project) {
            await testimonial.populate('project', 'title projectNumber');
        }

        res.status(201).json({
            success: true,
            message: "Testimonial submitted successfully. Awaiting admin approval.",
            data: {
                testimonial: testimonial
            }
        });

    } catch (error: any) {
        console.error('Create testimonial error:', error);
        next(errorHandler(500, "Server error while creating testimonial"));
    }
};
```

#### `getAllTestimonials(query)`
**Purpose:** Get all testimonials with filtering (Admin only)
**Access:** Admin users only
**Features:**
- Pagination
- Filter by approval status, publishing status
- Filter by client, project
- Sort options
- Search by message
**Response:** Paginated testimonial list

**Controller Implementation:**
```typescript
export const getAllTestimonials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, isApproved, isPublished, client, project, search } = req.query;

        const query: any = {};

        // Filter by approval status
        if (isApproved !== undefined) {
            query.isApproved = isApproved === 'true';
        }

        // Filter by publishing status
        if (isPublished !== undefined) {
            query.isPublished = isPublished === 'true';
        }

        // Filter by client
        if (client) {
            query.client = client;
        }

        // Filter by project
        if (project) {
            query.project = project;
        }

        // Search by message
        if (search) {
            query.message = { $regex: search, $options: 'i' };
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const testimonials = await Testimonial.find(query)
            .populate('client', 'firstName lastName email company')
            .populate('project', 'title projectNumber')
            .populate('approvedBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Testimonial.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                testimonials: testimonials,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalTestimonials: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all testimonials error:', error);
        next(errorHandler(500, "Server error while fetching testimonials"));
    }
};
```

#### `getPublishedTestimonials(query)`
**Purpose:** Get published testimonials (Public)
**Access:** Public
**Features:**
- Only approved and published testimonials
- Pagination
- Sort by rating, date
- Filter by rating range
**Response:** Paginated published testimonials

**Controller Implementation:**
```typescript
export const getPublishedTestimonials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, minRating, maxRating, sortBy = 'createdAt', order = 'desc' } = req.query;

        const query: any = {
            isApproved: true,
            isPublished: true
        };

        // Filter by rating range
        if (minRating || maxRating) {
            query.rating = {};
            if (minRating) query.rating.$gte = parseInt(minRating as string);
            if (maxRating) query.rating.$lte = parseInt(maxRating as string);
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            sortBy: sortBy as string,
            order: order as 'asc' | 'desc'
        };

        const sort: any = {};
        sort[options.sortBy] = options.order === 'asc' ? 1 : -1;

        const testimonials = await Testimonial.find(query)
            .populate('client', 'firstName lastName company')
            .populate('project', 'title')
            .sort(sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Testimonial.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                testimonials: testimonials,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalTestimonials: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get published testimonials error:', error);
        next(errorHandler(500, "Server error while fetching published testimonials"));
    }
};
```

#### `getTestimonial(testimonialId)`
**Purpose:** Get single testimonial details
**Access:** Admin or client (own testimonials)
**Response:** Complete testimonial with populated references

**Controller Implementation:**
```typescript
export const getTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { testimonialId } = req.params;

        const testimonial = await Testimonial.findById(testimonialId)
            .populate('client', 'firstName lastName email company')
            .populate('project', 'title projectNumber description')
            .populate('approvedBy', 'firstName lastName email');

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        // Check if client owns this testimonial (if client is making request)
        if (req.user && req.user.role === 'client' && testimonial.client.toString() !== req.user._id.toString()) {
            return next(errorHandler(403, "You can only view your own testimonials"));
        }

        res.status(200).json({
            success: true,
            data: {
                testimonial: testimonial
            }
        });

    } catch (error: any) {
        console.error('Get testimonial error:', error);
        next(errorHandler(500, "Server error while fetching testimonial"));
    }
};
```

#### `updateTestimonial(testimonialId, testimonialData)`
**Purpose:** Update testimonial
**Access:** Client (own testimonials) or Admin
**Allowed Fields:**
- rating, message (if not approved)
- Cannot update after approval (admin can)
**Process:**
- Validate ownership or admin access
- Check approval status
- Update allowed fields
**Response:** Updated testimonial

**Controller Implementation:**
```typescript
export const updateTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { testimonialId } = req.params;
        const { rating, message }: {
            rating?: number;
            message?: string;
        } = req.body;

        const testimonial = await Testimonial.findById(testimonialId);

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        // Check ownership or admin access
        const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'finance' || req.user?.role === 'project_manager';
        const isOwner = testimonial.client.toString() === req.user?._id.toString();

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "You can only update your own testimonials"));
        }

        // Clients cannot update approved testimonials
        if (!isAdmin && testimonial.isApproved) {
            return next(errorHandler(400, "Cannot update an approved testimonial"));
        }

        // Update fields
        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                return next(errorHandler(400, "Rating must be between 1 and 5"));
            }
            testimonial.rating = rating;
        }

        if (message !== undefined) {
            if (message.length < 10 || message.length > 1000) {
                return next(errorHandler(400, "Message must be between 10 and 1000 characters"));
            }
            testimonial.message = message;
        }

        await testimonial.save();

        res.status(200).json({
            success: true,
            message: "Testimonial updated successfully",
            data: {
                testimonial: testimonial
            }
        });

    } catch (error: any) {
        console.error('Update testimonial error:', error);
        next(errorHandler(500, "Server error while updating testimonial"));
    }
};
```

#### `deleteTestimonial(testimonialId)`
**Purpose:** Delete testimonial
**Access:** Client (own testimonials) or Admin
**Validation:**
- Ownership check or admin access
- Cannot delete if published (admin can)
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { testimonialId } = req.params;

        const testimonial = await Testimonial.findById(testimonialId);

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        // Check ownership or admin access
        const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'finance' || req.user?.role === 'project_manager';
        const isOwner = testimonial.client.toString() === req.user?._id.toString();

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "You can only delete your own testimonials"));
        }

        // Clients cannot delete published testimonials
        if (!isAdmin && testimonial.isPublished) {
            return next(errorHandler(400, "Cannot delete a published testimonial. Please contact admin."));
        }

        await Testimonial.findByIdAndDelete(testimonialId);

        res.status(200).json({
            success: true,
            message: "Testimonial deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete testimonial error:', error);
        next(errorHandler(500, "Server error while deleting testimonial"));
    }
};
```

#### `approveTestimonial(testimonialId)`
**Purpose:** Approve testimonial (Admin only)
**Access:** Admin users only
**Process:**
- Update isApproved to true
- Set approvedBy and approvedAt
- **Send in-app notification to client** (testimonial approved)
**Response:** Updated testimonial

**Notifications:**
- **Client** receives in-app notification: "Testimonial Approved" with approval message

**Controller Implementation:**
```typescript
export const approveTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { testimonialId } = req.params;

        const testimonial = await Testimonial.findById(testimonialId)
            .populate('client', 'firstName lastName email');

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        if (testimonial.isApproved) {
            return next(errorHandler(400, "Testimonial is already approved"));
        }

        testimonial.isApproved = true;
        testimonial.approvedBy = req.user?._id as any;
        testimonial.approvedAt = new Date();
        await testimonial.save();

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: testimonial.client._id.toString(),
                recipientModel: 'User',
                category: 'general',
                subject: 'Testimonial Approved',
                message: `Your testimonial has been approved by admin. It will be published soon.`,
                metadata: {
                    testimonialId: testimonial._id,
                    rating: testimonial.rating
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Testimonial approved successfully",
            data: {
                testimonial: testimonial
            }
        });

    } catch (error: any) {
        console.error('Approve testimonial error:', error);
        next(errorHandler(500, "Server error while approving testimonial"));
    }
};
```

#### `publishTestimonial(testimonialId)`
**Purpose:** Publish testimonial (Admin only)
**Access:** Admin users only
**Validation:**
- Must be approved first
**Process:**
- Update isPublished to true
- **Send in-app notification to client** (testimonial published)
**Response:** Updated testimonial

**Notifications:**
- **Client** receives in-app notification: "Testimonial Published" with publication message

**Controller Implementation:**
```typescript
export const publishTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { testimonialId } = req.params;

        const testimonial = await Testimonial.findById(testimonialId)
            .populate('client', 'firstName lastName email');

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        if (!testimonial.isApproved) {
            return next(errorHandler(400, "Cannot publish an unapproved testimonial"));
        }

        if (testimonial.isPublished) {
            return next(errorHandler(400, "Testimonial is already published"));
        }

        testimonial.isPublished = true;
        await testimonial.save();

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: testimonial.client._id.toString(),
                recipientModel: 'User',
                category: 'general',
                subject: 'Testimonial Published',
                message: `Your testimonial has been published and is now visible on our website. Thank you for your feedback!`,
                metadata: {
                    testimonialId: testimonial._id,
                    rating: testimonial.rating
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Testimonial published successfully",
            data: {
                testimonial: testimonial
            }
        });

    } catch (error: any) {
        console.error('Publish testimonial error:', error);
        next(errorHandler(500, "Server error while publishing testimonial"));
    }
};
```

#### `unpublishTestimonial(testimonialId)`
**Purpose:** Unpublish testimonial (Admin only)
**Access:** Admin users only
**Process:**
- Update isPublished to false
- **Send in-app notification to client** (testimonial unpublished)
**Response:** Updated testimonial

**Notifications:**
- **Client** receives in-app notification: "Testimonial Unpublished" with unpublishing message

**Controller Implementation:**
```typescript
export const unpublishTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { testimonialId } = req.params;

        const testimonial = await Testimonial.findById(testimonialId)
            .populate('client', 'firstName lastName email');

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        if (!testimonial.isPublished) {
            return next(errorHandler(400, "Testimonial is not published"));
        }

        testimonial.isPublished = false;
        await testimonial.save();

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: testimonial.client._id.toString(),
                recipientModel: 'User',
                category: 'general',
                subject: 'Testimonial Unpublished',
                message: `Your testimonial has been unpublished and is no longer visible on our website.`,
                metadata: {
                    testimonialId: testimonial._id
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Testimonial unpublished successfully",
            data: {
                testimonial: testimonial
            }
        });

    } catch (error: any) {
        console.error('Unpublish testimonial error:', error);
        next(errorHandler(500, "Server error while unpublishing testimonial"));
    }
};
```

---

## 🛣️ Testimonial Routes

### Base Path: `/api/testimonials`

```typescript
// Public Routes
GET    /published                 // Get published testimonials

// Client Routes
POST   /                          // Create testimonial (client)
GET    /my                        // Get client's own testimonials
PUT    /:id                       // Update own testimonial
DELETE /:id                       // Delete own testimonial

// Admin Routes
GET    /                          // Get all testimonials (admin)
GET    /:id                       // Get single testimonial
PUT    /:id                       // Update testimonial (admin)
DELETE /:id                       // Delete testimonial (admin)
POST   /:id/approve               // Approve testimonial (admin)
POST   /:id/publish               // Publish testimonial (admin)
POST   /:id/unpublish             // Unpublish testimonial (admin)
```

### Router Implementation

**File: `src/routes/testimonialRoutes.ts`**

```typescript
import express from 'express';
import {
    createTestimonial,
    getAllTestimonials,
    getPublishedTestimonials,
    getTestimonial,
    updateTestimonial,
    deleteTestimonial,
    approveTestimonial,
    publishTestimonial,
    unpublishTestimonial,
    getMyTestimonials
} from '../controllers/testimonialController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/testimonials/published
 * @desc    Get published testimonials (public)
 * @access  Public
 */
router.get('/published', getPublishedTestimonials);

/**
 * @route   POST /api/testimonials
 * @desc    Create testimonial (client)
 * @access  Private (Client)
 */
router.post('/', authenticateToken, createTestimonial);

/**
 * @route   GET /api/testimonials/my
 * @desc    Get client's own testimonials
 * @access  Private (Client)
 */
router.get('/my', authenticateToken, getMyTestimonials);

/**
 * @route   GET /api/testimonials
 * @desc    Get all testimonials (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllTestimonials);

/**
 * @route   GET /api/testimonials/:testimonialId
 * @desc    Get single testimonial
 * @access  Private (Client or Admin)
 */
router.get('/:testimonialId', authenticateToken, getTestimonial);

/**
 * @route   PUT /api/testimonials/:testimonialId
 * @desc    Update testimonial
 * @access  Private (Client or Admin)
 */
router.put('/:testimonialId', authenticateToken, updateTestimonial);

/**
 * @route   DELETE /api/testimonials/:testimonialId
 * @desc    Delete testimonial
 * @access  Private (Client or Admin)
 */
router.delete('/:testimonialId', authenticateToken, deleteTestimonial);

/**
 * @route   POST /api/testimonials/:testimonialId/approve
 * @desc    Approve testimonial (admin)
 * @access  Private (Admin only)
 */
router.post('/:testimonialId/approve', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), approveTestimonial);

/**
 * @route   POST /api/testimonials/:testimonialId/publish
 * @desc    Publish testimonial (admin)
 * @access  Private (Admin only)
 */
router.post('/:testimonialId/publish', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), publishTestimonial);

/**
 * @route   POST /api/testimonials/:testimonialId/unpublish
 * @desc    Unpublish testimonial (admin)
 * @access  Private (Admin only)
 */
router.post('/:testimonialId/unpublish', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), unpublishTestimonial);

export default router;
```

### Route Details

#### `POST /api/testimonials`
**Headers:** `Authorization: Bearer <client_token>`

**Body:**
```json
{
  "project": "project_id_here",
  "rating": 5,
  "message": "Excellent service! The team was professional and delivered on time."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Testimonial submitted successfully. Awaiting admin approval.",
  "data": {
    "testimonial": {
      "_id": "...",
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "project": {
        "_id": "...",
        "title": "E-commerce Website",
        "projectNumber": "PRJ-2025-0001"
      },
      "rating": 5,
      "message": "Excellent service! The team was professional and delivered on time.",
      "isApproved": false,
      "isPublished": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/testimonials/published`
**Access:** Public (no authentication required)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `minRating` (optional): Minimum rating (1-5)
- `maxRating` (optional): Maximum rating (1-5)
- `sortBy` (optional): Sort field (rating, createdAt) (default: createdAt)
- `order` (optional): Sort order (asc, desc) (default: desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "testimonials": [
      {
        "_id": "...",
        "client": {
          "_id": "...",
          "firstName": "John",
          "lastName": "Doe",
          "company": "Example Corp"
        },
        "project": {
          "_id": "...",
          "title": "E-commerce Website"
        },
        "rating": 5,
        "message": "Excellent service!",
        "isApproved": true,
        "isPublished": true,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalTestimonials": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `POST /api/testimonials/:testimonialId/approve`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "message": "Testimonial approved successfully",
  "data": {
    "testimonial": {
      "_id": "...",
      "isApproved": true,
      "approvedBy": "...",
      "approvedAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user/client
**Usage in Testimonial Routes:**
```typescript
router.post('/', authenticateToken, createTestimonial);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check admin permissions
**Usage:**
```typescript
router.post('/:testimonialId/approve', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), approveTestimonial);
```

---

## 📝 API Examples

### Complete Testimonial Flow

#### 1. Client Submit Testimonial
```bash
curl -X POST http://localhost:5000/api/testimonials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <client_access_token>" \
  -d '{
    "project": "project_id_here",
    "rating": 5,
    "message": "Excellent service! The team was professional and delivered on time."
  }'
```

#### 2. Get Published Testimonials (Public)
```bash
curl -X GET "http://localhost:5000/api/testimonials/published?page=1&limit=10&minRating=4&sortBy=rating&order=desc"
```

#### 3. Admin Get All Testimonials
```bash
curl -X GET "http://localhost:5000/api/testimonials?page=1&limit=10&isApproved=false" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 4. Admin Approve Testimonial
```bash
curl -X POST http://localhost:5000/api/testimonials/<testimonialId>/approve \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 5. Admin Publish Testimonial
```bash
curl -X POST http://localhost:5000/api/testimonials/<testimonialId>/publish \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 6. Client Update Own Testimonial
```bash
curl -X PUT http://localhost:5000/api/testimonials/<testimonialId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <client_access_token>" \
  -d '{
    "rating": 4,
    "message": "Very good service, with minor improvements needed."
  }'
```

---

## 🔒 Security Features

### Access Control
- **Client Ownership** - Clients can only manage their own testimonials
- **Admin Override** - Admins can manage all testimonials
- **Approval Workflow** - Clients cannot modify approved testimonials
- **Publishing Control** - Only admins can publish/unpublish

### Data Protection
- **Rating Validation** - Enforce 1-5 rating range
- **Message Length** - Enforce minimum and maximum message length
- **Project Ownership** - Verify client owns the project before linking
- **Audit Trail** - Track who approved and when

### Input Validation
- **Required Fields** - All critical fields validated
- **Rating Range** - 1-5 star validation
- **Message Length** - 10-1000 character validation
- **Project Validation** - Project existence and ownership check

---

## 🚨 Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Rating must be between 1 and 5"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "You can only update your own testimonials"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Testimonial not found"
}
```

---

## 🔗 Integration with Other Modules

### Client Integration
- Testimonials linked to client records
- Client can view and manage their testimonials
- Client receives notifications on approval/publishing

### Project Integration
- Testimonials can be linked to completed projects
- Project ownership validation
- Project details displayed with testimonial

### Notification Integration

The Testimonial system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **Testimonial Approved** (`approveTestimonial`)
   - **Recipient:** Client
   - **Category:** `general`
   - **Subject:** "Testimonial Approved"
   - **Message:** Notifies client that their testimonial has been approved
   - **Metadata:** `testimonialId`, `rating`

2. **Testimonial Published** (`publishTestimonial`)
   - **Recipient:** Client
   - **Category:** `general`
   - **Subject:** "Testimonial Published"
   - **Message:** Notifies client that their testimonial is now live
   - **Metadata:** `testimonialId`, `rating`

3. **Testimonial Unpublished** (`unpublishTestimonial`)
   - **Recipient:** Client
   - **Category:** `general`
   - **Subject:** "Testimonial Unpublished"
   - **Message:** Notifies client that their testimonial has been unpublished
   - **Metadata:** `testimonialId`

---

## 📊 Database Indexes

### Performance Optimizations
```typescript
// Client index for fast lookups
testimonialSchema.index({ client: 1 });

// Project index for project filtering
testimonialSchema.index({ project: 1 });

// Status indexes for filtering
testimonialSchema.index({ isApproved: 1 });
testimonialSchema.index({ isPublished: 1 });

// Rating index for sorting
testimonialSchema.index({ rating: 1 });

// Compound index for published testimonials
testimonialSchema.index({ isPublished: 1, isApproved: 1 });
```

---

## 🧪 Testing Considerations

### Unit Tests
- **Model Validation** - Test schema constraints
- **Rating Validation** - Verify rating range enforcement
- **Message Length** - Test minimum and maximum length

### Integration Tests
- **Submission Flow** - Complete testimonial submission process
- **Approval Workflow** - Admin approval and publishing
- **Client Access** - Ownership validation

### Security Tests
- **Access Control** - Unauthorized access prevention
- **Ownership Validation** - Client can only access own testimonials
- **Admin Override** - Admin access to all testimonials

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

