import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Service from '../models/Service';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Admin)
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { title, description, features, icon }: {
            title: string;
            description: string;
            features: string[];
            icon?: string;
        } = req.body;

        // Validation
        if (!title || !description || !features || features.length === 0) {
            return next(errorHandler(400, "Title, description, and features are required"));
        }

        // Check if service with same title exists
        const existingService = await Service.findOne({ title });
        if (existingService) {
            return next(errorHandler(400, "Service with this title already exists"));
        }

        // Create service
        const service = new Service({
            title,
            description,
            features,
            icon,
            createdBy: req.user?._id
        });

        await service.save();

        // Populate creator
        await service.populate('createdBy', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: "Service created successfully",
            data: {
                service: service
            }
        });

    } catch (error: any) {
        console.error('Create service error:', error);
        next(errorHandler(500, "Server error while creating service"));
    }
};

// @desc    Get all services
// @route   GET /api/services
// @access  Private (Admin)
export const getAllServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;

        const query: any = {};

        // Search by title or description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const services = await Service.find(query)
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Service.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                services: services,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalServices: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get all services error:', error);
        next(errorHandler(500, "Server error while fetching services"));
    }
};

// @desc    Get active services
// @route   GET /api/services/active
// @access  Public
export const getActiveServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const services = await Service.find({ isActive: true })
            .select('-createdBy')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                services: services,
                count: services.length
            }
        });

    } catch (error: any) {
        console.error('Get active services error:', error);
        next(errorHandler(500, "Server error while fetching active services"));
    }
};

// @desc    Get single service
// @route   GET /api/services/:serviceId
// @access  Public
export const getService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params;

        const service = await Service.findById(serviceId)
            .populate('createdBy', 'firstName lastName email');

        if (!service) {
            return next(errorHandler(404, "Service not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                service: service
            }
        });

    } catch (error: any) {
        console.error('Get service error:', error);
        next(errorHandler(500, "Server error while fetching service"));
    }
};

// @desc    Update service
// @route   PUT /api/services/:serviceId
// @access  Private (Admin)
export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params;
        const { title, description, features, icon }: {
            title?: string;
            description?: string;
            features?: string[];
            icon?: string;
        } = req.body;

        const service = await Service.findById(serviceId);

        if (!service) {
            return next(errorHandler(404, "Service not found"));
        }

        // Update allowed fields
        if (title) service.title = title;
        if (description) service.description = description;
        if (features) service.features = features;
        if (icon) service.icon = icon;

        await service.save();

        res.status(200).json({
            success: true,
            message: "Service updated successfully",
            data: {
                service: service
            }
        });

    } catch (error: any) {
        console.error('Update service error:', error);
        next(errorHandler(500, "Server error while updating service"));
    }
};

// @desc    Delete service
// @route   DELETE /api/services/:serviceId
// @access  Private (Super Admin)
export const deleteService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params;

        const service = await Service.findById(serviceId);

        if (!service) {
            return next(errorHandler(404, "Service not found"));
        }

        // Optional: Check if service is used in quotations or projects
        // You might want to prevent deletion or implement cascade delete

        await Service.findByIdAndDelete(serviceId);

        res.status(200).json({
            success: true,
            message: "Service deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete service error:', error);
        next(errorHandler(500, "Server error while deleting service"));
    }
};

// @desc    Toggle service status
// @route   PATCH /api/services/:serviceId/toggle-status
// @access  Private (Admin)
export const toggleServiceStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params;

        const service = await Service.findById(serviceId);

        if (!service) {
            return next(errorHandler(404, "Service not found"));
        }

        // Toggle active status
        service.isActive = !service.isActive;
        await service.save();

        res.status(200).json({
            success: true,
            message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                service: service
            }
        });

    } catch (error: any) {
        console.error('Toggle service status error:', error);
        next(errorHandler(500, "Server error while toggling service status"));
    }
};

// @desc    Upload service icon
// @route   POST /api/services/:serviceId/icon
// @access  Private (Admin)
export const uploadServiceIcon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params;

        if (!req.file) {
            return next(errorHandler(400, "No file uploaded"));
        }

        const service = await Service.findById(serviceId);

        if (!service) {
            return next(errorHandler(404, "Service not found"));
        }

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/service-icons');

        // Delete old icon if exists
        if (service.icon) {
            // Extract public_id from URL and delete
            // await deleteFromCloudinary(oldPublicId);
        }

        service.icon = uploadResult.url;
        await service.save();

        res.status(200).json({
            success: true,
            message: "Service icon uploaded successfully",
            data: {
                service: service
            }
        });

    } catch (error: any) {
        console.error('Upload service icon error:', error);
        next(errorHandler(500, "Server error while uploading icon"));
    }
};

