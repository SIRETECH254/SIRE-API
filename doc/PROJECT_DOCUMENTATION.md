
# 🚀 SIRE Tech API - Project Management Documentation

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Project Model](#project-model)
- [Project Controller](#project-controller)
- [Project Routes](#project-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 📊 Project Overview

The SIRE Tech API Project Management System handles all project-related operations including creation, tracking, milestone management, team assignment, and progress monitoring. Projects are the core execution units that connect clients, services, quotations, and invoices.

### Project System Features
- **Project Creation** - Create projects from quotations or standalone
- **Team Assignment** - Assign multiple team members to projects
- **Milestone Tracking** - Define and track project milestones
- **Progress Monitoring** - Track completion percentage (0-100%)
- **File Attachments** - Upload and manage project documents
- **Status Management** - Track project lifecycle status
- **Priority Levels** - Set project urgency (low, medium, high, urgent)
- **Auto-numbering** - Unique project numbers (PRJ-2025-0001)
- **Real-time Updates** - Socket.io notifications for changes

### Project Lifecycle
1. **Pending** - Project created, not yet started
2. **In Progress** - Active development/execution
3. **On Hold** - Temporarily paused
4. **Completed** - Successfully finished
5. **Cancelled** - Project terminated

---

## 🗄️ Project Model

### Schema Definition
```typescript
interface IProject {
  _id: string;
  projectNumber: string;        // Auto-generated (PRJ-2025-0001)
  title: string;
  description: string;
  client: ObjectId;              // Reference to User
  quotation?: ObjectId;          // Reference to Quotation (auto-set when quotation created)
  invoice?: ObjectId;            // Reference to Invoice (auto-set when invoice created)
  services: ObjectId[];          // References to Services
  status: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: ObjectId[];        // References to User (team members)
  startDate?: Date;
  endDate?: Date;
  completionDate?: Date;
  progress: number;              // 0-100
  milestones: Array<{
    title: string;
    description?: string;
    dueDate: Date;
    status: 'pending' | 'in_progress' | 'completed';
    completedDate?: Date;
  }>;
  attachments: Array<{
    name: string;
    url: string;
    uploadedBy: ObjectId;
    uploadedAt: Date;
  }>;
  notes?: string;
  createdBy: ObjectId;           // Reference to User
  createdAt: Date;
  updatedAt: Date;
}
```

**Important Notes:**
- `quotation` and `invoice` fields are **NOT** included in the request body when creating a project
- They are automatically set when quotations/invoices are created for the project
- The workflow is: **Project → Quotation → Invoice**

### Key Features
- **Auto-numbering** - Unique project numbers generated automatically
- **Client Association** - Linked to client record
- **Service Integration** - Multiple services per project
- **Team Collaboration** - Multiple team members can be assigned
- **Milestone Management** - Track key deliverables
- **File Management** - Attach documents and files
- **Progress Tracking** - Percentage-based completion tracking
- **Timeline Management** - Start, end, and completion dates
- **Priority System** - Four urgency levels
- **Audit Trail** - Created by and timestamps

### Validation Rules
```typescript
// Required fields
title: { required: true, maxlength: 200 }
description: { required: true }
client: { required: true, ref: 'User' }
status: { required: true, enum: ['pending', 'in_progress', 'on_hold', 'completed', 'cancelled'] }
priority: { required: true, enum: ['low', 'medium', 'high', 'urgent'] }
progress: { required: true, min: 0, max: 100 }
createdBy: { required: true, ref: 'User' }

// Optional fields
quotation: { ref: 'Quotation' }
invoice: { ref: 'Invoice' }
services: { type: Array, ref: 'Service' }
assignedTo: { type: Array, ref: 'User' }
startDate: { type: Date }
endDate: { type: Date }
completionDate: { type: Date }
notes: { maxlength: 1000 }
```

### Model Implementation

**File: `src/models/Project.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IProject } from '../types/index';

const projectSchema = new Schema<IProject>({
  projectNumber: {
    type: String,
    required: [true, 'Project number is required'],
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  quotation: {
    type: Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  services: [{
    type: Schema.Types.ObjectId,
    ref: 'Service'
  }],
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'in_progress', 'on_hold', 'completed', 'cancelled'],
      message: 'Status must be pending, in_progress, on_hold, completed, or cancelled'
    },
    default: 'pending'
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be low, medium, high, or urgent'
    },
    default: 'medium'
  },
  assignedTo: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  completionDate: {
    type: Date
  },
  progress: {
    type: Number,
    required: [true, 'Progress is required'],
    min: [0, 'Progress cannot be less than 0'],
    max: [100, 'Progress cannot exceed 100'],
    default: 0
  },
  milestones: [{
    title: {
      type: String,
      required: [true, 'Milestone title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    dueDate: {
      type: Date,
      required: [true, 'Milestone due date is required']
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    completedDate: {
      type: Date
    }
  }],
  attachments: [{
    name: {
      type: String,
      required: [true, 'Attachment name is required']
    },
    url: {
      type: String,
      required: [true, 'Attachment URL is required']
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  }
}, {
  timestamps: true
});

// Indexes for better performance
projectSchema.index({ projectNumber: 1 });
projectSchema.index({ client: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ assignedTo: 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ status: 1, priority: 1 });
projectSchema.index({ client: 1, status: 1 });

// Pre-save middleware to generate project number
projectSchema.pre('save', async function(next) {
  if (!this.projectNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Project').countDocuments();
    this.projectNumber = `PRJ-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Pre-save middleware to set completion date when status changes to completed
projectSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completionDate) {
    this.completionDate = new Date();
  }
  next();
});

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;
```

---

## 🎮 Project Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Project from '../models/Project';
import Client from '../models/Client';
import User from '../models/User';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { createInAppNotification } from '../utils/notificationHelper';
```

