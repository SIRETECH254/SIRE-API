# LIZEN API - Quotation Request (RFQ) Documentation

## Table of Contents
- [Overview](#overview)
- [Business Flow Position](#business-flow-position)
- [Status Lifecycle](#status-lifecycle)
- [Quotation Request Model](#quotation-request-model)
- [Controller Functions](#controller-functions)
- [Routes](#routes)
- [API Examples](#api-examples)
- [Notification Matrix](#notification-matrix)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## Overview

The Quotation Request (RFQ) module is the **public entry point** to the LIZEN business flow. It allows potential clients — with or without an existing account — to submit a Request for Quotation directly from any frontend form. Admins then review, assign, and convert approved requests into Projects, which kicks off the full quotation and invoicing workflow.

### Key Features
- **Public Submission** — No authentication required; any visitor can submit an RFQ
- **Auto-Numbering** — Unique request numbers (RQR-2025-0001)
- **Email Notifications** — Admin alert email + client acknowledgement on submission
- **In-App Notifications** — Real-time alerts to admin team via Socket.io
- **Admin Workflow** — Review, assign, and convert or reject requests
- **Project Conversion** — Atomic conversion of an RFQ into a Project (one-step, no orphaned data)
- **User Linking** — Automatically links to existing platform user by email; links to new user on conversion

---

## Business Flow Position

```
QuotationRequest (public RFQ)
        │
        ▼ convertToProject (admin)
     Project
        │
        ▼ createQuotation (admin)
    Quotation  ──►  accept / reject (client)
        │
        ▼ convertToInvoice (admin)
     Invoice
        │
        ▼ pay (client)
     Payment
```

The `QuotationRequest` module feeds the `Project` module. All other modules in the chain already exist.

---

## Status Lifecycle

```
        ┌─────────────────────────────────┐
        │           new (default)         │
        └────────────────┬────────────────┘
                         │ updateRequestStatus
                  ┌──────┴──────┐
                  │             │
                  ▼             ▼
             reviewed       rejected  ◄── terminal
                  │
                  │ convertToProject
                  ▼
             converted  ◄──────────── terminal
```

- **new** — Submitted, awaiting admin review
- **reviewed** — Admin has reviewed; may be assigned to a team member
- **converted** — Successfully converted to a Project; linked via `linkedProject`
- **rejected** — Request declined; `rejectionReason` stored on document

Terminal states (`converted`, `rejected`) cannot be updated via `PATCH /:id/status`.

---

## Quotation Request Model

### Schema Definition
```typescript
interface IQuotationRequest {
  _id: string;
  requestNumber: string;           // Auto-generated (RQR-2025-0001)

  // Contact Information
  name: string;                    // required, max 100
  email: string;                   // required, indexed
  phone?: string;                  // max 20
  company?: string;                // max 100
  country?: string;                // max 60

  // Project Scope
  projectTitle: string;            // required, max 200
  projectType: ObjectId;           // required, Reference to Service
  description: string;             // required, 20–2000 chars
  services?: string[];             // free-text service names, each max 100

  // Constraints
  budget?: string;                 // e.g. "$5,000–$10,000", max 100
  deadline?: Date;                 // must be in the future

  // Supporting Information
  attachments?: string[];          // Cloudinary URLs, max 10
  notes?: string;                  // max 500 chars
  referralSource?: string;         // max 100 chars

  // System / Admin Fields
  status: 'new' | 'reviewed' | 'converted' | 'rejected';
  assignedTo?: ObjectId;           // Reference to User
  linkedProject?: ObjectId;        // Reference to Project (set on convert)
  linkedUser?: ObjectId;           // Reference to User (auto-matched by email or set on convert)

  // Audit
  reviewedAt?: Date;
  convertedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;        // max 500 chars

  createdAt: Date;
  updatedAt: Date;
}
```

### Database Indexes
```typescript
quotationRequestSchema.index({ email: 1 });
quotationRequestSchema.index({ status: 1 });
quotationRequestSchema.index({ projectType: 1 });
quotationRequestSchema.index({ assignedTo: 1 });
quotationRequestSchema.index({ createdAt: -1 });
quotationRequestSchema.index({ status: 1, createdAt: -1 });
quotationRequestSchema.index({ status: 1, projectType: 1 });
```

### Model Implementation

**File: `src/models/QuotationRequest.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IQuotationRequest } from '../types/index';

const quotationRequestSchema = new Schema<IQuotationRequest>({
    requestNumber: {
        type: String,
        unique: true,
        trim: true
    },
    // ── Contact ──────────────────────────────────────────────────────────────
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
        maxlength: [20, 'Phone cannot exceed 20 characters']
    },
    company: {
        type: String,
        trim: true,
        maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    country: {
        type: String,
        trim: true,
        maxlength: [60, 'Country cannot exceed 60 characters']
    },
    // ── Project Scope ─────────────────────────────────────────────────────────
    projectTitle: {
        type: String,
        required: [true, 'Project title is required'],
        trim: true,
        maxlength: [200, 'Project title cannot exceed 200 characters']
    },
    projectType: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: [true, 'Project type is required']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [20, 'Description must be at least 20 characters'],
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    services: [{
        type: String,
        trim: true,
        maxlength: [100, 'Service name cannot exceed 100 characters']
    }],
    // ── Constraints ───────────────────────────────────────────────────────────
    budget: {
        type: String,
        trim: true,
        maxlength: [100, 'Budget string cannot exceed 100 characters']
    },
    deadline: {
        type: Date
    },
    // ── Supporting ────────────────────────────────────────────────────────────
    attachments: [{
        type: String,
        trim: true
    }],
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    referralSource: {
        type: String,
        trim: true,
        maxlength: [100, 'Referral source cannot exceed 100 characters']
    },
    // ── System ────────────────────────────────────────────────────────────────
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: {
            values: ['new', 'reviewed', 'converted', 'rejected'],
            message: 'Status must be new, reviewed, converted, or rejected'
        },
        default: 'new'
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    linkedProject: {
        type: Schema.Types.ObjectId,
        ref: 'Project'
    },
    linkedUser: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    // ── Audit timestamps ──────────────────────────────────────────────────────
    reviewedAt: { type: Date },
    convertedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    }
}, {
    timestamps: true
});

// ── Indexes ───────────────────────────────────────────────────────────────────
quotationRequestSchema.index({ email: 1 });
quotationRequestSchema.index({ status: 1 });
quotationRequestSchema.index({ projectType: 1 });
quotationRequestSchema.index({ assignedTo: 1 });
quotationRequestSchema.index({ createdAt: -1 });
quotationRequestSchema.index({ status: 1, createdAt: -1 });
quotationRequestSchema.index({ status: 1, projectType: 1 });

// ── Auto-number pre-save hook ─────────────────────────────────────────────────
// Counts by year-prefix regex to avoid race condition of flat countDocuments()
quotationRequestSchema.pre('save', async function (next) {
    if (!this.requestNumber || this.requestNumber.trim() === '') {
        try {
            const year = new Date().getFullYear();
            const count = await mongoose.model('QuotationRequest').countDocuments({
                requestNumber: new RegExp(`^RQR-${year}-`)
            });
            this.requestNumber = `RQR-${year}-${String(count + 1).padStart(4, '0')}`;
        } catch {
            const year = new Date().getFullYear();
            const ts = Date.now().toString().slice(-6);
            this.requestNumber = `RQR-${year}-${ts}`;
        }
    }
    next();
});

const QuotationRequest = mongoose.model<IQuotationRequest>('QuotationRequest', quotationRequestSchema);

export default QuotationRequest;
```

---

## Controller Functions

**File: `src/controllers/quotationRequestController.ts`**

### Functions Overview
- `submitQuotationRequest()` — Public RFQ submission (no auth); validates input, saves document, sends admin email + client acknowledgement + in-app notifications to admin team
- `getAllQuotationRequests()` — Paginated list with filters (`status`, `projectType`, `assignedTo`, `search`)
- `getQuotationRequest()` — Get single request with full population
- `updateRequestStatus()` — Move to `reviewed` or `rejected`; sets audit timestamps; notifies assignee or linked user
- `convertToProject()` — Atomically create a Project from the RFQ; requires `clientUserId`; uses Mongoose session
- `deleteQuotationRequest()` — Delete request (blocked if `converted`)

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import mongoose from 'mongoose';
import { errorHandler } from '../middleware/errorHandler';
import QuotationRequest from '../models/QuotationRequest';
import User from '../models/User';
import Role from '../models/Role';
import Project from '../models/Project';
import Service from '../models/Service';
import {
    sendQuotationRequestNotification,
    sendQuotationRequestAcknowledgement
} from '../services/external/emailService';
import { createInAppNotification } from '../utils/notificationHelper';
```

---

### submitQuotationRequest
**Route:** `POST /api/quotation-requests`  |  **Access:** Public

Controller Implementation:
```typescript
// @desc    Submit a public Request for Quotation
// @route   POST /api/quotation-requests
// @access  Public
export const submitQuotationRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            name, email, phone, company, country,
            projectTitle, projectType, description, services,
            budget, deadline, attachments, notes, referralSource
        } = req.body;

        // Required field validation
        if (!name || !email || !projectTitle || !projectType || !description) {
            return next(errorHandler(400, "Name, email, project title, project type, and description are required"));
        }

        // Email format validation
        if (!validator.isEmail(email)) {
            return next(errorHandler(400, "Please provide a valid email address"));
        }

        // Phone validation (if provided)
        if (phone && !validator.isMobilePhone(phone, 'any', { strictMode: false })) {
            return next(errorHandler(400, "Please provide a valid phone number"));
        }

        // Description length
        if (description.length < 20 || description.length > 2000) {
            return next(errorHandler(400, "Description must be between 20 and 2000 characters"));
        }

        // Notes length
        if (notes && notes.length > 500) {
            return next(errorHandler(400, "Notes cannot exceed 500 characters"));
        }

        // Validate projectType is an existing active Service
        const service = await Service.findOne({ _id: projectType, isActive: true });
        if (!service) {
            return next(errorHandler(400, "Invalid project type. Please select a valid service"));
        }

        // Deadline validation
        let parsedDeadline: Date | undefined;
        if (deadline) {
            parsedDeadline = new Date(deadline);
            if (isNaN(parsedDeadline.getTime())) {
                return next(errorHandler(400, "Invalid deadline date format"));
            }
            if (parsedDeadline < new Date()) {
                return next(errorHandler(400, "Deadline must be in the future"));
            }
        }

        // Attachments validation
        if (attachments !== undefined) {
            if (!Array.isArray(attachments)) {
                return next(errorHandler(400, "Attachments must be an array of URLs"));
            }
            if (attachments.length > 10) {
                return next(errorHandler(400, "Maximum 10 attachments allowed"));
            }
        }

        // Match existing user by email for linkedUser
        let linkedUserId: mongoose.Types.ObjectId | undefined;
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            linkedUserId = existingUser._id as unknown as mongoose.Types.ObjectId;
        }

        // Create and save the document
        const quotationRequest = new QuotationRequest({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone?.trim(),
            company: company?.trim(),
            country: country?.trim(),
            projectTitle: projectTitle.trim(),
            projectType,
            description: description.trim(),
            services: Array.isArray(services) ? services : [],
            budget: budget?.trim(),
            deadline: parsedDeadline,
            attachments: Array.isArray(attachments) ? attachments : [],
            notes: notes?.trim(),
            referralSource: referralSource?.trim(),
            status: 'new',
            linkedUser: linkedUserId
        });

        await quotationRequest.save();

        // Send admin notification email (non-blocking)
        try {
            const notifPayload: Parameters<typeof sendQuotationRequestNotification>[0] = {
                requestNumber: quotationRequest.requestNumber,
                name: quotationRequest.name,
                email: quotationRequest.email,
                projectTitle: quotationRequest.projectTitle,
                projectType: service.title,
                description: quotationRequest.description
            };
            if (quotationRequest.phone) notifPayload.phone = quotationRequest.phone;
            if (quotationRequest.company) notifPayload.company = quotationRequest.company;
            if (quotationRequest.country) notifPayload.country = quotationRequest.country;
            if (quotationRequest.services?.length) notifPayload.services = quotationRequest.services;
            if (quotationRequest.budget) notifPayload.budget = quotationRequest.budget;
            if (quotationRequest.deadline) notifPayload.deadline = quotationRequest.deadline;
            if (quotationRequest.notes) notifPayload.notes = quotationRequest.notes;
            if (quotationRequest.referralSource) notifPayload.referralSource = quotationRequest.referralSource;
            await sendQuotationRequestNotification(notifPayload);
        } catch (emailError) {
            console.error('Error sending RFQ admin notification email:', emailError);
        }

        // Send client acknowledgement email (non-blocking)
        try {
            await sendQuotationRequestAcknowledgement(
                quotationRequest.email,
                quotationRequest.name,
                quotationRequest.requestNumber,
                quotationRequest.projectTitle
            );
        } catch (emailError) {
            console.error('Error sending RFQ acknowledgement email:', emailError);
        }

        // In-app notify all super_admin + finance users (non-blocking)
        try {
            const adminRoles = await Role.find({ name: { $in: ['super_admin', 'finance'] } });
            const adminRoleIds = adminRoles.map((r: any) => r._id);
            const admins = await User.find({ roles: { $in: adminRoleIds }, isActive: true });

            const notificationPromises = admins.map((admin: any) =>
                createInAppNotification({
                    recipient: admin._id.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'New Quotation Request Received',
                    message: `New RFQ ${quotationRequest.requestNumber} submitted by ${quotationRequest.name}${quotationRequest.company ? ` (${quotationRequest.company})` : ''} for: ${quotationRequest.projectTitle}`,
                    metadata: {
                        requestId: quotationRequest._id,
                        requestNumber: quotationRequest.requestNumber,
                        submitterName: quotationRequest.name,
                        submitterEmail: quotationRequest.email,
                        projectTitle: quotationRequest.projectTitle,
                        projectType: quotationRequest.projectType
                    },
                    io: req.app.get('io')
                })
            );
            await Promise.all(notificationPromises);
        } catch (notificationError) {
            console.error('Error sending RFQ in-app notifications:', notificationError);
        }

        res.status(201).json({
            success: true,
            message: "Your quotation request has been submitted successfully. We will get back to you within 1-2 business days.",
            data: {
                quotationRequest: {
                    id: quotationRequest._id,
                    requestNumber: quotationRequest.requestNumber,
                    name: quotationRequest.name,
                    email: quotationRequest.email,
                    projectTitle: quotationRequest.projectTitle,
                    projectType: quotationRequest.projectType,
                    status: quotationRequest.status,
                    createdAt: quotationRequest.createdAt
                }
            }
        });

    } catch (error: any) {
        console.error('Submit quotation request error:', error);
        if (error.name === 'ValidationError') {
            return next(errorHandler(400, error.message));
        }
        next(errorHandler(500, "Server error while submitting quotation request"));
    }
};
```

---

### getAllQuotationRequests
**Route:** `GET /api/quotation-requests`  |  **Access:** Private (`super_admin`, `finance`, `project_manager`)

**Query Parameters:**
| Param | Description |
|---|---|
| `page` | Page number (default: 1) |
| `limit` | Items per page (default: 10) |
| `status` | Filter by status (`new`, `reviewed`, `converted`, `rejected`) |
| `projectType` | Filter by project type |
| `assignedTo` | Filter by assigned admin User ID |
| `search` | Regex search across `name`, `email`, `company`, `requestNumber` |

Controller Implementation:
```typescript
// @desc    Get all quotation requests with filters and pagination
// @route   GET /api/quotation-requests
// @access  Private (Admin)
export const getAllQuotationRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, status, projectType, assignedTo, search } = req.query;

        const query: any = {};

        if (status) query.status = status;
        if (projectType) query.projectType = projectType;
        if (assignedTo) query.assignedTo = assignedTo;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } },
                { requestNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        const quotationRequests = await QuotationRequest.find(query)
            .populate('assignedTo', 'firstName lastName email')
            .populate('linkedProject', 'title projectNumber')
            .populate('linkedUser', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum);

        const total = await QuotationRequest.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                quotationRequests,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(total / limitNum),
                    totalRequests: total,
                    hasNextPage: pageNum < Math.ceil(total / limitNum),
                    hasPrevPage: pageNum > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all quotation requests error:', error);
        next(errorHandler(500, "Server error while fetching quotation requests"));
    }
};
```

---

### getQuotationRequest
**Route:** `GET /api/quotation-requests/:requestId`  |  **Access:** Private (`super_admin`, `finance`, `project_manager`)

Controller Implementation:
```typescript
// @desc    Get single quotation request
// @route   GET /api/quotation-requests/:requestId
// @access  Private (Admin)
export const getQuotationRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestId } = req.params;

        const quotationRequest = await QuotationRequest.findById(requestId)
            .populate('assignedTo', 'firstName lastName email')
            .populate('linkedProject', 'title projectNumber status')
            .populate('linkedUser', 'firstName lastName email company');

        if (!quotationRequest) {
            return next(errorHandler(404, "Quotation request not found"));
        }

        res.status(200).json({
            success: true,
            data: { quotationRequest }
        });

    } catch (error: any) {
        console.error('Get quotation request error:', error);
        next(errorHandler(500, "Server error while fetching quotation request"));
    }
};
```

---

### updateRequestStatus
**Route:** `PATCH /api/quotation-requests/:requestId/status`  |  **Access:** Private (`super_admin`, `finance`, `project_manager`)

**Body (reviewed):**
```json
{
  "status": "reviewed",
  "assignedTo": "<user_id>"
}
```

**Body (rejected):**
```json
{
  "status": "rejected",
  "rejectionReason": "Budget is outside our service range"
}
```

Controller Implementation:
```typescript
// @desc    Update status of a quotation request
// @route   PATCH /api/quotation-requests/:requestId/status
// @access  Private (Admin)
export const updateRequestStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestId } = req.params;
        const { status, assignedTo, rejectionReason } = req.body;

        if (!status) {
            return next(errorHandler(400, "Status is required"));
        }

        if (!['reviewed', 'rejected'].includes(status)) {
            return next(errorHandler(400, "Status must be 'reviewed' or 'rejected'. Use the convert endpoint to set 'converted'"));
        }

        if (status === 'rejected' && !rejectionReason) {
            return next(errorHandler(400, "Rejection reason is required when rejecting a request"));
        }

        const quotationRequest = await QuotationRequest.findById(requestId);

        if (!quotationRequest) {
            return next(errorHandler(404, "Quotation request not found"));
        }

        if (['converted', 'rejected'].includes(quotationRequest.status)) {
            return next(errorHandler(400, `Cannot update a ${quotationRequest.status} quotation request`));
        }

        quotationRequest.status = status;
        if (assignedTo) quotationRequest.assignedTo = assignedTo;
        if (status === 'reviewed') quotationRequest.reviewedAt = new Date();
        if (status === 'rejected') {
            quotationRequest.rejectedAt = new Date();
            quotationRequest.rejectionReason = rejectionReason;
        }

        await quotationRequest.save();

        await quotationRequest.populate('assignedTo', 'firstName lastName email');
        await quotationRequest.populate('linkedUser', 'firstName lastName email');

        // Notify assigned admin on reviewed
        if (status === 'reviewed' && quotationRequest.assignedTo) {
            try {
                await createInAppNotification({
                    recipient: quotationRequest.assignedTo.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'Quotation Request Assigned to You',
                    message: `RFQ ${quotationRequest.requestNumber} from ${quotationRequest.name} has been assigned to you for review.`,
                    metadata: {
                        requestId: quotationRequest._id,
                        requestNumber: quotationRequest.requestNumber,
                        submitterName: quotationRequest.name,
                        projectTitle: quotationRequest.projectTitle
                    },
                    io: req.app.get('io')
                });
            } catch (notificationError) {
                console.error('Error sending assignment notification:', notificationError);
            }
        }

        // Notify linked user on rejected
        if (status === 'rejected' && quotationRequest.linkedUser) {
            try {
                await createInAppNotification({
                    recipient: quotationRequest.linkedUser.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'Quotation Request Update',
                    message: `Unfortunately, your quotation request ${quotationRequest.requestNumber} (${quotationRequest.projectTitle}) could not be fulfilled at this time. Reason: ${rejectionReason}`,
                    metadata: {
                        requestId: quotationRequest._id,
                        requestNumber: quotationRequest.requestNumber,
                        rejectionReason
                    },
                    io: req.app.get('io')
                });
            } catch (notificationError) {
                console.error('Error sending rejection notification:', notificationError);
            }
        }

        res.status(200).json({
            success: true,
            message: `Quotation request ${status} successfully`,
            data: { quotationRequest }
        });

    } catch (error: any) {
        console.error('Update request status error:', error);
        next(errorHandler(500, "Server error while updating quotation request status"));
    }
};
```

---

### convertToProject
**Route:** `POST /api/quotation-requests/:requestId/convert`  |  **Access:** Private (`super_admin`, `project_manager`)

**Body:**
```json
{
  "clientUserId": "<existing_user_id>",
  "priority": "high",
  "startDate": "2026-08-01",
  "endDate": "2026-12-31"
}
```

**Why `clientUserId` is required:**
The RFQ submitter may not have a platform account. The admin must first create the user via `POST /api/users`, then call convert with the new User ID. This keeps user-creation logic in the correct module.

Controller Implementation:
```typescript
// @desc    Convert quotation request to a Project
// @route   POST /api/quotation-requests/:requestId/convert
// @access  Private (super_admin, project_manager)
export const convertToProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestId } = req.params;
        const { clientUserId, startDate, endDate, priority } = req.body;

        if (!clientUserId) {
            return next(errorHandler(400, "clientUserId is required to assign a client to the new project"));
        }

        const quotationRequest = await QuotationRequest.findById(requestId);

        if (!quotationRequest) {
            return next(errorHandler(404, "Quotation request not found"));
        }

        if (quotationRequest.status === 'converted') {
            return next(errorHandler(400, "This request has already been converted to a project"));
        }

        if (quotationRequest.status === 'rejected') {
            return next(errorHandler(400, "Cannot convert a rejected quotation request"));
        }

        const client = await User.findById(clientUserId);
        if (!client) {
            return next(errorHandler(404, "Client user not found"));
        }

        let parsedStartDate: Date | undefined;
        let parsedEndDate: Date | undefined;
        if (startDate) {
            parsedStartDate = new Date(startDate);
            if (isNaN(parsedStartDate.getTime())) {
                return next(errorHandler(400, "Invalid startDate format"));
            }
        }
        if (endDate) {
            parsedEndDate = new Date(endDate);
            if (isNaN(parsedEndDate.getTime())) {
                return next(errorHandler(400, "Invalid endDate format"));
            }
        }

        const project = new Project({
            title: quotationRequest.projectTitle,
            description: quotationRequest.description,
            client: clientUserId,
            notes: quotationRequest.notes,
            priority: priority || 'medium',
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            assignedTo: quotationRequest.assignedTo ? [quotationRequest.assignedTo] : [],
            createdBy: req.user?._id,
            status: 'pending'
        });

        // Atomic write: save both documents or neither
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await project.save({ session });
            quotationRequest.status = 'converted';
            quotationRequest.linkedProject = project._id as any;
            quotationRequest.linkedUser = clientUserId;
            quotationRequest.convertedAt = new Date();
            await quotationRequest.save({ session });
            await session.commitTransaction();
        } catch (txError) {
            await session.abortTransaction();
            throw txError;
        } finally {
            session.endSession();
        }

        await project.populate('client', 'firstName lastName email company');
        await project.populate('createdBy', 'firstName lastName email');

        // Notify assigned admin (non-blocking)
        if (quotationRequest.assignedTo) {
            try {
                await createInAppNotification({
                    recipient: quotationRequest.assignedTo.toString(),
                    recipientModel: 'User',
                    category: 'project',
                    subject: 'RFQ Converted to Project',
                    message: `RFQ ${quotationRequest.requestNumber} has been converted to project ${(project as any).projectNumber}.`,
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
                        requestId: quotationRequest._id,
                        requestNumber: quotationRequest.requestNumber,
                        projectId: project._id,
                        projectNumber: (project as any).projectNumber
                    },
                    io: req.app.get('io')
                });
            } catch (notificationError) {
                console.error('Error sending RFQ convert admin notification:', notificationError);
            }
        }

        // Notify the client user (non-blocking)
        try {
            await createInAppNotification({
                recipient: clientUserId.toString(),
                recipientModel: 'User',
                category: 'project',
                subject: 'Your Quotation Request Has Been Approved',
                message: `Great news! Your quotation request for "${quotationRequest.projectTitle}" has been approved and project ${(project as any).projectNumber} has been created.`,
                metadata: {
                    requestId: quotationRequest._id,
                    requestNumber: quotationRequest.requestNumber,
                    projectId: project._id,
                    projectNumber: (project as any).projectNumber
                },
                io: req.app.get('io')
            });
        } catch (notificationError) {
            console.error('Error sending RFQ convert client notification:', notificationError);
        }

        res.status(201).json({
            success: true,
            message: "Quotation request converted to project successfully",
            data: {
                project,
                quotationRequest: {
                    id: quotationRequest._id,
                    requestNumber: quotationRequest.requestNumber,
                    status: quotationRequest.status,
                    convertedAt: quotationRequest.convertedAt
                }
            }
        });

    } catch (error: any) {
        console.error('Convert to project error:', error);
        if (error.name === 'ValidationError') {
            return next(errorHandler(400, error.message));
        }
        next(errorHandler(500, "Server error while converting quotation request to project"));
    }
};
```

---

### deleteQuotationRequest
**Route:** `DELETE /api/quotation-requests/:requestId`  |  **Access:** Private (`super_admin` only)

**Guard:** Cannot delete `converted` requests — they are linked to an active project.

Controller Implementation:
```typescript
// @desc    Delete quotation request
// @route   DELETE /api/quotation-requests/:requestId
// @access  Private (super_admin only)
export const deleteQuotationRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestId } = req.params;

        const quotationRequest = await QuotationRequest.findById(requestId);

        if (!quotationRequest) {
            return next(errorHandler(404, "Quotation request not found"));
        }

        if (quotationRequest.status === 'converted') {
            return next(errorHandler(400, "Cannot delete a converted quotation request — it is linked to an active project"));
        }

        await QuotationRequest.findByIdAndDelete(requestId);

        res.status(200).json({
            success: true,
            message: "Quotation request deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete quotation request error:', error);
        next(errorHandler(500, "Server error while deleting quotation request"));
    }
};
```

---

## Routes

### Base Path: `/api/quotation-requests`

```typescript
POST   /                         // Submit RFQ (public)
GET    /                         // Get all requests (admin)
PATCH  /:requestId/status        // Update status (admin)
POST   /:requestId/convert       // Convert to Project (super_admin, project_manager)
GET    /:requestId               // Get single request (admin)
DELETE /:requestId               // Delete request (super_admin only)
```

### Router Implementation

**File: `src/routes/quotationRequestRoutes.ts`**

```typescript
import express from 'express';
import {
    submitQuotationRequest,
    getAllQuotationRequests,
    getQuotationRequest,
    updateRequestStatus,
    convertToProject,
    deleteQuotationRequest
} from '../controllers/quotationRequestController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/quotation-requests
 * @desc    Submit a public Request for Quotation
 * @access  Public
 */
