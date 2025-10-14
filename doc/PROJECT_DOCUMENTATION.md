
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
  client: ObjectId;              // Reference to Client
  quotation?: ObjectId;          // Reference to Quotation
  invoice?: ObjectId;            // Reference to Invoice
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
client: { required: true, ref: 'Client' }
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
- Emit Socket.io event for real-time update
**Response:** Complete project data

**Controller Implementation:**
```typescript
export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { title, description, client, quotation, invoice, services, priority, assignedTo, startDate, endDate, notes }: {
            title: string;
            description: string;
            client: string;
            quotation?: string;
            invoice?: string;
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
        const clientExists = await Client.findById(client);
        if (!clientExists) {
            return next(errorHandler(404, "Client not found"));
        }

        // Create project
        const project = new Project({
            title,
            description,
            client,
            quotation,
            invoice,
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

        // Emit Socket.io event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('project_created', {
                projectId: project._id,
                title: project.title,
                client: project.client
            });
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
**Response:** Updated project with team

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

        project.assignedTo = userIds;
        await project.save();

        await project.populate('assignedTo', 'firstName lastName email avatar');

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
- Emit Socket.io event
**Response:** Updated project

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
**Response:** Updated project

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
**Response:** Updated project with new milestone

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
**Response:** Updated milestone

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

#### `uploadAttachment(projectId, file)`
**Purpose:** Upload project attachment
**Access:** Admin or assigned team member
**Process:**
- Upload to Cloudinary
- Store file metadata
- Track uploader
**Response:** Attachment details

**Controller Implementation:**
```typescript
export const uploadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId } = req.params;

        if (!req.file) {
            return next(errorHandler(400, "No file uploaded"));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/project-attachments');

        project.attachments.push({
            name: req.file.originalname,
            url: uploadResult.url,
            uploadedBy: req.user?._id as any,
            uploadedAt: new Date()
        } as any);

        await project.save();

        res.status(201).json({
            success: true,
            message: "Attachment uploaded successfully",
            data: {
                attachment: project.attachments[project.attachments.length - 1]
            }
        });

    } catch (error: any) {
        console.error('Upload attachment error:', error);
        next(errorHandler(500, "Server error while uploading attachment"));
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
POST   /:projectId/attachments    // Upload attachment
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

### Upload Attachment
```bash
curl -X POST http://localhost:5000/api/projects/<projectId>/attachments \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf"
```

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
- Convert quotation to project
- Link quotation for reference
- Inherit services from quotation

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

### Real-time Updates
- Socket.io notifications
- Status change alerts
- Progress updates
- New milestone notifications

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
