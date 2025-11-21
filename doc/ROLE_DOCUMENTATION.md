# 🎭 SIRE Tech API - Role Management System Documentation

## 📋 Table of Contents
- [Role Overview](#role-overview)
- [Role Model](#role-model)
- [Role Controller](#role-controller)
- [Role Routes](#role-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with User System](#integration-with-user-system)

---

## 🎭 Role Overview

The SIRE Tech API uses a unified role-based access control (RBAC) system where all users (including former clients) are managed through a single User model with role assignments. Roles define user permissions and access levels throughout the system.

### Role System Features
- **Unified User Model** - All users (clients, admins, staff) use the same User model
- **Multiple Roles** - Users can have multiple roles assigned
- **Role Management** - Full CRUD operations for roles (super_admin only)
- **System Roles** - Protected default roles that cannot be deleted
- **Permission-Based** - Each role has an array of permissions
- **Presaved Roles** - Roles are stored in database and fetched dynamically

### Default Roles
- `client` - Default role for clients/customers (assigned on registration)
- `super_admin` - Full system access with all permissions
- `finance` - Financial operations access, invoice/payment management
- `project_manager` - Project management access, team assignment, milestone tracking
- `staff` - Basic admin access, client management, service catalog

### Role System Benefits
- **No Token Conflicts** - Single token type for all users
- **Unified Authentication** - One authentication flow for all user types
- **Flexible Permissions** - Easy to add new roles and permissions
- **Scalable** - Easy to extend without code changes
- **Cleaner Codebase** - Less duplication, easier maintenance

---

## 🗄️ Role Model

### Schema Definition
```typescript
interface IRole extends Document {
  _id: string;
  name: string;                    // Unique role identifier (lowercase)
  displayName: string;             // Human-readable role name
  description?: string;            // Role description
  permissions: string[];           // Array of permission strings
  isActive: boolean;               // Role active status
  isSystemRole: boolean;           // Protected system role (cannot be deleted)
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Features
- **Unique Name** - Role name must be unique (stored in lowercase)
- **Display Name** - Human-readable name for UI display
- **Permissions Array** - List of permission strings (e.g., "view_invoices", "create_projects")
- **System Roles** - Protected roles that cannot be deleted
- **Active Status** - Can deactivate roles without deleting them
- **Database Indexes** - Optimized queries on name, isActive, isSystemRole

### Validation Rules
```typescript
// Required fields
name: { required: true, unique: true, maxlength: 50, lowercase: true }
displayName: { required: true, maxlength: 100 }
permissions: { type: Array, default: [] }
isActive: { default: true }
isSystemRole: { default: false }

// Optional fields
description: { maxlength: 500 }
```

### Model Implementation

**File: `src/models/Role.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IRole } from '../types/index';

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  permissions: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemRole: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });
roleSchema.index({ isSystemRole: 1 });

// Prevent deletion of system roles
roleSchema.pre('findOneAndDelete', async function(next) {
  const role = await this.model.findOne(this.getQuery());
  if (role && role.isSystemRole) {
    throw new Error('Cannot delete system roles');
  }
  next();
});

const Role = mongoose.model<IRole>('Role', roleSchema);

export default Role;
```

### Default Roles Configuration

Default roles are created during migration with the following structure:

```typescript
{
  name: 'client',
  displayName: 'Client',
  description: 'Default role for clients/customers',
  permissions: ['view_own_data', 'view_own_invoices', 'view_own_projects', 'make_payments'],
  isSystemRole: true
},
{
  name: 'super_admin',
  displayName: 'Super Admin',
  description: 'Full system access with all permissions',
  permissions: ['*'], // All permissions
  isSystemRole: true
},
{
  name: 'finance',
  displayName: 'Finance Manager',
  description: 'Access to financial operations, invoices, and payments',
  permissions: ['view_invoices', 'create_invoices', 'view_payments', 'manage_payments', 'view_reports'],
  isSystemRole: true
},
{
  name: 'project_manager',
  displayName: 'Project Manager',
  description: 'Access to project management and team assignment',
  permissions: ['view_projects', 'create_projects', 'update_projects', 'assign_team', 'view_milestones'],
  isSystemRole: true
},
{
  name: 'staff',
  displayName: 'Staff',
  description: 'Basic admin access for staff members',
  permissions: ['view_clients', 'view_services', 'view_projects'],
  isSystemRole: true
}
```

---

## 🎮 Role Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Role from '../models/Role';
import User from '../models/User';
```

### Functions Overview

#### `getAllRoles(query)`
**Purpose:** Get all roles with optional filtering
**Access:** Admin users only (super_admin, finance, project_manager)
**Query Parameters:**
- `isActive` - Filter by active status (true/false)
- `search` - Search by name, displayName, or description
**Response:** Array of roles

**Controller Implementation:**
```typescript
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { isActive, search } = req.query;

        const query: any = {};

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { displayName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const roles = await Role.find(query).sort({ name: 1 });

        res.status(200).json({
            success: true,
            data: {
                roles
            }
        });

    } catch (error: any) {
        console.error('Get all roles error:', error);
        next(errorHandler(500, "Server error while fetching roles"));
    }
};
```

#### `getRole(roleId)`
**Purpose:** Get single role details
**Access:** Admin users only
**Response:** Complete role information

**Controller Implementation:**
```typescript
export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { roleId } = req.params;

        const role = await Role.findById(roleId);

        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                role
            }
        });

    } catch (error: any) {
        console.error('Get role error:', error);
        next(errorHandler(500, "Server error while fetching role"));
    }
};
```

#### `createRole(roleData)`
**Purpose:** Create new role
**Access:** Super admin only
**Validation:**
- Name and displayName required
- Name must be unique
- Name stored in lowercase
**Process:**
- Create role with provided data
- Set isSystemRole to false (custom roles)
- Set isActive to true by default
**Response:** Created role

**Controller Implementation:**
```typescript
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, displayName, description, permissions, isActive }: {
            name: string;
            displayName: string;
            description?: string;
            permissions?: string[];
            isActive?: boolean;
        } = req.body;

        if (!name || !displayName) {
            return next(errorHandler(400, "Name and display name are required"));
        }

        // Check if role with same name already exists
        const existingRole = await Role.findOne({ name: name.toLowerCase() });

        if (existingRole) {
            return next(errorHandler(400, "Role with this name already exists"));
        }

        const role = new Role({
            name: name.toLowerCase(),
            displayName,
            description,
            permissions: permissions || [],
            isActive: isActive !== undefined ? isActive : true,
            isSystemRole: false
        });

        await role.save();

        res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: {
                role
            }
        });

    } catch (error: any) {
        console.error('Create role error:', error);
        next(errorHandler(500, "Server error while creating role"));
    }
};
```

#### `updateRole(roleId, roleData)`
**Purpose:** Update existing role
**Access:** Super admin only
**Allowed Fields:**
- displayName
- description
- permissions
- isActive
**Restrictions:**
- Cannot change system role name
- Cannot change isSystemRole field
**Response:** Updated role

**Controller Implementation:**
```typescript
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { roleId } = req.params;
        const { displayName, description, permissions, isActive }: {
            displayName?: string;
            description?: string;
            permissions?: string[];
            isActive?: boolean;
        } = req.body;

        const role = await Role.findById(roleId);

        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        // Cannot update system role name
        if (role.isSystemRole && req.body.name && req.body.name !== role.name) {
            return next(errorHandler(400, "Cannot change system role name"));
        }

        if (displayName) role.displayName = displayName;
        if (description !== undefined) role.description = description;
        if (permissions !== undefined) role.permissions = permissions;
        if (isActive !== undefined) role.isActive = isActive;

        await role.save();

        res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: {
                role
            }
        });

    } catch (error: any) {
        console.error('Update role error:', error);
        next(errorHandler(500, "Server error while updating role"));
    }
};
```

#### `deleteRole(roleId)`
**Purpose:** Delete role
**Access:** Super admin only
**Validation:**
- Cannot delete system roles
- Cannot delete role if users have it assigned
**Process:**
- Check if role is system role
- Check if any users have this role
- Delete role if safe
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { roleId } = req.params;

        const role = await Role.findById(roleId);

        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        if (role.isSystemRole) {
            return next(errorHandler(400, "Cannot delete system roles"));
        }

        // Check if any users have this role
        const usersWithRole = await User.countDocuments({ roles: roleId });

        if (usersWithRole > 0) {
            return next(errorHandler(400, `Cannot delete role. ${usersWithRole} user(s) have this role assigned. Please reassign users first.`));
        }

        await Role.findByIdAndDelete(roleId);

        res.status(200).json({
            success: true,
            message: "Role deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete role error:', error);
        next(errorHandler(500, "Server error while deleting role"));
    }
};
```

#### `getUsersByRole(roleId, query)`
**Purpose:** Get all users with specific role
**Access:** Admin users only
**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by name or email
- `isActive` - Filter by active status
**Response:** Paginated list of users with the role

**Controller Implementation:**
```typescript
export const getUsersByRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { roleId } = req.params;
        const { page = 1, limit = 10, search, isActive } = req.query;

        const role = await Role.findById(roleId);

        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        const query: any = {
            roles: roleId
        };

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const users = await User.find(query)
            .select('-password -otpCode -resetPasswordToken')
            .populate('roles', 'name displayName')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                role: {
                    id: role._id,
                    name: role.name,
                    displayName: role.displayName
                },
                users,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalUsers: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get users by role error:', error);
        next(errorHandler(500, "Server error while fetching users by role"));
    }
};
```

#### `getClients(query)`
**Purpose:** Get clients (users with "client" role)
**Access:** Admin users only
**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by name, email, or company
- `status` - Filter by status (active, inactive, verified, unverified)
**Response:** Paginated list of clients

**Controller Implementation:**
```typescript
export const getClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;

        // Find client role
        const clientRole = await Role.findOne({ name: 'client' });

        if (!clientRole) {
            return next(errorHandler(404, "Client role not found. Please run migration script first."));
        }

        const query: any = {
            roles: clientRole._id
        };

        // Search by name, email, or company
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        if (status === 'verified') {
            query.emailVerified = true;
        } else if (status === 'unverified') {
            query.emailVerified = false;
        }

        const options = {
            page: parseInt(page as string),
            limit: parseInt(limit as string)
        };

        const clients = await User.find(query)
            .select('-password -otpCode -resetPasswordToken')
            .populate('roles', 'name displayName')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                clients,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalClients: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        });

    } catch (error: any) {
        console.error('Get clients error:', error);
        next(errorHandler(500, "Server error while fetching clients"));
    }
};
```

---

## 🛣️ Role Routes

### Base Path: `/api/roles`

```typescript
GET    /                          // Get all roles (admin)
GET    /:roleId                   // Get single role (admin)
POST   /                          // Create role (super_admin)
PUT    /:roleId                   // Update role (super_admin)
DELETE /:roleId                   // Delete role (super_admin)
GET    /:roleId/users              // Get users by role (admin)
GET    /client/users               // Get clients (users with client role) (admin)
```

### Router Implementation

**File: `src/routes/roleRoutes.ts`**

```typescript
import express from 'express';
import {
    getAllRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    getUsersByRole,
    getClients
} from '../controllers/roleController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/roles
 * @desc    Get all roles
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllRoles);