router.post('/', submitQuotationRequest);

/**
 * @route   GET /api/quotation-requests
 * @desc    Get all quotation requests with filters and pagination
 * @access  Private (Admin)
 */
router.get(
    '/',
    authenticateToken,
    authorizeRoles(['super_admin', 'finance', 'project_manager']),
    getAllQuotationRequests
);

// Sub-routes before dynamic :requestId to avoid Express ordering conflicts
/**
 * @route   PATCH /api/quotation-requests/:requestId/status
 * @desc    Update quotation request status (reviewed / rejected)
 * @access  Private (Admin)
 */
router.patch(
    '/:requestId/status',
    authenticateToken,
    authorizeRoles(['super_admin', 'finance', 'project_manager']),
    updateRequestStatus
);

/**
 * @route   POST /api/quotation-requests/:requestId/convert
 * @desc    Convert quotation request to a Project
 * @access  Private (super_admin, project_manager)
 */
router.post(
    '/:requestId/convert',
    authenticateToken,
    authorizeRoles(['super_admin', 'project_manager']),
    convertToProject
);

/**
 * @route   GET /api/quotation-requests/:requestId
 * @desc    Get single quotation request
 * @access  Private (Admin)
 */
router.get(
    '/:requestId',
    authenticateToken,
    authorizeRoles(['super_admin', 'finance', 'project_manager']),
    getQuotationRequest
);