### Functions Overview

#### `createProject(projectData)`
**Purpose:** Create new project (Admin only)
**Access:** Admin users (super_admin, project_manager)
**Validation:**
- Title, description, client required
- Client existence check
- Service existence check (if provided)
- Team member validation
**Process:**
- Generate unique project number
- Validate client and services
- Create project record
- **Note:** `quotation` and `invoice` are NOT in request body - they are set automatically when quotation/invoice is created
- **Send in-app notifications to client and assigned team members** (project created)
- Emit Socket.io event for real-time update
**Response:** Complete project data

**Notifications:**
- **Client** receives in-app notification: "New Project Created" with project title and details
- **Assigned Team Members** receive in-app notification: "New Project Created" with project title and assignment details

**Important:** 
- Projects must be created first before quotations
- Workflow: Project → Quotation → Invoice

**Controller Implementation:**
```typescript
export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { title, description, client, services, priority, assignedTo, startDate, endDate, notes }: {
            title: string;
            description: string;
            client: string;
            services?: string[];
            priority?: 'low' | 'medium' | 'high' | 'urgent';
            assignedTo?: string[];
            startDate?: Date;
            endDate?: Date;
            notes?: string;
        } = req.body;

        // Validation
        if (!title || !description || !client) {
            return next(errorHandler(400, "Title, description, and client are required"));
        }

        // Check if client exists
        const clientExists = await User.findById(client);
        if (!clientExists) {
            return next(errorHandler(404, "Client not found"));
        }

        // Create project
        // Note: quotation and invoice are NOT in request body
        // They will be set automatically when quotation/invoice is created
        const project = new Project({
            title,
            description,
            client,
            services: services || [],
            priority: priority || 'medium',
            assignedTo: assignedTo || [],
            startDate,
            endDate,
            notes,
            createdBy: req.user?._id
        });

        await project.save();

        // Populate references
        await project.populate('client', 'firstName lastName email company');
        await project.populate('assignedTo', 'firstName lastName email');

        // Send notifications to client and assigned team members
        try {
            // For Client
            await createInAppNotification({
                recipient: project.client.toString(),
                recipientModel: 'User',
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
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Create project error:', error);
        next(errorHandler(500, "Server error while creating project"));
    }
};
```

#### `getAllProjects(query)`
**Purpose:** Get paginated project list with filtering
**Access:** Admin users
**Features:**
- Pagination
- Search by title or project number
- Filter by status, priority, client
- Filter by assigned team member
- Sort options
- Population of client and team members
**Response:** Paginated project list

**Controller Implementation:**
```typescript
export const getAllProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status, priority, client } = req.query;

        const query: any = {};

        // Search by title or project number
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { projectNumber: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by priority
        if (priority) {
            query.priority = priority;
        }

        // Filter by client
        if (client) {
            query.client = client;
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const projects = await Project.find(query)
            .populate('client', 'firstName lastName email company')
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Project.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                projects: projects,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalProjects: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all projects error:', error);
        next(errorHandler(500, "Server error while fetching projects"));
    }
};
```

#### `getProject(projectId)`
**Purpose:** Get single project details
**Access:** Admin or assigned team member or client
**Response:** Complete project with populated references

**Controller Implementation:**
```typescript
export const getProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;

        const project = await Project.findById(projectId)
            .populate('client', 'firstName lastName email company phone')
            .populate('quotation')
            .populate('invoice')
            .populate('services', 'title description basePrice')
            .populate('assignedTo', 'firstName lastName email avatar')
            .populate('createdBy', 'firstName lastName email')
            .populate('attachments.uploadedBy', 'firstName lastName');

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Get project error:', error);
        next(errorHandler(500, "Server error while fetching project"));
    }
};
```

#### `updateProject(projectId, projectData)`
**Purpose:** Update project details
**Access:** Admin or assigned team member
**Allowed Fields:**
- title, description, status, priority
- startDate, endDate, progress, notes
- Cannot change client or project number
**Response:** Updated project data

**Controller Implementation:**
```typescript
export const updateProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { title, description, status, priority, startDate, endDate, notes }: {
            title?: string;
            description?: string;
            status?: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
            priority?: 'low' | 'medium' | 'high' | 'urgent';
            startDate?: Date;
            endDate?: Date;
            notes?: string;
        } = req.body;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        // Update allowed fields
        if (title) project.title = title;
        if (description) project.description = description;
        if (status) project.status = status;
        if (priority) project.priority = priority;
        if (startDate) project.startDate = startDate;
        if (endDate) project.endDate = endDate;
        if (notes) project.notes = notes;

        await project.save();

        res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Update project error:', error);
        next(errorHandler(500, "Server error while updating project"));
    }
};
```