/**
 * @route   GET /api/roles/:roleId
 * @desc    Get single role
 * @access  Private (Admin)
 */
router.get('/:roleId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getRole);

/**
 * @route   POST /api/roles
 * @desc    Create role
 * @access  Private (Super Admin only)
 */
router.post('/', authenticateToken, requireAdmin, createRole);

/**
 * @route   PUT /api/roles/:roleId
 * @desc    Update role
 * @access  Private (Super Admin only)
 */
router.put('/:roleId', authenticateToken, requireAdmin, updateRole);

/**
 * @route   DELETE /api/roles/:roleId
 * @desc    Delete role
 * @access  Private (Super Admin only)
 */
router.delete('/:roleId', authenticateToken, requireAdmin, deleteRole);

/**
 * @route   GET /api/roles/:roleId/users
 * @desc    Get users with specific role
 * @access  Private (Admin)
 */
router.get('/:roleId/users', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getUsersByRole);

/**
 * @route   GET /api/roles/client/users
 * @desc    Get clients (users with client role)
 * @access  Private (Admin)
 */
router.get('/client/users', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getClients);

export default router;
```

### Route Details

#### `GET /api/roles`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `isActive` (optional): Filter by active status (true/false)
- `search` (optional): Search by name, displayName, or description

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "_id": "...",
        "name": "client",
        "displayName": "Client",
        "description": "Default role for clients/customers",
        "permissions": ["view_own_data", "view_own_invoices", "view_own_projects", "make_payments"],
        "isActive": true,
        "isSystemRole": true,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/roles/:roleId`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "role": {
      "_id": "...",
      "name": "super_admin",
      "displayName": "Super Admin",
      "description": "Full system access with all permissions",
      "permissions": ["*"],
      "isActive": true,
      "isSystemRole": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `POST /api/roles`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Body:**
```json
{
  "name": "custom_role",
  "displayName": "Custom Role",
  "description": "A custom role for specific permissions",
  "permissions": ["view_reports", "export_data"],
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "role": {
      "_id": "...",
      "name": "custom_role",
      "displayName": "Custom Role",
      "description": "A custom role for specific permissions",
      "permissions": ["view_reports", "export_data"],
      "isActive": true,
      "isSystemRole": false,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `PUT /api/roles/:roleId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Body:**
```json
{
  "displayName": "Updated Role Name",
  "description": "Updated description",
  "permissions": ["view_reports", "export_data", "manage_users"],
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role updated successfully",
  "data": {
    "role": {
      "_id": "...",
      "name": "custom_role",
      "displayName": "Updated Role Name",
      "description": "Updated description",
      "permissions": ["view_reports", "export_data", "manage_users"],
      "isActive": true,
      "isSystemRole": false
    }
  }
}
```

#### `DELETE /api/roles/:roleId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Response:**
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

#### `GET /api/roles/:roleId/users`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name or email
- `isActive` (optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "...",
      "name": "client",
      "displayName": "Client"
    },
    "users": [
      {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "client@example.com",
        "roles": [
          {
            "_id": "...",
            "name": "client",
            "displayName": "Client"
          }
        ],
        "isActive": true,
        "emailVerified": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/roles/client/users`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name, email, or company
- `status` (optional): Filter by status (active, inactive, verified, unverified)

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "_id": "...",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@company.com",
        "phone": "+254712345678",
        "company": "Acme Corporation",
        "address": "123 Main Street",
        "city": "Nairobi",
        "country": "Kenya",
        "roles": [
          {
            "_id": "...",
            "name": "client",
            "displayName": "Client"
          }
        ],
        "isActive": true,
        "emailVerified": true,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalClients": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles
**Usage in Role Routes:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllRoles);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles
**Parameters:**
- `allowedRoles` - Array of role names (e.g., ['super_admin', 'finance'])

**Usage:**
```typescript
router.get('/:roleId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getRole);
```

#### `requireAdmin`
**Purpose:** Super admin access only
**Usage:**
```typescript
router.post('/', authenticateToken, requireAdmin, createRole);
```

---

## 📝 API Examples

### Complete Role Management Flow

#### 1. Get All Roles
```bash
curl -X GET http://localhost:5000/api/roles \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 2. Get Single Role
```bash
curl -X GET http://localhost:5000/api/roles/<roleId> \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 3. Create Custom Role (Super Admin)
```bash
curl -X POST http://localhost:5000/api/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{
    "name": "support_agent",
    "displayName": "Support Agent",
    "description": "Role for customer support agents",
    "permissions": ["view_tickets", "reply_tickets", "view_clients"],
    "isActive": true
  }'
```

#### 4. Update Role (Super Admin)
```bash
curl -X PUT http://localhost:5000/api/roles/<roleId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{
    "displayName": "Support Agent - Level 2",
    "permissions": ["view_tickets", "reply_tickets", "view_clients", "escalate_tickets"]
  }'
```

#### 5. Delete Role (Super Admin)
```bash
curl -X DELETE http://localhost:5000/api/roles/<roleId> \
  -H "Authorization: Bearer <super_admin_token>"
```

#### 6. Get Users by Role
```bash
curl -X GET "http://localhost:5000/api/roles/<roleId>/users?page=1&limit=10" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 7. Get Clients (Users with Client Role)
```bash
curl -X GET "http://localhost:5000/api/roles/client/users?page=1&limit=10&search=tech&status=active" \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🔒 Security Features

### Access Control
- **Role Management** - Only super_admin can create, update, or delete roles
- **Role Viewing** - Admin users (super_admin, finance, project_manager) can view roles
- **System Role Protection** - System roles cannot be deleted
- **User Assignment Check** - Cannot delete role if users have it assigned

### Data Protection
- **Role Name Uniqueness** - Database-level uniqueness constraint
- **System Role Protection** - Pre-save hooks prevent deletion of system roles
- **Input Validation** - All fields validated before creation/update
- **Permission Array** - Flexible permission system

### Role Assignment
- **Multiple Roles** - Users can have multiple roles
- **Role Validation** - Roles must exist before assignment
- **System Role Safety** - Cannot remove last role if it's a system role

---

## 🚨 Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Role with this name already exists"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Role not found"
}
```

#### 400 Bad Request (System Role)
```json
{
  "success": false,
  "message": "Cannot delete system roles"
}
```

#### 400 Bad Request (Users Assigned)
```json
{
  "success": false,
  "message": "Cannot delete role. 5 user(s) have this role assigned. Please reassign users first."
}
```

---

## 🔗 Integration with User System

### User Model Integration

Users have a `roles` array field that references Role documents:

```typescript
// User Model
roles: [{
  type: Schema.Types.ObjectId,
  ref: 'Role'
}]
```

### Token Payload Integration

JWT tokens include roleIds in the payload:

```typescript
{
  userId: string,
  roleIds: string[],  // Array of role IDs
  userType: "user"     // Always "user" for unified system
}
```

### Default Role Assignment

When users register, they automatically receive the "client" role:

```typescript
// In authController.register()
const clientRole = await Role.findOne({ name: 'client' });
user.roles = [clientRole._id];
```

### Role-Based Authorization

Middleware checks user roles from populated role documents:

```typescript
// In authorizeRoles middleware
const userRoleNames = req.user.roleNames || [];
const hasAllowedRole = allowedRoles.some(role => userRoleNames.includes(role));
```

---

## 📊 Database Indexes

### Performance Optimizations
```typescript
// Role name index for fast lookups
roleSchema.index({ name: 1 });

// Active status index for filtering
roleSchema.index({ isActive: 1 });

// System role index for protection checks
roleSchema.index({ isSystemRole: 1 });

// User roles index for role-based queries
userSchema.index({ roles: 1 });
```

---

## 🧪 Testing Considerations

### Unit Tests
- **Model Validation** - Test schema constraints
- **System Role Protection** - Test deletion prevention
- **Role Uniqueness** - Test duplicate name rejection
- **Permission Array** - Test permission handling

### Integration Tests
- **Role CRUD** - Complete role management flow
- **User Role Assignment** - Assign and remove roles
- **Role-Based Authorization** - Test middleware with different roles
- **Client Retrieval** - Test getClients function

### Security Tests
- **Access Control** - Unauthorized role management prevention
- **System Role Protection** - System role deletion prevention
- **User Assignment Check** - Role deletion with assigned users

---

## 📈 Performance Monitoring

### Key Metrics
- **Role Query Time** - Role lookup performance
- **User Role Population** - Role population performance
- **Role Assignment Time** - Role assignment operation time
- **Client Query Time** - Client retrieval with role filtering

### Optimization Tips
- **Role Caching** - Cache frequently accessed roles
- **Index Usage** - Monitor query performance
- **Population Optimization** - Use selective field population
- **Batch Operations** - Batch role assignments when possible

---

## 🔄 Migration from Client System

### Migration Process

The system includes a migration script (`src/scripts/migrateToRoles.ts`) that:

1. **Creates Default Roles** - Creates all system roles
2. **Migrates Existing Users** - Maps old role enum to Role references
3. **Migrates Clients to Users** - Converts all Client documents to User documents with "client" role
4. **Updates References** - Updates all model references from Client to User
5. **Updates Notifications** - Changes recipientModel from 'Client' to 'User'

### Running Migration

```bash
npm run migrate:roles
```

### Post-Migration

After migration, you should:
1. Delete the Client model file
2. Remove Client routes from index.ts
3. Update all controllers to remove Client references
4. Test the application thoroughly

---

## 🎯 Best Practices

### Role Management
1. **Use System Roles** - Prefer system roles for standard permissions
2. **Custom Roles** - Create custom roles only when needed
3. **Permission Naming** - Use consistent permission naming (e.g., "view_", "create_", "update_", "delete_")
4. **Role Documentation** - Document custom roles and their permissions

### User Role Assignment
1. **Default Role** - Always assign default "client" role on registration
2. **Multiple Roles** - Users can have multiple roles for flexibility
3. **Role Validation** - Always validate roles exist before assignment
4. **Role Removal** - Ensure users have at least one role

### Security Practices
1. **System Role Protection** - Never allow deletion of system roles
2. **Role Assignment Control** - Only super_admin can manage roles
3. **Permission Validation** - Validate permissions in middleware
4. **Audit Logging** - Log all role changes (future enhancement)

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

