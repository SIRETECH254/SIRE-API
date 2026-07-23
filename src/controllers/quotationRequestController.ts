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