#### `deleteProject(projectId)`
**Purpose:** Delete project (Admin only)
**Access:** Super admin only
**Security:**
- Admin permission check
- Cascade considerations
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        await Project.findByIdAndDelete(projectId);

        res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete project error:', error);
        next(errorHandler(500, "Server error while deleting project"));
    }
};
```

#### `assignTeamMembers(projectId, userIds)`
**Purpose:** Assign or update team members
**Access:** Admin or project manager
**Validation:**
- User existence check
- Role validation
**Process:**
- Update assigned team members
- **Send bidirectional in-app notifications to newly assigned team members** (project assignment)
**Response:** Updated project with team

**Notifications:**
- **Newly Assigned Team Members** receive bidirectional notification: "Assigned to Project" with actions:
  - **"View Project"** button (Navigate action) - Opens project details
- **Metadata:** Includes project ID, title, and priority

**Controller Implementation:**
```typescript
export const assignTeamMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { userIds }: { userIds: string[] } = req.body;

        if (!userIds || !Array.isArray(userIds)) {
            return next(errorHandler(400, "User IDs array is required"));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        // Verify all users exist
        const users = await User.find({ _id: { $in: userIds } });
        if (users.length !== userIds.length) {
            return next(errorHandler(404, "One or more users not found"));
        }

        project.assignedTo = userIds.map(id => new mongoose.Types.ObjectId(id));
        await project.save();

        await project.populate('assignedTo', 'firstName lastName email avatar');

        // Send notifications to newly assigned team members
        try {
            for (const userId of userIds) {
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
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Team members assigned successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Assign team members error:', error);
        next(errorHandler(500, "Server error while assigning team members"));
    }
};
```

#### `updateProjectStatus(projectId, status)`
**Purpose:** Update project status
**Access:** Admin or assigned team member
**Validation:**
- Valid status transition
- Auto-set completion date
**Process:**
- Update status
- Set completion date if completed
- **Send in-app notifications to client and assigned team members** (status updated)
- Emit Socket.io event
**Response:** Updated project

**Notifications:**
- **Client** receives bidirectional notification: "Project Status Updated" with actions (View Project)
- **Assigned Team Members** receive in-app notification: "Project Status Updated" with status change details

**Controller Implementation:**
```typescript
export const updateProjectStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { status }: { status: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' } = req.body;

        if (!status) {
            return next(errorHandler(400, "Status is required"));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.status = status;
        await project.save();

        // Emit Socket.io event
        const io = req.app.get('io');
        if (io) {
            io.to(`project_${projectId}`).emit('status_updated', {
                projectId: project._id,
                status: project.status
            });
        }

        // Send notifications to client and assigned team members
        try {
            // For Client
            await createInAppNotification({
                recipient: project.client.toString(),
                recipientModel: 'User',
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
                    oldStatus: 'previous',
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
                            oldStatus: 'previous',
                            newStatus: project.status
                        },
                        io: req.app.get('io')
                    });
                }
            }
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Project status updated successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Update project status error:', error);
        next(errorHandler(500, "Server error while updating project status"));
    }
};
```

#### `updateProgress(projectId, progress)`
**Purpose:** Update project progress percentage
**Access:** Admin or assigned team member
**Validation:**
- Progress between 0-100
- Auto-update status based on progress
**Process:**
- Update progress percentage
- **Send in-app notification to client** (only for milestone percentages: 25%, 50%, 75%, 100%)
**Response:** Updated project

**Notifications:**
- **Client** receives in-app notification: "Project Progress Updated" (only for milestone progress: 25%, 50%, 75%, 100%)
- **Metadata:** Includes project ID, title, progress percentage, and status

**Controller Implementation:**
```typescript
export const updateProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { progress }: { progress: number } = req.body;

        if (progress === undefined || progress < 0 || progress > 100) {
            return next(errorHandler(400, "Progress must be between 0 and 100"));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.progress = progress;

        // Auto-update status based on progress
        if (progress === 100 && project.status !== 'completed') {
            project.status = 'completed';
        } else if (progress > 0 && project.status === 'pending') {
            project.status = 'in_progress';
        }

        await project.save();

        // Send notification to client for milestone progress updates (25, 50, 75, 100)
        try {
            const isMilestoneProgress = [25, 50, 75, 100].includes(progress);
            
            // For Client (only for milestones)
            if (isMilestoneProgress) {
                await createInAppNotification({
                    recipient: project.client.toString(),
                    recipientModel: 'User',
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
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Project progress updated successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Update progress error:', error);
        next(errorHandler(500, "Server error while updating progress"));
    }
};
```

#### `addMilestone(projectId, milestoneData)`
**Purpose:** Add project milestone
**Access:** Admin or assigned team member
**Validation:**
- Title and due date required
- Valid status
**Process:**
- Add milestone to project
- **Send in-app notifications to client and assigned team members** (milestone added)
**Response:** Updated project with new milestone

**Notifications:**
- **Client** receives in-app notification: "New Milestone Added" with milestone title and due date
- **Assigned Team Members** receive in-app notification: "New Milestone Added" with milestone details

**Controller Implementation:**
```typescript
export const addMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;
        const { title, description, dueDate }: {
            title: string;
            description?: string;
            dueDate: Date;
        } = req.body;

        if (!title || !dueDate) {
            return next(errorHandler(400, "Title and due date are required"));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.milestones.push({
            title,
            description,
            dueDate,
            status: 'pending'
        } as any);

        await project.save();

        // Send notifications for new milestone
        try {
            const newMilestone = project.milestones[project.milestones.length - 1];
            
            if (newMilestone) {
                // For Client
                await createInAppNotification({
                    recipient: project.client.toString(),
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
            }
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Milestone added successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Add milestone error:', error);
        next(errorHandler(500, "Server error while adding milestone"));
    }
};
```

#### `updateMilestone(projectId, milestoneId, milestoneData)`
**Purpose:** Update milestone details
**Access:** Admin or assigned team member
**Validation:**
- Milestone existence
- Status validation
**Process:**
- Update milestone details or status
- **Send in-app notifications to client and assigned team members** (milestone updated)
**Response:** Updated milestone

**Notifications:**
- **Client** receives in-app notification: "Milestone Updated" with milestone title and status
- **Assigned Team Members** receive in-app notification: "Milestone Updated" with milestone status change

**Controller Implementation:**
```typescript
export const updateMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId, milestoneId } = req.params;
        const { title, description, dueDate, status }: {
            title?: string;
            description?: string;
            dueDate?: Date;
            status?: 'pending' | 'in_progress' | 'completed';
        } = req.body;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        const milestone = project.milestones.id(milestoneId);

        if (!milestone) {
            return next(errorHandler(404, "Milestone not found"));
        }

        if (title) milestone.title = title;
        if (description) milestone.description = description;
        if (dueDate) milestone.dueDate = dueDate;
        if (status) {
            milestone.status = status;
            if (status === 'completed' && !milestone.completedDate) {
                milestone.completedDate = new Date();
            }
        }

        await project.save();

        // Send notifications for milestone status changes
        try {
            // For Client
            await createInAppNotification({
                recipient: project.client.toString(),
                recipientModel: 'User',
                category: 'project',
                subject: 'Milestone Updated',
                message: `Milestone "${milestone.title}" in project "${project.title}" has been marked as ${milestone.status}`,
                metadata: {
                    projectId: project._id,
                    projectNumber: project.projectNumber,
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
                            milestoneTitle: milestone.title,
                            status: milestone.status
                        },
                        io: req.app.get('io')
                    });
                }
            }
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            message: "Milestone updated successfully",
            data: {
                project: project
            }
        });

    } catch (error: any) {
        console.error('Update milestone error:', error);
        next(errorHandler(500, "Server error while updating milestone"));
    }
};
```

#### `deleteMilestone(projectId, milestoneId)`
**Purpose:** Delete milestone
**Access:** Admin or assigned team member
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId, milestoneId } = req.params;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.milestones.pull(milestoneId as any);
        await project.save();

        res.status(200).json({
            success: true,
            message: "Milestone deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete milestone error:', error);
        next(errorHandler(500, "Server error while deleting milestone"));
    }
};
```

