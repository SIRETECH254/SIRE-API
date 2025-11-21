import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Role from '../models/Role';
import User from '../models/User';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Admin)
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

// @desc    Get single role
// @route   GET /api/roles/:roleId
// @access  Private (Admin)
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

// @desc    Create role
// @route   POST /api/roles
// @access  Private (Super Admin only)
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
        if (error.message && error.message.includes('Cannot delete system roles')) {
            return next(errorHandler(400, error.message));
        }
        next(errorHandler(500, "Server error while creating role"));
    }
};

// @desc    Update role
// @route   PUT /api/roles/:roleId
// @access  Private (Super Admin only)
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

// @desc    Delete role
// @route   DELETE /api/roles/:roleId
// @access  Private (Super Admin only)
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
        if (error.message && error.message.includes('Cannot delete system roles')) {
            return next(errorHandler(400, error.message));
        }
        next(errorHandler(500, "Server error while deleting role"));
    }
};

// @desc    Get users by role
// @route   GET /api/roles/:roleId/users
// @access  Private (Admin)
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

// @desc    Get clients (users with client role)
// @route   GET /api/roles/client/users
// @access  Private (Admin)
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