/**
 * @route   DELETE /api/quotation-requests/:requestId
 * @desc    Delete quotation request
 * @access  Private (super_admin only)
 */
router.delete(
    '/:requestId',
    authenticateToken,
    authorizeRoles(['super_admin']),
    deleteQuotationRequest
);

export default router;
```

---

## API Examples

### Submit Quotation Request (Public)
```bash
curl -X POST http://localhost:4000/api/quotation-requests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Mwangi",
    "email": "jane@acmecorp.co.ke",
    "phone": "+254712345678",
    "company": "Acme Corp",
    "country": "Kenya",
    "projectTitle": "E-Commerce Platform",
    "projectType": "web_development",
    "description": "We need a full-featured online store with M-Pesa payment integration, product catalog, order tracking, and an admin dashboard. We currently sell offline and want to move online.",
    "services": ["Web Development", "Payment Integration", "Admin Dashboard"],
    "budget": "$8,000 - $15,000",
    "deadline": "2026-12-31",
    "notes": "Prefer progressive web app (PWA) approach",
    "referralSource": "Google Search"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Your quotation request has been submitted successfully. We will get back to you within 1-2 business days.",
  "data": {
    "quotationRequest": {
      "id": "...",
      "requestNumber": "RQR-2026-0001",
      "name": "Jane Mwangi",
      "email": "jane@acmecorp.co.ke",
      "projectTitle": "E-Commerce Platform",
      "projectType": "web_development",
      "status": "new",
      "createdAt": "2026-07-23T10:00:00.000Z"
    }
  }
}
```

---

### Get All Requests (Admin)
```bash
curl -X GET "http://localhost:4000/api/quotation-requests?status=new&page=1&limit=10" \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotationRequests": [
      {
        "_id": "...",
        "requestNumber": "RQR-2026-0001",
        "name": "Jane Mwangi",
        "email": "jane@acmecorp.co.ke",
        "company": "Acme Corp",
        "projectTitle": "E-Commerce Platform",
        "projectType": "web_development",
        "budget": "$8,000 - $15,000",
        "status": "new",
        "assignedTo": null,
        "linkedProject": null,
        "linkedUser": null,
        "createdAt": "2026-07-23T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalRequests": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

### Get Single Request (Admin)
```bash
curl -X GET http://localhost:4000/api/quotation-requests/<requestId> \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotationRequest": {
      "_id": "...",
      "requestNumber": "RQR-2026-0001",
      "name": "Jane Mwangi",
      "email": "jane@acmecorp.co.ke",
      "company": "Acme Corp",
      "country": "Kenya",
      "projectTitle": "E-Commerce Platform",
      "projectType": "web_development",
      "description": "We need a full-featured online store...",
      "services": ["Web Development", "Payment Integration"],
      "budget": "$8,000 - $15,000",
      "deadline": "2026-12-31T00:00:00.000Z",
      "status": "new",
      "assignedTo": null,
      "linkedProject": null,
      "linkedUser": null,
      "createdAt": "2026-07-23T10:00:00.000Z",
      "updatedAt": "2026-07-23T10:00:00.000Z"
    }
  }
}
```

---

### Update Status to Reviewed + Assign
```bash
curl -X PATCH http://localhost:4000/api/quotation-requests/<requestId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "status": "reviewed",
    "assignedTo": "<admin_user_id>"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation request reviewed successfully",
  "data": {
    "quotationRequest": {
      "_id": "...",
      "requestNumber": "RQR-2026-0001",
      "status": "reviewed",
      "reviewedAt": "2026-07-23T11:00:00.000Z",
      "assignedTo": {
        "_id": "...",
        "firstName": "David",
        "lastName": "Kamau",
        "email": "david@lizen.com"
      }
    }
  }
}
```

---

### Reject a Request
```bash
curl -X PATCH http://localhost:4000/api/quotation-requests/<requestId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "status": "rejected",
    "rejectionReason": "The budget range provided is below our minimum engagement threshold."
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation request rejected successfully",
  "data": {
    "quotationRequest": {
      "_id": "...",
      "status": "rejected",
      "rejectedAt": "2026-07-23T12:00:00.000Z",
      "rejectionReason": "The budget range provided is below our minimum engagement threshold."
    }
  }
}
```

---

### Convert to Project
```bash
curl -X POST http://localhost:4000/api/quotation-requests/<requestId>/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "clientUserId": "<user_id_for_jane>",
    "priority": "high",
    "startDate": "2026-08-01",
    "endDate": "2026-12-31"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation request converted to project successfully",
  "data": {
    "project": {
      "_id": "...",
      "projectNumber": "PRJ-2026-0001",
      "title": "E-Commerce Platform",
      "description": "We need a full-featured online store...",
      "client": {
        "_id": "...",
        "firstName": "Jane",
        "lastName": "Mwangi",
        "email": "jane@acmecorp.co.ke",
        "company": "Acme Corp"
      },
      "priority": "high",
      "status": "pending",
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2026-12-31T00:00:00.000Z",
      "createdAt": "2026-07-23T12:30:00.000Z"
    },
    "quotationRequest": {
      "id": "...",
      "requestNumber": "RQR-2026-0001",
      "status": "converted",
      "convertedAt": "2026-07-23T12:30:00.000Z"
    }
  }
}
```

---

### Delete a Request
```bash
curl -X DELETE http://localhost:4000/api/quotation-requests/<requestId> \
  -H "Authorization: Bearer <super_admin_token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation request deleted successfully"
}
```

---

## Notification Matrix

| Event | Trigger | Recipient(s) | Channel | Category |
|---|---|---|---|---|
| RFQ Submitted | `submitQuotationRequest` | All `super_admin` + `finance` users | In-app + Email (admin alert) | `general` |
| RFQ Submitted | `submitQuotationRequest` | Submitter (email only) | Email (acknowledgement) | — |
| Status → reviewed | `updateRequestStatus` | Assigned admin (if `assignedTo` set) | In-app | `general` |
| Status → rejected | `updateRequestStatus` | `linkedUser` (if exists) | In-app | `general` |
| Converted to Project | `convertToProject` | Assigned admin (if `assignedTo` set) | In-app | `project` |
| Converted to Project | `convertToProject` | Client user (`clientUserId`) | In-app | `project` |

**Note:** All notifications are non-blocking — a notification failure never causes the API request to fail.

---

## Security Features

### Access Control
| Endpoint | Access Level |
|---|---|
| `POST /` | Public — no auth |
| `GET /` | `super_admin`, `finance`, `project_manager` |
| `GET /:id` | `super_admin`, `finance`, `project_manager` |
| `PATCH /:id/status` | `super_admin`, `finance`, `project_manager` |
| `POST /:id/convert` | `super_admin`, `project_manager` |
| `DELETE /:id` | `super_admin` only |

### Data Protection
- **Public response** — `submitQuotationRequest` returns only safe fields; no internal admin data exposed to submitter
- **Terminal state guard** — `converted` and `rejected` requests cannot be re-updated
- **Delete guard** — `converted` requests cannot be deleted (linked to active project)
- **Atomic conversion** — Mongoose session ensures Project + QuotationRequest save together or not at all
- **Input validation** — Email, phone, enum, lengths, date format all validated before DB write

---

## Error Handling

```json
// 400 – Missing required fields
{ "success": false, "message": "Name, email, project title, project type, and description are required" }

// 400 – Invalid email
{ "success": false, "message": "Please provide a valid email address" }

// 400 – Invalid projectType
{ "success": false, "message": "Invalid project type. Must be one of: web_development, mobile_app, ..." }

// 400 – Deadline in the past
{ "success": false, "message": "Deadline must be in the future" }

// 400 – Too many attachments
{ "success": false, "message": "Maximum 10 attachments allowed" }

// 400 – Status update on terminal state
{ "success": false, "message": "Cannot update a converted quotation request" }

// 400 – Missing rejection reason
{ "success": false, "message": "Rejection reason is required when rejecting a request" }

// 400 – Already converted
{ "success": false, "message": "This request has already been converted to a project" }

// 400 – Delete converted request
{ "success": false, "message": "Cannot delete a converted quotation request — it is linked to an active project" }

// 400 – Missing clientUserId on convert
{ "success": false, "message": "clientUserId is required to assign a client to the new project" }

// 404 – Not found
{ "success": false, "message": "Quotation request not found" }

// 404 – Client user not found on convert
{ "success": false, "message": "Client user not found" }
```

---

## Integration with Other Modules

### Project Integration (Primary)
- `convertToProject` creates a `Project` document, setting `title`, `description`, `client`, `notes`, `priority`, `startDate`, `endDate`, and `assignedTo` from the RFQ
- The `linkedProject` field on the `QuotationRequest` permanently links the two documents
- Once converted, the admin uses the `Project` module to create a `Quotation` (via `POST /api/quotations`), continuing the standard workflow

### User Integration
- On submission, the controller auto-queries `User.findOne({ email })` to detect existing users and sets `linkedUser`
- On conversion, admin passes `clientUserId` which becomes `project.client`; `linkedUser` is also updated to this value

### Notification Integration
- Uses `createInAppNotification()` from `src/utils/notificationHelper.ts`
- Uses Socket.io `io` from `req.app.get('io')`
- Notification categories: `'general'` for RFQ events, `'project'` for conversion events

### Email Integration
- **Admin alert:** `sendQuotationRequestNotification()` in `src/services/external/emailService.ts`
- **Client acknowledgement:** `sendQuotationRequestAcknowledgement()` in `src/services/external/emailService.ts`
- Both are wrapped in try/catch — email failure does not fail the API response

---

**Last Updated:** July 2026
**Version:** 1.0.0
**Maintainer:** LIZEN Development Team