#### `uploadAttachment(projectId, files)`
**Purpose:** Upload project attachments (supports multiple files, up to 10 per request)
**Access:** Admin or assigned team member
**Process:**
- Upload multiple files to Cloudinary (max 10 files per request)
- Store file metadata for each uploaded file
- Track uploader for each attachment
- **Send in-app notification to client** (new attachments uploaded)
- Handle partial failures gracefully (continue uploading remaining files if one fails)
**Response:** Array of uploaded attachment details with upload statistics

**Notifications:**
- **Client** receives in-app notification: "New Project Attachment" (single file) or "New Project Attachments" (multiple files) with file names and project details

**Controller Implementation:**
```typescript
export const uploadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;

        // Check if files were uploaded (req.files is array when using .array())
        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length === 0) {
            return next(errorHandler(400, "No files uploaded"));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        const uploadedAttachments: any[] = [];
        const uploadErrors: string[] = [];

        // Upload each file to Cloudinary
        for (const file of files) {
            try {
                const uploadResult = await uploadToCloudinary(file, 'sire-tech/project-attachments');

                const attachment = {
                    name: file.originalname,
            url: uploadResult.url,
            uploadedBy: req.user?._id as any,
            uploadedAt: new Date()
                };

                project.attachments.push(attachment as any);
                uploadedAttachments.push(attachment);
            } catch (uploadError: any) {
                console.error(`Error uploading file ${file.originalname}:`, uploadError);
                uploadErrors.push(file.originalname);
            }
        }

        // Save project with all new attachments
        await project.save();

        // Send notifications for new attachments
        try {
            if (uploadedAttachments.length > 0 && req.user?._id) {
                const fileCount = uploadedAttachments.length;
                const fileNames = uploadedAttachments.map(a => a.name).join(', ');
            
                // For Client
                await createInAppNotification({
                    recipient: project.client.toString(),
                    recipientModel: 'User',
                    category: 'project',
                    subject: fileCount === 1 ? 'New Project Attachment' : 'New Project Attachments',
                    message: fileCount === 1 
                        ? `A new file "${fileNames}" has been uploaded to project "${project.title}"`
                        : `${fileCount} new files have been uploaded to project "${project.title}": ${fileNames}`,
                    metadata: {
                        projectId: project._id,
                        projectNumber: project.projectNumber,
                        fileCount: fileCount,
                        fileNames: uploadedAttachments.map(a => a.name),
                        uploadedBy: req.user._id
                    },
                    io: (req.app as any).get('io')
                });
            }
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        // Prepare response message
        let message = "Attachment uploaded successfully";
        if (uploadedAttachments.length > 1) {
            message = `${uploadedAttachments.length} attachments uploaded successfully`;
        }
        if (uploadErrors.length > 0) {
            message += `. ${uploadErrors.length} file(s) failed to upload: ${uploadErrors.join(', ')}`;
        }

        res.status(201).json({
            success: true,
            message: message,
            data: {
                attachments: uploadedAttachments,
                uploadedCount: uploadedAttachments.length,
                failedCount: uploadErrors.length
            }
        });

    } catch (error: any) {
        console.error('Upload attachment error:', error);
        next(errorHandler(500, "Server error while uploading attachments"));
    }
};
```

