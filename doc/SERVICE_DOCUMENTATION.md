
# 🛠️ SIRE Tech API - Service Management Documentation

## 📋 Table of Contents
- [Service Overview](#service-overview)
- [Service Model](#service-model)
- [Service Controller](#service-controller)
- [Service Routes](#service-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 🎯 Service Overview

The SIRE Tech API Service Management System handles all service catalog operations including creation, updates, activation/deactivation, and public listing. Services represent the offerings that SIRE Tech provides to clients (web development, mobile apps, digital marketing, etc.).

### Service System Features
- **Service Catalog** - Comprehensive service listing
- **Feature Lists** - Detailed service features
- **Active/Inactive Status** - Control service visibility
- **Icon/Image Support** - Visual representation via Cloudinary
- **Admin Management** - Full CRUD operations for admins
- **Public Access** - Clients can view active services
- **Search & Filter** - Find services by title or description

---

## 🗄️ Service Model

### Schema Definition
```typescript
interface IService {
  _id: string;
  title: string;
  description: string;
  features: string[];
  isActive: boolean;
  icon?: string;
  createdBy: ObjectId;           // Reference to User
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Title & Description** - Clear service identification
- **Feature Arrays** - List of service features/benefits
- **Active Status** - Show/hide from public catalog
- **Icon Support** - Service branding and visual identity
- **Audit Trail** - Track creator and timestamps
- **Database Indexes** - Optimized queries on isActive

### Validation Rules
```typescript
// Required fields
title: { required: true, maxlength: 100, unique: true }
description: { required: true }
features: { required: true, type: Array }
isActive: { required: true, default: true }
createdBy: { required: true, ref: 'User' }

// Optional fields
icon: { type: String }
```

### Model Implementation

**File: `src/models/Service.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IService } from '../types/index';

const serviceSchema = new Schema<IService>({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true
  },
  features: {
    type: [String],
    required: [true, 'Features are required'],
    validate: {
      validator: function(v: string[]) {
        return v && v.length > 0;
      },
      message: 'At least one feature is required'
    }
  },
  isActive: {
    type: Boolean,
    required: [true, 'Active status is required'],
    default: true
  },
  icon: {
    type: String,
    trim: true
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
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ title: 1 });

const Service = mongoose.model<IService>('Service', serviceSchema);

export default Service;
```

---

## 🎮 Service Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Service from '../models/Service';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
```

### Functions Overview

#### `createService(serviceData)`
**Purpose:** Create new service (Admin only)
**Access:** Admin users (super_admin, finance, project_manager)
**Validation:**
- Title uniqueness check
- Features array validation
**Process:**
- Validate required fields
- Check for duplicate service title
- Upload icon to Cloudinary (if provided)
- Create service record
**Response:** Complete service data

**Controller Implementation:**
```typescript
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
```

#### `getAllServices(query)`
**Purpose:** Get all services with filtering (Admin)
**Access:** Admin users
**Features:**
- Pagination with configurable limits
- Search by title or description
- Filter by active/inactive status
- Sort options
- Creator population
**Query Parameters:**
- page, limit, search, status
**Response:** Paginated service list

**Controller Implementation:**
```typescript
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
```

#### `getActiveServices()`
**Purpose:** Get all active/published services (Public)
**Access:** Public (no authentication required)
**Features:**
- Filter only active services
- No pagination (all active services)
- Sort by creation date
- Exclude inactive services
**Response:** List of active services

**Controller Implementation:**
```typescript
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
```

#### `getService(serviceId)`
**Purpose:** Get single service details
**Access:** Public (active services) or Admin (all services)
**Response:** Complete service data with creator information

**Controller Implementation:**
```typescript
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
```

#### `updateService(serviceId, serviceData)`
**Purpose:** Update service details (Admin only)
**Access:** Admin users
**Allowed Fields:**
- title, description, features
- icon (Cloudinary URL)
**Restrictions:** Cannot change creator or creation date
**Security:** Admin permission validation

**Controller Implementation:**
```typescript
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
```

#### `deleteService(serviceId)`
**Purpose:** Delete service (Admin only)
**Access:** Super admin only
**Security:**
- Admin permission check
- Check for service usage in quotations/projects
**Process:**
- Verify service exists
- Check for dependencies (optional)
- Delete service record
**Response:** Success confirmation

**Controller Implementation:**
```typescript
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
```

#### `toggleServiceStatus(serviceId)`
**Purpose:** Activate or deactivate service
**Access:** Admin users
**Process:**
- Toggle isActive boolean
- Update service visibility
- Log status change
**Response:** Updated service with new status

**Controller Implementation:**
```typescript
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
```

#### `uploadServiceIcon(serviceId, file)`
**Purpose:** Upload service icon to Cloudinary
**Access:** Admin users
**Validation:**
- File type validation (images only)
- File size limit (1MB)
**Process:**
- Upload to Cloudinary
- Update service icon URL
- Delete old icon (if exists)
**Response:** Updated service with new icon

**Controller Implementation:**
```typescript
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
```

---

## 🛣️ Service Routes

### Base Path: `/api/services`

```typescript
// Public Routes
GET    /active                    // Get active services

// Admin Routes
POST   /                          // Create service
GET    /                          // Get all services (with filters)
GET    /:serviceId                // Get single service
PUT    /:serviceId                // Update service
DELETE /:serviceId                // Delete service (super admin)
PATCH  /:serviceId/toggle-status  // Toggle active/inactive
POST   /:serviceId/icon           // Upload service icon
```

### Router Implementation

**File: `src/routes/serviceRoutes.ts`**

```typescript
import express from 'express';
import {
    createService,
    getAllServices,
    getActiveServices,
    getService,
    updateService,
    deleteService,
    toggleServiceStatus,
    uploadServiceIcon
} from '../controllers/serviceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { uploadServiceIcon as uploadIconMiddleware } from '../config/cloudinary';

const router = express.Router();

/**
 * @route   GET /api/services/active
 * @desc    Get all active services
 * @access  Public
 */
router.get('/active', getActiveServices);

/**
 * @route   POST /api/services
 * @desc    Create new service
 * @access  Private (Admin)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), createService);

/**
 * @route   GET /api/services
 * @desc    Get all services with filtering and pagination
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager', 'staff']), getAllServices);

/**
 * @route   GET /api/services/:serviceId
 * @desc    Get single service
 * @access  Public
 */
router.get('/:serviceId', getService);

/**
 * @route   PUT /api/services/:serviceId
 * @desc    Update service
 * @access  Private (Admin)
 */
router.put('/:serviceId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), updateService);

/**
 * @route   DELETE /api/services/:serviceId
 * @desc    Delete service
 * @access  Private (Super Admin only)
 */
router.delete('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), deleteService);

/**
 * @route   PATCH /api/services/:serviceId/toggle-status
 * @desc    Toggle service active/inactive status
 * @access  Private (Admin)
 */
router.patch('/:serviceId/toggle-status', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), toggleServiceStatus);

/**
 * @route   POST /api/services/:serviceId/icon
 * @desc    Upload service icon
 * @access  Private (Admin)
 */
router.post('/:serviceId/icon', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), uploadIconMiddleware.single('icon'), uploadServiceIcon);

export default router;
```

---

## 📝 API Examples

### Complete Service Management Flow

#### 1. Create Service (Admin)
```bash
curl -X POST http://localhost:5000/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "title": "E-commerce Website Development",
    "description": "Full-featured online store with payment integration, inventory management, and admin dashboard",
    "features": [
      "Responsive design",
      "Payment gateway integration",
      "Product catalog management",
      "Order tracking system",
      "Admin dashboard",
      "SEO optimization"
    ]
  }'
```

#### 2. Get Active Services (Public)
```bash
curl -X GET http://localhost:5000/api/services/active
```

#### 3. Get All Services (Admin with Filters)
```bash
curl -X GET "http://localhost:5000/api/services?page=1&limit=10&status=active" \
  -H "Authorization: Bearer <admin_token>"
```

#### 4. Update Service (Admin)
```bash
curl -X PUT http://localhost:5000/api/services/<serviceId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "title": "E-commerce Website Development Pro",
    "features": [
      "Responsive design",
      "Payment gateway integration",
      "Product catalog management",
      "Order tracking system",
      "Admin dashboard",
      "SEO optimization",
      "Multi-language support"
    ]
  }'
```

#### 5. Toggle Service Status (Admin)
```bash
curl -X PATCH http://localhost:5000/api/services/<serviceId>/toggle-status \
  -H "Authorization: Bearer <admin_token>"
```

#### 6. Upload Service Icon (Admin)
```bash
curl -X POST http://localhost:5000/api/services/<serviceId>/icon \
  -H "Authorization: Bearer <admin_token>" \
  -F "icon=@/path/to/icon.png"
```

#### 7. Delete Service (Super Admin)
```bash
curl -X DELETE http://localhost:5000/api/services/<serviceId> \
  -H "Authorization: Bearer <super_admin_token>"
```

---

## 🔒 Security Features

### Access Control
- **Public Access** - Active services visible to everyone
- **Admin Management** - Only admins can create/edit services
- **Super Admin Delete** - Only super admin can delete services
- **Status Control** - Admins can hide/show services

### Data Protection
- **Title Uniqueness** - Prevent duplicate service names
- **Status Filtering** - Clients only see active services
- **Audit Trail** - Track who created each service
- **Sanitized Responses** - Clean data output

### Input Validation
- **Required Fields** - Title, description, features
- **Features Validation** - At least one feature required
- **Title Uniqueness** - Database-level uniqueness constraint

---

## 🚨 Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Title, description, and features are required"
}
```

#### 409 Conflict
```json
{
  "success": false,
  "message": "Service with this title already exists",
  "error": "Duplicate service title"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Service not found",
  "error": "No service found with the provided ID"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "error": "Only super admin can delete services"
}
```

---

## 📊 Database Indexes

### Performance Optimizations
```typescript
// Status index for active service filtering
serviceSchema.index({ isActive: 1 });

// Title index for search and uniqueness
serviceSchema.index({ title: 1 });
```

---

## 🔗 Integration with Other Modules

### Quotation Integration
- Services included in quotations
- Service details referenced in quotation items
- Track service demand
- Quotation service population

### Project Integration
- Link multiple services to projects
- Track service delivery
- Service usage analytics
- Project service population

### Client Integration
- Clients browse active services
- Service catalog for client portal
- Request quotations for services
- Track client service preferences

### Analytics Integration
- Most popular services
- Service demand trends
- Service usage tracking

---

## 🎯 Best Practices

### Service Data Management
1. **Clear Descriptions** - Comprehensive service details
2. **Feature Lists** - Detailed, bullet-point features
3. **Professional Icons** - High-quality service icons
4. **Regular Updates** - Keep service catalog current

### API Design
1. **Public Access** - Active services accessible to all
2. **Admin Control** - Secure management endpoints
3. **Consistent Responses** - Standardized response format
4. **Error Handling** - Clear, actionable error messages

### Service Catalog Best Practices
1. **Regular Updates** - Keep service catalog current
2. **Feature Highlights** - Emphasize key benefits
3. **Visual Appeal** - Quality icons and images
4. **Status Management** - Inactive vs deleted services

---

## 📈 Service Statistics

### Metrics to Track
- **Total Services** - Overall catalog size
- **Active Services** - Currently offered services
- **Service Demand** - Usage in quotations/projects
- **Popular Services** - Most requested services

### Example Stats Endpoint
```typescript
// Get service statistics
export const getServiceStats = async (req, res, next) => {
    try {
        const total = await Service.countDocuments();
        const active = await Service.countDocuments({ isActive: true });
        const inactive = await Service.countDocuments({ isActive: false });

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total,
                    active,
                    inactive
                }
            }
        });

    } catch (error) {
        console.error('Get service stats error:', error);
        next(errorHandler(500, "Server error while fetching service statistics"));
    }
};
```

---

## 🧪 Testing Considerations

### Unit Tests
- **Model Validation** - Test schema constraints
- **Title Uniqueness** - Verify duplicate prevention
- **Feature Array** - Validate feature requirements

### Integration Tests
- **Service Creation** - Create service flow
- **Status Toggle** - Activate/deactivate functionality
- **Service Listing** - Public vs admin access
- **Update Operations** - Field modification

### Security Tests
- **Public Access** - Verify active service visibility
- **Admin Protection** - Test admin-only operations
- **Status Filtering** - Inactive service hiding
- **Permission Levels** - Role-based access control

---

## 🔄 Future Enhancements

### Planned Features
- **Service Packages** - Bundle multiple services
- **Service Reviews** - Client testimonials per service
- **Service Comparison** - Side-by-side feature comparison
- **Service Templates** - Pre-configured service packages
- **Custom Services** - Client-requested custom offerings
- **Service Versioning** - Track service evolution

### Technical Improvements
- **Search Optimization** - Full-text search
- **Caching** - Cache active service catalog
- **Analytics Dashboard** - Service performance metrics
- **A/B Testing** - Test service descriptions
- **SEO Optimization** - Service catalog SEO

---

## 📧 Integration Points

### Email Notifications
- New service announcements
- Service updates to clients
- Feature additions

### Client Portal
- Browse service catalog
- Request quotations
- View service details
- Compare services

### Admin Dashboard
- Service management interface
- Service performance analytics
- Quick status toggles
- Bulk operations

---

## 🔧 Helper Functions

### Service Availability Check
```typescript
// Check if service is available for quotation
export const isServiceAvailable = async (serviceId: string): Promise<boolean> => {
    try {
        const service = await Service.findById(serviceId);
        return service ? service.isActive : false;
    } catch (error) {
        return false;
    }
};
```

---

## 📊 Sample Service Data

### Example Service Objects

#### E-commerce Website Service
```json
{
  "_id": "service_id_here",
  "title": "E-commerce Website Development",
  "description": "Build a complete online store with payment processing, inventory management, and customer accounts",
  "features": [
    "Responsive design",
    "Payment gateway integration",
    "Product catalog",
    "Shopping cart",
    "Order management",
    "Admin dashboard",
    "SEO optimization"
  ],
  "isActive": true,
  "icon": "https://res.cloudinary.com/sire-tech/service-icons/ecommerce.png",
  "createdBy": "admin_user_id",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

#### Mobile App Service
```json
{
  "_id": "service_id_here",
  "title": "Mobile App Development",
  "description": "Native mobile applications for iOS and Android platforms with cloud backend integration",
  "features": [
    "Native iOS development",
    "Native Android development",
    "RESTful API integration",
    "Push notifications",
    "Offline functionality",
    "App Store submission",
    "Google Play submission"
  ],
  "isActive": true,
  "createdBy": "admin_user_id",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

## 📦 Required Environment Variables

```env
# Cloudinary (for service icons)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL (for service catalog)
FRONTEND_URL=http://localhost:3000
```

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

