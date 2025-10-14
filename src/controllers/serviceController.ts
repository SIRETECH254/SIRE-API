import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Service from '../models/Service';

export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { title, description, category, basePrice, features, icon }: {
            title: string;
            description: string;
            category?: string;
            basePrice?: number;
            features?: string[];
            icon?: string;
        } = req.body;

        if (!title || !description) {
            return next(errorHandler(400, "Title and description are required"));
        }

        const service = await Service.create({
            title,
            description,
            category,
            basePrice,
            features: features || [],
            icon,
            createdBy: (req as any).user?._id
        });

        res.status(201).json({ success: true, message: "Service created successfully", data: { service } });

    } catch (error: any) {
        console.error('Create service error:', error);
        next(errorHandler(500, "Server error while creating service"));
    }
};

export const getAllServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, category, status } = req.query as any;

        const query: any = {};
        if (search) query.title = { $regex: search, $options: 'i' };
        if (category) query.category = category;
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        const options = { page: parseInt(page), limit: parseInt(limit) };

        const services = await Service.find(query)
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Service.countDocuments(query);

        res.status(200).json({ success: true, data: {
            services,
            pagination: {
                currentPage: options.page,
                totalPages: Math.ceil(total / options.limit),
                totalServices: total,
                hasNextPage: options.page < Math.ceil(total / options.limit),
                hasPrevPage: options.page > 1
            }
        }});

    } catch (error: any) {
        console.error('Get all services error:', error);
        next(errorHandler(500, "Server error while fetching services"));
    }
};

export const getActiveServices = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const services = await Service.find({ isActive: true }).sort({ createdAt: 'desc' });
        res.status(200).json({ success: true, data: { services } });
    } catch (error: any) {
        console.error('Get active services error:', error);
        next(errorHandler(500, "Server error while fetching active services"));
    }
};

export const getService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params as any;
        const service = await Service.findById(serviceId);
        if (!service) return next(errorHandler(404, "Service not found"));
        res.status(200).json({ success: true, data: { service } });
    } catch (error: any) {
        console.error('Get service error:', error);
        next(errorHandler(500, "Server error while fetching service"));
    }
};

export const updateService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params as any;
        const { title, description, category, basePrice, features, icon, isActive } = req.body as any;

        const service = await Service.findById(serviceId);
        if (!service) return next(errorHandler(404, "Service not found"));

        if (title) service.title = title;
        if (description) service.description = description;
        if (category) service.category = category;
        if (basePrice !== undefined) service.basePrice = basePrice;
        if (Array.isArray(features)) service.features = features;
        if (icon) service.icon = icon;
        if (typeof isActive === 'boolean') service.isActive = isActive;

        await service.save();

        res.status(200).json({ success: true, message: "Service updated successfully", data: { service } });
    } catch (error: any) {
        console.error('Update service error:', error);
        next(errorHandler(500, "Server error while updating service"));
    }
};

export const deleteService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params as any;
        const service = await Service.findById(serviceId);
        if (!service) return next(errorHandler(404, "Service not found"));

        await Service.findByIdAndDelete(serviceId);

        res.status(200).json({ success: true, message: "Service deleted successfully" });
    } catch (error: any) {
        console.error('Delete service error:', error);
        next(errorHandler(500, "Server error while deleting service"));
    }
};

export const toggleServiceStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params as any;
        const service = await Service.findById(serviceId);
        if (!service) return next(errorHandler(404, "Service not found"));
        service.isActive = !service.isActive;
        await service.save();
        res.status(200).json({ success: true, message: "Service status updated", data: { service } });
    } catch (error: any) {
        console.error('Toggle service status error:', error);
        next(errorHandler(500, "Server error while toggling service status"));
    }
};

export const uploadServiceIcon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { serviceId } = req.params as any;
        const service = await Service.findById(serviceId);
        if (!service) return next(errorHandler(404, "Service not found"));

        if (!req.file) return next(errorHandler(400, "Icon file is required"));

        // Multer + Cloudinary middleware already stores the file and sets path on req.file.path
        // The configured storage returns the Cloudinary URL at req.file.path or req.file.filename
        // We'll store the secure URL (cloudinary middleware typically sets file.path to URL)
        service.icon = (req.file as any).path || service.icon;
        await service.save();

        res.status(200).json({ success: true, message: "Service icon uploaded", data: { service } });
    } catch (error: any) {
        console.error('Upload service icon error:', error);
        next(errorHandler(500, "Server error while uploading icon"));
    }
};