#### `deleteAttachment(projectId, attachmentId)`
**Purpose:** Delete project attachment
**Access:** Admin or uploader
**Process:**
- Delete from Cloudinary
- Remove from database
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId, attachmentId } = req.params;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.attachments.pull(attachmentId as any);
        await project.save();

        res.status(200).json({
            success: true,
            message: "Attachment deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete attachment error:', error);
        next(errorHandler(500, "Server error while deleting attachment"));
    }
};
```

#### `getClientProjects(clientId)`
**Purpose:** Get all projects for a client
**Access:** Admin or client themselves
**Response:** List of client's projects

**Controller Implementation:**
```typescript
export const getClientProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const projects = await Project.find({ client: clientId })
            .populate('assignedTo', 'firstName lastName email')
            .populate('services', 'title description')
            .sort({ createdAt: 'desc' });

        res.status(200).json({
            success: true,
            data: {
                projects: projects
            }
        });

    } catch (error: any) {
        console.error('Get client projects error:', error);
        next(errorHandler(500, "Server error while fetching client projects"));
    }
};
```

#### `getAssignedProjects()`
**Purpose:** Get projects assigned to current user
**Access:** Authenticated user
**Response:** List of assigned projects

**Controller Implementation:**
```typescript
export const getAssignedProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const projects = await Project.find({ assignedTo: req.user?._id })
            .populate('client', 'firstName lastName email company')
            .populate('services', 'title description')
            .sort({ priority: 'desc', createdAt: 'desc' });

        res.status(200).json({
            success: true,
            data: {
                projects: projects
            }
        });

    } catch (error: any) {
        console.error('Get assigned projects error:', error);
        next(errorHandler(500, "Server error while fetching assigned projects"));
    }
};
```

#### `getProjectStats()`
**Purpose:** Get project statistics
**Access:** Admin users
**Response:**
- Total projects by status
- Total projects by priority
- Team workload
- Completion rate

**Controller Implementation:**
```typescript
export const getProjectStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const total = await Project.countDocuments();
        const pending = await Project.countDocuments({ status: 'pending' });
        const inProgress = await Project.countDocuments({ status: 'in_progress' });
        const onHold = await Project.countDocuments({ status: 'on_hold' });
        const completed = await Project.countDocuments({ status: 'completed' });
        const cancelled = await Project.countDocuments({ status: 'cancelled' });

        const lowPriority = await Project.countDocuments({ priority: 'low' });
        const mediumPriority = await Project.countDocuments({ priority: 'medium' });
        const highPriority = await Project.countDocuments({ priority: 'high' });
        const urgentPriority = await Project.countDocuments({ priority: 'urgent' });

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total,
                    byStatus: {
                        pending,
                        inProgress,
                        onHold,
                        completed,
                        cancelled
                    },
                    byPriority: {
                        low: lowPriority,
                        medium: mediumPriority,
                        high: highPriority,
                        urgent: urgentPriority
                    },
                    completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0
                }
            }
        });

    } catch (error: any) {
        console.error('Get project stats error:', error);
        next(errorHandler(500, "Server error while fetching project statistics"));
    }
};
```

---

## 🛣️ Project Routes

### Base Path: `/api/projects`

```typescript
// Admin Routes
POST   /                          // Create project
GET    /                          // Get all projects (paginated, filtered)
GET    /stats                     // Get project statistics

// Project Management Routes
GET    /:projectId                // Get single project
PUT    /:projectId                // Update project
DELETE /:projectId                // Delete project (super admin)

// Team Assignment Routes
POST   /:projectId/assign         // Assign team members
PATCH  /:projectId/status         // Update status
PATCH  /:projectId/progress       // Update progress

// Milestone Routes
POST   /:projectId/milestones     // Add milestone
PUT    /:projectId/milestones/:milestoneId  // Update milestone
DELETE /:projectId/milestones/:milestoneId  // Delete milestone

// Attachment Routes
POST   /:projectId/attachments    // Upload attachments (multiple files supported, max 10)
DELETE /:projectId/attachments/:attachmentId  // Delete attachment

// Query Routes
GET    /client/:clientId          // Get client projects
GET    /assigned                  // Get assigned projects
```

### Router Implementation

**File: `src/routes/projectRoutes.ts`**

```typescript
import express from 'express';
import {
    createProject,
    getAllProjects,
    getProjectStats,
    getProject,
    updateProject,
    deleteProject,
    assignTeamMembers,
    updateProjectStatus,
    updateProgress,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    uploadAttachment,
    deleteAttachment,
    getClientProjects,
    getAssignedProjects
} from '../controllers/projectController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { uploadProjectAttachment } from '../config/cloudinary';

const router = express.Router();

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private (Admin, Project Manager)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), createProject);

/**
 * @route   GET /api/projects
 * @desc    Get all projects with filtering and pagination
 * @access  Private (Admin, Project Manager)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'project_manager', 'finance']), getAllProjects);

/**
 * @route   GET /api/projects/stats
 * @desc    Get project statistics
 * @access  Private (Admin)
 */
router.get('/stats', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), getProjectStats);

/**
 * @route   GET /api/projects/assigned
 * @desc    Get projects assigned to current user
 * @access  Private
 */
router.get('/assigned', authenticateToken, getAssignedProjects);

/**
 * @route   GET /api/projects/client/:clientId
 * @desc    Get client projects
 * @access  Private (Client or Admin)
 */
router.get('/client/:clientId', authenticateToken, getClientProjects);

/**
 * @route   GET /api/projects/:projectId
 * @desc    Get single project
 * @access  Private (Admin or Assigned Team Member or Client)
 */
router.get('/:projectId', authenticateToken, getProject);

