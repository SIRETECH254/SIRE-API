import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { errorHandler } from '../middleware/errorHandler';
import Project from '../models/Project';
import Client from '../models/Client';
import User from '../models/User';
import Service from '../models/Service';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { createInAppNotification } from '../utils/notificationHelper';

// @desc    Create new project
// @route   POST /api/projects
// @access  Private (Admin, Project Manager)
export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { title, description, client, services, priority, assignedTo, startDate, endDate, notes }: {
            title: string;
            description: string;
            client: string;
            services?: string[];
            priority?: 'low' | 'medium' | 'high' | 'urgent';
            assignedTo?: string[];
            startDate?: string | Date;
            endDate?: string | Date;
            notes?: string;
        } = req.body;

        // Validation
        if (!title || !description || !client) {
            return next(errorHandler(400, "Title, description, and client are required"));
        }

        // Validate createdBy exists
        if (!req.user?._id) {
            return next(errorHandler(401, "User authentication required"));
        }

        // Check if client exists
        const clientExists = await Client.findById(client);
        if (!clientExists) {
            return next(errorHandler(404, "Client not found"));
        }

        // Validate assignedTo users exist
        if (assignedTo && assignedTo.length > 0) {
            const usersExist = await User.find({ _id: { $in: assignedTo } });
            if (usersExist.length !== assignedTo.length) {
                return next(errorHandler(404, "One or more assigned users not found"));
            }
        }

        // Validate services exist
        if (services && services.length > 0) {
            const servicesExist = await Service.find({ _id: { $in: services } });
            if (servicesExist.length !== services.length) {
                return next(errorHandler(404, "One or more services not found"));
            }
        }

        // Parse dates if provided as strings
        let parsedStartDate: Date | undefined;
        let parsedEndDate: Date | undefined;
        
        if (startDate) {
            parsedStartDate = typeof startDate === 'string' ? new Date(startDate) : startDate;
            if (isNaN(parsedStartDate.getTime())) {
                return next(errorHandler(400, "Invalid startDate format"));
            }
        }
        
        if (endDate) {
            parsedEndDate = typeof endDate === 'string' ? new Date(endDate) : endDate;
            if (isNaN(parsedEndDate.getTime())) {
                return next(errorHandler(400, "Invalid endDate format"));
            }
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
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            notes,
            createdBy: req.user._id
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

        // Send notifications to client and assigned team members
        try {
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
                io: (req.app as any).get('io')
            });

            // For Assigned Team Members (if any)
            if (project.assignedTo && (project.assignedTo as any).length > 0) {
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
                        io: (req.app as any).get('io')
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
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map((err: any) => err.message).join(', ');
            return next(errorHandler(400, `Validation error: ${errors}`));
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            return next(errorHandler(409, "Project with this number already exists"));
        }
        
        // Handle cast errors (invalid ObjectId)
        if (error.name === 'CastError') {
            return next(errorHandler(400, `Invalid ID format: ${error.message}`));
        }
        
        // Return specific error message if available
        const errorMessage = error.message || "Server error while creating project";
        next(errorHandler(500, errorMessage));
    }
};

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private (Admin)
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

// @desc    Get single project
// @route   GET /api/projects/:projectId
// @access  Private
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

// @desc    Update project
// @route   PUT /api/projects/:projectId
// @access  Private (Admin or Assigned Team Member)
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

// @desc    Delete project
// @route   DELETE /api/projects/:projectId
// @access  Private (Super Admin)
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

// @desc    Assign team members
// @route   POST /api/projects/:projectId/assign
// @access  Private (Admin, Project Manager)
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
                    io: (req.app as any).get('io')
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

// @desc    Update project status
// @route   PATCH /api/projects/:projectId/status
// @access  Private (Admin or Assigned Team Member)
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
                    oldStatus: 'previous',
                    newStatus: project.status
                },
                io: (req.app as any).get('io')
            });

            // For Assigned Team Members
            if (project.assignedTo && (project.assignedTo as any).length > 0) {
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
                        io: (req.app as any).get('io')
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

// @desc    Update project progress
// @route   PATCH /api/projects/:projectId/progress
// @access  Private (Admin or Assigned Team Member)
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
                    io: (req.app as any).get('io')
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

// @desc    Add milestone
// @route   POST /api/projects/:projectId/milestones
// @access  Private (Admin or Assigned Team Member)
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
                io: (req.app as any).get('io')
            });

            // For Assigned Team Members
            if (project.assignedTo && (project.assignedTo as any).length > 0) {
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
                        io: (req.app as any).get('io')
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

// @desc    Update milestone
// @route   PUT /api/projects/:projectId/milestones/:milestoneId
// @access  Private (Admin or Assigned Team Member)
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

        const milestone = project.milestones.find((m: any) => m._id?.toString() === milestoneId);

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
                recipientModel: 'Client',
                category: 'project',
                subject: 'Milestone Updated',
                message: `Milestone "${(milestone as any).title}" in project "${project.title}" has been marked as ${(milestone as any).status}`,
                metadata: {
                    projectId: project._id,
                    projectNumber: project.projectNumber,
                    milestoneTitle: (milestone as any).title,
                    status: (milestone as any).status
                },
                io: (req.app as any).get('io')
            });

            // For Assigned Team Members
            if (project.assignedTo && (project.assignedTo as any).length > 0) {
                for (const userId of project.assignedTo) {
                    await createInAppNotification({
                        recipient: userId.toString(),
                        recipientModel: 'User',
                        category: 'project',
                        subject: 'Milestone Updated',
                        message: `Milestone "${(milestone as any).title}" in project "${project.title}" has been marked as ${(milestone as any).status}`,
                        metadata: {
                            projectId: project._id,
                            projectNumber: project.projectNumber,
                            milestoneTitle: (milestone as any).title,
                            status: (milestone as any).status
                        },
                        io: (req.app as any).get('io')
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

// @desc    Delete milestone
// @route   DELETE /api/projects/:projectId/milestones/:milestoneId
// @access  Private (Admin or Assigned Team Member)
export const deleteMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId, milestoneId } = req.params;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.milestones = project.milestones.filter((m: any) => m._id?.toString() !== milestoneId);
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

// @desc    Upload attachment
// @route   POST /api/projects/:projectId/attachments
// @access  Private (Admin or Assigned Team Member)
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
                    recipientModel: 'Client',
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

// @desc    Delete attachment
// @route   DELETE /api/projects/:projectId/attachments/:attachmentId
// @access  Private (Admin or Uploader)
export const deleteAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { projectId, attachmentId } = req.params;

        const project = await Project.findById(projectId);

        if (!project) {
            return next(errorHandler(404, "Project not found"));
        }

        project.attachments = project.attachments.filter((a: any) => a._id?.toString() !== attachmentId);
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

// @desc    Get client projects
// @route   GET /api/projects/client/:clientId
// @access  Private (Client or Admin)
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

// @desc    Get assigned projects
// @route   GET /api/projects/assigned
// @access  Private
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

// @desc    Get project statistics
// @route   GET /api/projects/stats
// @access  Private (Admin)
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

