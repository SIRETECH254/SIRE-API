import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Testimonial from '../models/Testimonial';
import Client from '../models/Client';
import Project from '../models/Project';
import { createInAppNotification } from '../utils/notificationHelper';

// @desc    Create testimonial (Client only)
// @route   POST /api/testimonials
// @access  Private (Client)
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

        const client = await Client.findById(clientId);
        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Validate project if provided
        if (project) {
            const projectExists = await Project.findById(project);
            if (!projectExists) {
                return next(errorHandler(404, "Project not found"));
            }

            // Verify client owns the project
            if (projectExists.client.toString() !== clientId.toString()) {
                return next(errorHandler(403, "You can only submit testimonials for your own projects"));
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

        // Send notification to admins
        try {
            const User = await import('../models/User').then(m => m.default);
            const admins = await User.find({ 
                role: { $in: ['super_admin', 'finance', 'project_manager'] },
                isActive: true 
            });

            const notificationPromises = admins.map(admin => 
                createInAppNotification({
                    recipient: admin._id.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'New Testimonial Submitted',
                    message: `A new testimonial has been submitted by ${client.firstName} ${client.lastName}. Please review and approve.`,
                    metadata: {
                        testimonialId: testimonial._id,
                        clientId: client._id,
                        rating: rating
                    },
                    io: (req.app as any).get('io')
                })
            );

            await Promise.all(notificationPromises);
        } catch (notificationError) {
            console.error('Error sending notifications:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            message: "Testimonial submitted successfully. It will be reviewed by an admin before publishing.",
            data: {
                testimonial: {
                    id: testimonial._id,
                    client: testimonial.client,
                    project: testimonial.project,
                    rating: testimonial.rating,
                    message: testimonial.message,
                    isApproved: testimonial.isApproved,
                    isPublished: testimonial.isPublished,
                    createdAt: testimonial.createdAt
                }
            }
        });

    } catch (error: any) {
        console.error('Create testimonial error:', error);
        next(errorHandler(500, "Server error while creating testimonial"));
    }
};

// @desc    Get all testimonials (Admin only)
// @route   GET /api/testimonials
// @access  Private (Admin)
export const getAllTestimonials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;

        const query: any = {};

        // Filter by approval/publishing status
        if (status === 'approved') {
            query.isApproved = true;
        } else if (status === 'unapproved') {
            query.isApproved = false;
        } else if (status === 'published') {
            query.isPublished = true;
        } else if (status === 'unpublished') {
            query.isPublished = false;
        }

        // Search by message or client name
        if (search) {
            query.$or = [
                { message: { $regex: search, $options: 'i' } }
            ];
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

// @desc    Get published testimonials (Public)
// @route   GET /api/testimonials/published
// @access  Public
export const getPublishedTestimonials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const testimonials = await Testimonial.find({
            isApproved: true,
            isPublished: true
        })
            .populate('client', 'firstName lastName email company')
            .populate('project', 'title projectNumber')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Testimonial.countDocuments({
            isApproved: true,
            isPublished: true
        });

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

// @desc    Get single testimonial
// @route   GET /api/testimonials/:id
// @access  Private (Admin or Client owner)
export const getTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id)
            .populate('client', 'firstName lastName email company')
            .populate('project', 'title projectNumber')
            .populate('approvedBy', 'firstName lastName email');

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        // Check if user is admin or owns the testimonial
        const isAdmin = req.user?.role && ['super_admin', 'finance', 'project_manager'].includes(req.user.role);
        const isOwner = testimonial.client.toString() === req.user?._id?.toString();

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "Access denied"));
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

// @desc    Update testimonial
// @route   PUT /api/testimonials/:id
// @access  Private (Client owner or Admin)
export const updateTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { rating, message }: {
            rating?: number;
            message?: string;
        } = req.body;

        const testimonial = await Testimonial.findById(id);

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        // Check if user is admin or owns the testimonial
        const isAdmin = req.user?.role && ['super_admin', 'finance', 'project_manager'].includes(req.user.role);
        const isOwner = testimonial.client.toString() === req.user?._id?.toString();

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "Access denied"));
        }

        // If approved/published, only admin can update
        if ((testimonial.isApproved || testimonial.isPublished) && !isAdmin) {
            return next(errorHandler(403, "Cannot update approved or published testimonials"));
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

        // If updated by client after approval, reset approval status
        if (isOwner && testimonial.isApproved) {
            testimonial.isApproved = false;
            testimonial.isPublished = false;
            testimonial.approvedBy = undefined as any;
            testimonial.approvedAt = undefined as any;
        }

        await testimonial.save();

        await testimonial.populate('client', 'firstName lastName email');
        await testimonial.populate('project', 'title projectNumber');

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

// @desc    Delete testimonial
// @route   DELETE /api/testimonials/:id
// @access  Private (Client owner or Admin)
export const deleteTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id);

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        // Check if user is admin or owns the testimonial
        const isAdmin = req.user?.role && ['super_admin', 'finance', 'project_manager'].includes(req.user.role);
        const isOwner = testimonial.client.toString() === req.user?._id?.toString();

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "Access denied"));
        }

        await Testimonial.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Testimonial deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete testimonial error:', error);
        next(errorHandler(500, "Server error while deleting testimonial"));
    }
};

// @desc    Approve testimonial (Admin only)
// @route   POST /api/testimonials/:id/approve
// @access  Private (Admin)
export const approveTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id)
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
                recipient: (testimonial.client as any)._id.toString(),
                recipientModel: 'Client',
                category: 'general',
                subject: 'Testimonial Approved',
                message: 'Your testimonial has been approved by an admin. It will be published soon.',
                metadata: {
                    testimonialId: testimonial._id,
                    approvedBy: req.user?._id
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        await testimonial.populate('approvedBy', 'firstName lastName email');
        await testimonial.populate('project', 'title projectNumber');

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

// @desc    Publish testimonial (Admin only)
// @route   POST /api/testimonials/:id/publish
// @access  Private (Admin)
export const publishTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id)
            .populate('client', 'firstName lastName email');

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        if (!testimonial.isApproved) {
            return next(errorHandler(400, "Testimonial must be approved before publishing"));
        }

        if (testimonial.isPublished) {
            return next(errorHandler(400, "Testimonial is already published"));
        }

        testimonial.isPublished = true;
        await testimonial.save();

        // Send notification to client
        try {
            await createInAppNotification({
                recipient: (testimonial.client as any)._id.toString(),
                recipientModel: 'Client',
                category: 'general',
                subject: 'Testimonial Published',
                message: 'Your testimonial has been published and is now visible on our website.',
                metadata: {
                    testimonialId: testimonial._id
                },
                io: (req.app as any).get('io')
            });
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the request if notification fails
        }

        await testimonial.populate('approvedBy', 'firstName lastName email');
        await testimonial.populate('project', 'title projectNumber');

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

// @desc    Unpublish testimonial (Admin only)
// @route   POST /api/testimonials/:id/unpublish
// @access  Private (Admin)
export const unpublishTestimonial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const testimonial = await Testimonial.findById(id);

        if (!testimonial) {
            return next(errorHandler(404, "Testimonial not found"));
        }

        if (!testimonial.isPublished) {
            return next(errorHandler(400, "Testimonial is not published"));
        }

        testimonial.isPublished = false;
        await testimonial.save();

        await testimonial.populate('client', 'firstName lastName email');
        await testimonial.populate('project', 'title projectNumber');
        await testimonial.populate('approvedBy', 'firstName lastName email');

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