/**
 * @route   PUT /api/projects/:projectId
 * @desc    Update project
 * @access  Private (Admin or Assigned Team Member)
 */
router.put('/:projectId', authenticateToken, updateProject);

/**
 * @route   DELETE /api/projects/:projectId
 * @desc    Delete project
 * @access  Private (Super Admin only)
 */
router.delete('/:projectId', authenticateToken, authorizeRoles(['super_admin']), deleteProject);

/**
 * @route   POST /api/projects/:projectId/assign
 * @desc    Assign team members to project
 * @access  Private (Admin, Project Manager)
 */
router.post('/:projectId/assign', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), assignTeamMembers);

/**
 * @route   PATCH /api/projects/:projectId/status
 * @desc    Update project status
 * @access  Private (Admin or Assigned Team Member)
 */
router.patch('/:projectId/status', authenticateToken, updateProjectStatus);

/**
 * @route   PATCH /api/projects/:projectId/progress
 * @desc    Update project progress
 * @access  Private (Admin or Assigned Team Member)
 */
router.patch('/:projectId/progress', authenticateToken, updateProgress);

/**
 * @route   POST /api/projects/:projectId/milestones
 * @desc    Add project milestone
 * @access  Private (Admin or Assigned Team Member)
 */
router.post('/:projectId/milestones', authenticateToken, addMilestone);

/**
 * @route   PUT /api/projects/:projectId/milestones/:milestoneId
 * @desc    Update milestone
 * @access  Private (Admin or Assigned Team Member)
 */
router.put('/:projectId/milestones/:milestoneId', authenticateToken, updateMilestone);

/**
 * @route   DELETE /api/projects/:projectId/milestones/:milestoneId
 * @desc    Delete milestone
 * @access  Private (Admin or Assigned Team Member)
 */
router.delete('/:projectId/milestones/:milestoneId', authenticateToken, deleteMilestone);

/**
 * @route   POST /api/projects/:projectId/attachments
 * @desc    Upload project attachment
 * @access  Private (Admin or Assigned Team Member)
 */
router.post('/:projectId/attachments', authenticateToken, uploadProjectAttachment.single('file'), uploadAttachment);

/**
 * @route   DELETE /api/projects/:projectId/attachments/:attachmentId
 * @desc    Delete project attachment
 * @access  Private (Admin or Uploader)
 */
router.delete('/:projectId/attachments/:attachmentId', authenticateToken, deleteAttachment);

export default router;
```

### Route Details

#### `POST /api/projects`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "title": "E-commerce Website Development",
  "description": "Build a full-featured e-commerce platform with payment integration",
  "client": "client_id_here",
  "services": ["service_id_1", "service_id_2"],
  "priority": "high",
  "assignedTo": ["user_id_1", "user_id_2"],
  "startDate": "2025-11-01",
  "endDate": "2025-12-31",
  "notes": "Special requirements: Mobile-first design"
}
```

**Note:** `quotation` and `invoice` are **NOT** included in the request body. They are automatically set when quotations/invoices are created for this project.

**Response:**
```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "project": {
      "_id": "...",
      "projectNumber": "PRJ-2025-0001",
      "title": "E-commerce Website Development",
      "description": "Build a full-featured e-commerce platform with payment integration",
      "client": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "company": "Example Corp"
      },
      "status": "pending",
      "priority": "high",
      "progress": 0,
      "assignedTo": [...],
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/projects`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by title or project number
- `status` (optional): Filter by status (pending, in_progress, on_hold, completed, cancelled)
- `priority` (optional): Filter by priority (low, medium, high, urgent)
- `client` (optional): Filter by client ID

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalProjects": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/projects/stats`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 100,
      "byStatus": {
        "pending": 20,
        "inProgress": 45,
        "onHold": 5,
        "completed": 25,
        "cancelled": 5
      },
      "byPriority": {
        "low": 10,
        "medium": 40,
        "high": 35,
        "urgent": 15
      },
      "completionRate": "25.00"
    }
  }
}
```

#### `GET /api/projects/assigned`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "_id": "...",
        "projectNumber": "PRJ-2025-0001",
        "title": "E-commerce Website Development",
        "client": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "status": "in_progress",
        "priority": "high",
        "progress": 65
      }
    ]
  }
}
```

#### `GET /api/projects/client/:clientId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `clientId` - The client ID

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "_id": "...",
        "projectNumber": "PRJ-2025-0001",
        "title": "E-commerce Website Development",
        "status": "in_progress",
        "progress": 65,
        "assignedTo": [...],
        "services": [...]
      }
    ]
  }
}
```

#### `GET /api/projects/:projectId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `projectId` - The project ID

**Response:**
```json
{
  "success": true,
  "data": {
    "project": {
      "_id": "...",
      "projectNumber": "PRJ-2025-0001",
      "title": "E-commerce Website Development",
      "description": "Full project description",
      "client": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "+254712345678"
      },
      "quotation": {...},
      "invoice": {...},
      "services": [...],
      "status": "in_progress",
      "priority": "high",
      "assignedTo": [...],
      "progress": 65,
      "milestones": [...],
      "attachments": [...],
      "startDate": "2025-11-01",
      "endDate": "2025-12-31",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `PUT /api/projects/:projectId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `projectId` - The project ID

**Body:**
```json
{
  "title": "Updated Project Title",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "urgent",
  "startDate": "2025-11-01",
  "endDate": "2025-12-31",
  "notes": "Updated notes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project updated successfully",
  "data": {
    "project": {
      "_id": "...",
      "title": "Updated Project Title",
      "status": "in_progress",
      ...
    }
  }
}
```

