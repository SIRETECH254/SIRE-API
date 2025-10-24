import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer, { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { errorHandler } from '../middleware/errorHandler';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
    api_key: process.env.CLOUDINARY_API_KEY as string,
    api_secret: process.env.CLOUDINARY_API_SECRET as string
});

// Configure storage for different file types
const createStorage = (folder: string, allowedFormats: string[] = ['jpg', 'jpeg', 'png', 'gif', 'webp']): CloudinaryStorage => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: folder,
            allowed_formats: allowedFormats,
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        } as any
    });
};

// Storage configurations for different purposes
export const userAvatarStorage = createStorage('sire-tech/avatars');
export const serviceIconStorage = createStorage('sire-tech/service-icons');
export const projectAttachmentStorage = createStorage('sire-tech/project-attachments', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt']);
export const generalFileStorage = createStorage('sire-tech/files', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt']);

// Multer upload configurations
export const uploadUserAvatar = multer({ 
    storage: userAvatarStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    },
    fileFilter: (req: Request, file: any, cb: FileFilterCallback) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

export const uploadServiceIcon = multer({ 
    storage: serviceIconStorage,
    limits: {
        fileSize: 1 * 1024 * 1024 // 1MB limit
    },
    fileFilter: (req: Request, file: any, cb: FileFilterCallback) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

export const uploadProjectAttachment = multer({ 
    storage: projectAttachmentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

export const uploadGeneralFile = multer({ 
    storage: generalFileStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Cloudinary utility functions
export const uploadToCloudinary = async (file: any, folder: string = 'sire-tech/general'): Promise<{
    url: string;
    public_id: string;
    format: string;
    size: number;
}> => {
    try {
        const uploadOptions = {
            folder: folder,
            resource_type: 'auto' as const,
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        };

        let result;
        if (file.path) {
            // File path (traditional upload)
            result = await cloudinary.uploader.upload(file.path, uploadOptions);
        } else if (file.buffer) {
            // File buffer (memory upload)
            result = await new Promise<any>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
                uploadStream.end(file.buffer);
            });
        } else if (typeof file === 'string') {
            // File path as string
            result = await cloudinary.uploader.upload(file, uploadOptions);
        } else {
            throw errorHandler(400, 'Invalid file format. Expected file path, buffer, or string.');
        }
        
        return {
            url: result.secure_url ,
            public_id: result.public_id,
            format: result.format,
            size: result.bytes
        };
    } catch (error: any) {
        throw errorHandler(500, `Upload failed: ${error.message}`);
    }
};

export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error: any) {
        throw errorHandler(500, `Delete failed: ${error.message}`);
    }
};

export const updateCloudinaryImage = async (publicId: string, newImagePath: string, folder: string = 'sire-tech/general'): Promise<{
    url: string;
    public_id: string;
    format: string;
    size: number;
}> => {
    try {
        // Delete old image
        if (publicId) {
            await deleteFromCloudinary(publicId);
        }
        
        // Upload new image
        const result = await uploadToCloudinary(newImagePath, folder);
        return result;
    } catch (error: any) {
        throw errorHandler(500, `Update failed: ${error.message}`);
    }
};

// Generate optimized image URLs
export const getOptimizedImageUrl = (publicId: string, options: any = {}): string => {
    const defaultOptions = {
        width: 800,
        height: 800,
        crop: 'fill',
        quality: 'auto',
        format: 'auto'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    return cloudinary.url(publicId, {
        transformation: [
            { width: finalOptions.width, height: finalOptions.height, crop: finalOptions.crop },
            { quality: finalOptions.quality },
            { fetch_format: finalOptions.format }
        ]
    });
};

// Generate thumbnail URL
export const getThumbnailUrl = (publicId: string, width: number = 200, height: number = 200): string => {
    return cloudinary.url(publicId, {
        transformation: [
            { width, height, crop: 'fill' },
            { quality: 'auto' }
        ]
    });
};

// Generate responsive image URLs
export const getResponsiveImageUrls = (publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    original: string;
} => {
    return {
        thumbnail: getThumbnailUrl(publicId, 150, 150),
        small: getOptimizedImageUrl(publicId, { width: 300, height: 300 }),
        medium: getOptimizedImageUrl(publicId, { width: 600, height: 600 }),
        large: getOptimizedImageUrl(publicId, { width: 1000, height: 1000 }),
        original: cloudinary.url(publicId)
    };
};

export default cloudinary;