#### `DELETE /api/projects/:projectId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**URL Parameter:** `projectId` - The project ID

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

#### `POST /api/projects/:projectId/assign`
**Headers:** `Authorization: Bearer <admin_token>`

**URL Parameter:** `projectId` - The project ID

**Body:**
```json
{
  "userIds": ["user_id_1", "user_id_2", "user_id_3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Team members assigned successfully",
  "data": {
    "project": {
      "_id": "...",
      "assignedTo": [
        {
          "_id": "user_id_1",
          "firstName": "Jane",
          "lastName": "Smith",
          "email": "jane@example.com",
          "avatar": "https://..."
        }
      ]
    }
  }
}
```

#### `PATCH /api/projects/:projectId/status`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `projectId` - The project ID

**Body:**
```json
{
  "status": "in_progress"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project status updated successfully",
  "data": {
    "project": {
      "_id": "...",
      "status": "in_progress",
      ...
    }
  }
}
```

#### `PATCH /api/projects/:projectId/progress`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `projectId` - The project ID

**Body:**
```json
{
  "progress": 75
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project progress updated successfully",
  "data": {
    "project": {
      "_id": "...",
      "progress": 75,
      "status": "in_progress",
      ...
    }
  }
}
```

#### `POST /api/projects/:projectId/milestones`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `projectId` - The project ID

**Body:**
```json
{
  "title": "Frontend Development Complete",
  "description": "Complete all frontend pages and components",
  "dueDate": "2025-11-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Milestone added successfully",
  "data": {
    "project": {
      "_id": "...",
      "milestones": [
        {
          "_id": "...",
          "title": "Frontend Development Complete",
          "description": "Complete all frontend pages and components",
          "dueDate": "2025-11-15T00:00:00.000Z",
          "status": "pending"
        }
      ]
    }
  }
}
```

#### `PUT /api/projects/:projectId/milestones/:milestoneId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameters:** 
- `projectId` - The project ID
- `milestoneId` - The milestone ID

**Body:**
```json
{
  "title": "Updated Milestone Title",
  "description": "Updated description",
  "dueDate": "2025-11-20",
  "status": "completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Milestone updated successfully",
  "data": {
    "project": {
      "_id": "...",
      "milestones": [...]
    }
  }
}
```

#### `DELETE /api/projects/:projectId/milestones/:milestoneId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameters:** 
- `projectId` - The project ID
- `milestoneId` - The milestone ID

**Response:**
```json
{
  "success": true,
  "message": "Milestone deleted successfully"
}
```

#### `POST /api/projects/:projectId/attachments`
**Headers:** `Authorization: Bearer <token>`

**URL Parameter:** `projectId` - The project ID

**Body:** `multipart/form-data`
- `files`: Array of files to upload (maximum 10 files per request)
- Supported file types: Images (jpg, jpeg, png, gif, webp) and Documents (pdf, doc, docx, txt)
- Maximum file size: 10MB per file

**Note:** You can upload multiple files in a single request. The field name must be `files` (plural).

**Response:**
```json
{
  "success": true,
  "message": "3 attachments uploaded successfully",
  "data": {
    "attachments": [
      {
        "name": "document.pdf",
        "url": "https://cloudinary.com/...",
        "uploadedBy": "...",
        "uploadedAt": "2025-01-01T00:00:00.000Z"
      },
      {
        "name": "image.jpg",
        "url": "https://cloudinary.com/...",
        "uploadedBy": "...",
        "uploadedAt": "2025-01-01T00:00:00.000Z"
      },
      {
        "name": "screenshot.png",
        "url": "https://cloudinary.com/...",
        "uploadedBy": "...",
        "uploadedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "uploadedCount": 3,
    "failedCount": 0
  }
}
```

**Single File Upload Response:**
```json
{
  "success": true,
  "message": "Attachment uploaded successfully",
  "data": {
    "attachments": [
      {
      "name": "document.pdf",
      "url": "https://cloudinary.com/...",
        "uploadedBy": "...",
        "uploadedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "uploadedCount": 1,
    "failedCount": 0
  }
}
```

**Partial Failure Response:**
```json
{
  "success": true,
  "message": "2 attachments uploaded successfully. 1 file(s) failed to upload: large-file.pdf",
  "data": {
    "attachments": [
      {
        "name": "document1.pdf",
        "url": "https://cloudinary.com/...",
        "uploadedBy": "...",
        "uploadedAt": "2025-01-01T00:00:00.000Z"
      },
      {
        "name": "document2.pdf",
        "url": "https://cloudinary.com/...",
        "uploadedBy": "...",
      "uploadedAt": "2025-01-01T00:00:00.000Z"
    }
    ],
    "uploadedCount": 2,
    "failedCount": 1
  }
}
```

#### `DELETE /api/projects/:projectId/attachments/:attachmentId`
**Headers:** `Authorization: Bearer <token>`

**URL Parameters:** 
- `projectId` - The project ID
- `attachmentId` - The attachment ID

**Response:**
```json
{
  "success": true,
  "message": "Attachment deleted successfully"
}
```

---

## 📝 API Examples

### Create Project
```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "title": "E-commerce Website Development",
    "description": "Build a full-featured e-commerce platform",
    "client": "client_id_here",
    "services": ["service_id_1", "service_id_2"],
    "priority": "high",
    "startDate": "2025-11-01",
    "endDate": "2025-12-31",
    "assignedTo": ["user_id_1", "user_id_2"]
  }'
```

### Get All Projects
```bash
curl -X GET "http://localhost:5000/api/projects?page=1&limit=10&status=in_progress&priority=high" \
  -H "Authorization: Bearer <admin_token>"
```

### Update Project Status
```bash
curl -X PATCH http://localhost:5000/api/projects/<projectId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "status": "in_progress"
  }'
```

### Add Milestone
```bash
curl -X POST http://localhost:5000/api/projects/<projectId>/milestones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Frontend Development Complete",
    "description": "Complete all frontend pages",
    "dueDate": "2025-11-15"
  }'
```

### Upload Attachment (Single File)
```bash
curl -X POST http://localhost:5000/api/projects/<projectId>/attachments \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/document.pdf"
```

### Upload Multiple Attachments
```bash
curl -X POST http://localhost:5000/api/projects/<projectId>/attachments \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/document1.pdf" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/screenshot.png"
```

**Note:** The field name must be `files` (plural) to upload multiple files. Maximum 10 files per request.

---

## 🔒 Security Features

### Access Control
- **Role-Based Access** - Admin and project manager can create/delete
- **Team Member Access** - Assigned users can update progress
- **Client Access** - Clients can view their projects
- **Resource Validation** - Verify project ownership/assignment

### Data Protection
- **Field Restrictions** - Cannot change client or project number
- **File Upload Limits** - 10MB max file size
- **Sanitized Responses** - Exclude sensitive data
- **Audit Trail** - Track all changes with createdBy

### Input Validation
- **Required Fields** - Title, description, client validation
- **Status Validation** - Enum validation for status and priority
- **Progress Range** - 0-100 validation
- **Date Validation** - End date after start date

---

## 🚨 Error Handling

### Common Errors
```json
// 404 - Project Not Found
{
  "success": false,
  "message": "Project not found"
}

// 403 - Access Denied
{
  "success": false,
  "message": "You are not assigned to this project"
}

// 400 - Invalid Progress
{
  "success": false,
  "message": "Progress must be between 0 and 100"
}
```

---

## 🔗 Integration with Other Modules

### Client Integration
- Projects linked to client records
- Client can view their projects
- Auto-populate client details

### Quotation Integration
- **Quotation created from project** - Project must exist before quotation
- **Automatic linking** - Project's `quotation` field is automatically updated when quotation is created
- **Data inheritance** - Quotation inherits client from project
- **Workflow:** Project → Quotation → Invoice

### Invoice Integration
- Link invoice to project
- Track project billing
- Payment status visibility

### Service Integration
- Multiple services per project
- Service details populated
- Track service delivery

### Team Management
- Assign multiple users
- Track team workload
- User notifications

### Notification Integration

The Project system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **Project Created** (`createProject`)
   - **Recipients:** Client and Assigned Team Members
   - **Category:** `project`
   - **Subject:** "New Project Created"
   - **Message:** Includes project title and details
   - **Metadata:** `projectId`, `projectNumber`, `title`, `priority`

2. **Team Members Assigned** (`assignTeamMembers`)
   - **Recipient:** Newly Assigned Team Members
   - **Category:** `project`
   - **Subject:** "Assigned to Project"
   - **Type:** **Bidirectional Notification** with actions
   - **Actions:**
     - **"View Project"** button (Navigate action) - Opens project details
   - **Metadata:** `projectId`, `projectNumber`, `title`, `priority`

3. **Project Status Updated** (`updateProjectStatus`)
   - **Recipients:** Client and Assigned Team Members
   - **Category:** `project`
   - **Subject:** "Project Status Updated"
   - **Type:** **Bidirectional Notification** (for client) with actions
   - **Actions (Client):**
     - **"View Project"** button (Navigate action) - Opens project details
   - **Metadata:** `projectId`, `projectNumber`, `title`, `oldStatus`, `newStatus`

4. **Project Progress Updated** (`updateProgress`)
   - **Recipient:** Client (only for milestone percentages: 25%, 50%, 75%, 100%)
   - **Category:** `project`
   - **Subject:** "Project Progress Updated"
   - **Message:** Includes progress percentage (only for milestones: 25%, 50%, 75%, 100%)
   - **Metadata:** `projectId`, `projectNumber`, `title`, `progress`, `status`

5. **Milestone Added** (`addMilestone`)
   - **Recipients:** Client and Assigned Team Members
   - **Category:** `project`
   - **Subject:** "New Milestone Added"
   - **Message:** Includes milestone title and due date
   - **Metadata:** `projectId`, `projectNumber`, `milestoneTitle`, `dueDate`

6. **Milestone Updated** (`updateMilestone`)
   - **Recipients:** Client and Assigned Team Members
   - **Category:** `project`
   - **Subject:** "Milestone Updated"
   - **Message:** Includes milestone title and status change
   - **Metadata:** `projectId`, `projectNumber`, `milestoneTitle`, `status`

7. **Project Attachment Uploaded** (`uploadAttachment`)
   - **Recipient:** Client
   - **Category:** `project`
   - **Subject:** "New Project Attachment"
   - **Message:** Includes file name and project details
   - **Metadata:** `projectId`, `projectNumber`, `fileName`, `uploadedBy`

#### Notification Preferences

All notifications respect user/client notification preferences:
- If `inApp` preference is `false`, notifications are skipped
- Default behavior: Notifications are sent unless explicitly disabled

### Real-time Updates
- Socket.io events (`project_created`, `status_updated`)
- Live status change alerts
- Progress updates (milestone percentages)
- New milestone notifications

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
