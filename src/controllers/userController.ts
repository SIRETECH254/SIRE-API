import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { errorHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Role from '../models/Role';
import { createInAppNotification } from '../utils/notificationHelper';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findById(req.user?._id)
            .select('-password -otpCode -resetPasswordToken')
            .populate('roles', 'name displayName description permissions');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    roles: user.roles,
                    company: user.company,
                    address: user.address,
                    city: user.city,
                    country: user.country,
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            }
        });

    } catch (error: any) {
        console.error('Get user profile error:', error);
        next(errorHandler(500, "Server error while fetching user profile"));
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, phone, avatar }: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            avatar?: string | null;
        } = req.body;

        const user = await User.findById(req.user?._id);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Update allowed fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;

        // Handle avatar upload via multipart/form-data
        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');

            if (user.avatarPublicId) {
                try {
                    await deleteFromCloudinary(user.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            user.avatar = uploadResult.url;
            user.avatarPublicId = uploadResult.public_id;
        } else if (
            avatar === null ||
            (typeof avatar === 'string' && avatar.trim().length === 0)
        ) {
            if (user.avatarPublicId) {
                try {
                    await deleteFromCloudinary(user.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            user.avatar = null;
            user.avatarPublicId = null;
        } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
            if (user.avatarPublicId) {
                try {
                    await deleteFromCloudinary(user.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            // Allow direct avatar URL updates (e.g., already uploaded images)
            user.avatar = avatar.trim();
            user.avatarPublicId = null;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar
                }
            }
        });

    } catch (error: any) {
        console.error('Update user profile error:', error);
        next(errorHandler(500, "Server error while updating profile"));
    }
};

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { currentPassword, newPassword }: {
            currentPassword: string;
            newPassword: string;
        } = req.body;

        if (!currentPassword || !newPassword) {
            return next(errorHandler(400, "Current password and new password are required"));
        }

        const user = await User.findById(req.user?._id).select('+password');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Verify current password
        const isCurrentPasswordValid: boolean = bcrypt.compareSync(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return next(errorHandler(400, "Current password is incorrect"));
        }

        // Hash new password
        const hashedNewPassword: string = bcrypt.hashSync(newPassword, 12);

        user.password = hashedNewPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error: any) {
        console.error('Change password error:', error);
        next(errorHandler(500, "Server error while changing password"));
    }
};

// @desc    Get notification preferences
// @route   GET /api/users/notifications
// @access  Private
export const getNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findById(req.user?._id).select('notificationPreferences');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                notificationPreferences: user.notificationPreferences || {}
            }
        });

    } catch (error: any) {
        console.error('Get notification preferences error:', error);
        next(errorHandler(500, "Server error while fetching notification preferences"));
    }
};

// @desc    Update notification preferences
// @route   PUT /api/users/notifications
// @access  Private
export const updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, sms, inApp }: {
            email?: boolean;
            sms?: boolean;
            inApp?: boolean;
        } = req.body;

        const user = await User.findById(req.user?._id);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Update notification preferences
        if (!user.notificationPreferences) {
            user.notificationPreferences = {};
        }

        if (email !== undefined) user.notificationPreferences.email = email;
        if (sms !== undefined) user.notificationPreferences.sms = sms;
        if (inApp !== undefined) user.notificationPreferences.inApp = inApp;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Notification preferences updated successfully",
            data: {
                notificationPreferences: user.notificationPreferences
            }
        });

    } catch (error: any) {
        console.error('Update notification preferences error:', error);
        next(errorHandler(500, "Server error while updating notification preferences"));
    }
};

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private (Admin)
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, role, status } = req.query;

        const query: any = {};

        // Search by name or email
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by role (find users with specific role)
        if (role) {
            const roleDoc = await Role.findOne({ name: role.toString().toLowerCase() });
            if (roleDoc) {
                query.roles = roleDoc._id;
            }
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
            limit: parseInt(limit as string),
            select: '-password -otpCode -resetPasswordToken'
        };

        const users = await User.find(query)
            .select(options.select)
            .populate('roles', 'name displayName')
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                users: users,
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
        console.error('Get all users error:', error);
        next(errorHandler(500, "Server error while fetching users"));
    }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/users/:userId
// @access  Private (Admin)
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('-password -otpCode -resetPasswordToken')
            .populate('roles', 'name displayName description permissions');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                user: user
            }
        });

    } catch (error: any) {
        console.error('Get user by ID error:', error);
        next(errorHandler(500, "Server error while fetching user"));
    }
};

// @desc    Update user (Admin only)
// @route   PUT /api/users/:userId
// @access  Private (Admin)
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, phone, email, avatar }: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            email?: string;
            avatar?: string | null;
        } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Update allowed fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        
        // Email update requires validation
        if (email) {
            const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
            if (!emailRegex.test(email)) {
                return next(errorHandler(400, "Please provide a valid email"));
            }
            
            // Check if email is already taken by another user
            const existingUser = await User.findOne({ 
                email: email.toLowerCase(),
                _id: { $ne: userId }
            });
            
            if (existingUser) {
                return next(errorHandler(400, "Email is already taken by another user"));
            }
            
            user.email = email.toLowerCase();
        }

        // Handle avatar upload via multipart/form-data
        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');

            if (user.avatarPublicId) {
                try {
                    await deleteFromCloudinary(user.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            user.avatar = uploadResult.url;
            user.avatarPublicId = uploadResult.public_id;
        } else if (
            avatar === null ||
            (typeof avatar === 'string' && avatar.trim().length === 0)
        ) {
            if (user.avatarPublicId) {
                try {
                    await deleteFromCloudinary(user.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            user.avatar = null;
            user.avatarPublicId = null;
        } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
            if (user.avatarPublicId) {
                try {
                    await deleteFromCloudinary(user.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            // Allow direct avatar URL updates (e.g., already uploaded images)
            user.avatar = avatar.trim();
            user.avatarPublicId = null;
        }

        await user.save();
        await user.populate('roles', 'name displayName');

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    roles: user.roles,
                    isActive: user.isActive
                }
            }
        });

    } catch (error: any) {
        console.error('Update user error:', error);
        next(errorHandler(500, "Server error while updating user"));
    }
};

// @desc    Update user status (Admin only)
// @route   PUT /api/users/:userId/status
// @access  Private (Admin)
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const { isActive }: { isActive: boolean } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Update status
        if (isActive !== undefined) user.isActive = isActive;

        await user.save();

        // Send notification to user if account is deactivated
        if (!user.isActive) {
            try {
                await createInAppNotification({
                    recipient: user._id.toString(),
                    recipientModel: 'User',
                    category: 'general',
                    subject: 'Account Status Changed',
                    message: `Your admin account has been deactivated. Please contact super admin for assistance.`,
                    metadata: {
                        userId: user._id,
                        isActive: false
                    },
                    io: (req.app as any).get('io')
                });
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

        await user.populate('roles', 'name displayName');

        res.status(200).json({
            success: true,
            message: "User status updated successfully",
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    isActive: user.isActive,
                    roles: user.roles
                }
            }
        });

    } catch (error: any) {
        console.error('Update user status error:', error);
        next(errorHandler(500, "Server error while updating user status"));
    }
};

// @desc    Set user as admin (Admin only) - DEPRECATED: Use assignRole/removeRole instead
// @route   PUT /api/users/:userId/admin
// @access  Private (Admin)
export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const { roleName }: { roleName: string } = req.body;

        if (!roleName) {
            return next(errorHandler(400, "Role name is required"));
        }

        const user = await User.findById(userId);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Find role by name
        const role = await Role.findOne({ name: roleName.toLowerCase() });
        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        // Replace all roles with the new role (or add if not present)
        const roleId = typeof role._id === 'string' ? new mongoose.Types.ObjectId(role._id) : role._id;
        const hasRole = user.roles.some((r: any) => r.toString() === roleId.toString());
        if (!hasRole) {
            user.roles = [roleId]; // Replace all roles with the new one
            await user.save();
        }

        await user.populate('roles', 'name displayName');

        res.status(200).json({
            success: true,
            message: `User role updated to ${roleName} successfully`,
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    roles: user.roles
                }
            }
        });

    } catch (error: any) {
        console.error('Set user admin error:', error);
        next(errorHandler(500, "Server error while updating user admin status"));
    }
};

// @desc    Get user roles (Admin only)
// @route   GET /api/users/:userId/roles
// @access  Private (Admin)
export const getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .populate('roles', 'name displayName description permissions');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    roles: user.roles
                }
            }
        });

    } catch (error: any) {
        console.error('Get user roles error:', error);
        next(errorHandler(500, "Server error while fetching user roles"));
    }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:userId
// @access  Private (Admin)
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;

        // Prevent deleting self
        if (req.user && String(req.user._id) === String(userId)) {
            return next(errorHandler(400, "You cannot delete your own account"));
        }

        const user = await User.findById(userId);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        await User.findByIdAndDelete(userId);

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });

    } catch (error: any) {
        console.error('Delete user error:', error);
        next(errorHandler(500, "Server error while deleting user"));
    }
};

// @desc    Admin create customer
// @route   POST /api/users/admin-create
// @access  Private (Admin)
export const adminCreateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, email, phone, roleNames, company, address, city, country }: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            roleNames?: string[];
            company?: string;
            address?: string;
            city?: string;
            country?: string;
        } = req.body;

        if (!firstName || !lastName || !email || !phone) {
            return next(errorHandler(400, "firstName, lastName, email and phone are required"));
        }

        // Check duplicates (email/phone)
        const existing = await User.findOne({ $or: [{ email }, { phone }] });
        if (existing) {
            const field = existing.email === email ? 'email' : 'phone';
            return next(errorHandler(400, `A user with this ${field} already exists`));
        }

        // Get roles by names (default to 'client' if not specified)
        let assignedRoles: any[] = [];
        if (roleNames && roleNames.length > 0) {
            const roles = await Role.find({ name: { $in: roleNames.map(r => r.toLowerCase()) } });
            if (roles.length !== roleNames.length) {
                return next(errorHandler(400, "One or more specified roles not found"));
            }
            assignedRoles = roles.map(r => r._id);
        } else {
            // Default to client role
            const clientRole = await Role.findOne({ name: 'client' });
            if (!clientRole) {
                return next(errorHandler(500, "Default client role not found. Please run migration script first."));
            }
            assignedRoles = [clientRole._id];
        }

        // Derive password from phone and hash
        const passwordHash: string = bcrypt.hashSync(String(phone), 12);

        // Create user
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password: passwordHash,
            roles: assignedRoles,
            company,
            address,
            city,
            country,
            isActive: true,
            emailVerified: false,
        });

        await user.populate('roles', 'name displayName');

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    roles: user.roles,
                    company: user.company,
                    address: user.address,
                    city: user.city,
                    country: user.country,
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    createdAt: user.createdAt,
                }
            }
        });

    } catch (error: any) {
        console.error('Admin create customer error:', error);
        next(errorHandler(500, "Server error while creating customer"));
    }
};

// @desc    Assign role to user
// @route   POST /api/users/:userId/roles
// @access  Private (Super Admin only)
export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const { roleName }: { roleName: string } = req.body;

        if (!roleName) {
            return next(errorHandler(400, "Role name is required"));
        }

        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        const role = await Role.findOne({ name: roleName.toLowerCase() });
        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        // Check if user already has this role
        const roleId = typeof role._id === 'string' ? new mongoose.Types.ObjectId(role._id) : role._id;
        const hasRole = user.roles.some((r: any) => r.toString() === roleId.toString());
        if (hasRole) {
            return next(errorHandler(400, "User already has this role"));
        }

        user.roles.push(roleId);
        await user.save();

        await user.populate('roles', 'name displayName');

        res.status(200).json({
            success: true,
            message: "Role assigned successfully",
            data: {
                user: {
                    id: user._id,
                    roles: user.roles
                }
            }
        });

    } catch (error: any) {
        console.error('Assign role error:', error);
        next(errorHandler(500, "Server error while assigning role"));
    }
};

// @desc    Remove role from user
// @route   DELETE /api/users/:userId/roles/:roleId
// @access  Private (Super Admin only)
export const removeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId, roleId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        const role = await Role.findById(roleId);
        if (!role) {
            return next(errorHandler(404, "Role not found"));
        }

        // Check if role is system role and user only has this role
        if (role.isSystemRole && user.roles.length === 1) {
            return next(errorHandler(400, "Cannot remove the only role from user. Users must have at least one role."));
        }

        // Remove role
        user.roles = user.roles.filter((r: any) => r.toString() !== roleId);
        await user.save();

        await user.populate('roles', 'name displayName');

        res.status(200).json({
            success: true,
            message: "Role removed successfully",
            data: {
                user: {
                    id: user._id,
                    roles: user.roles
                }
            }
        });

    } catch (error: any) {
        console.error('Remove role error:', error);
        next(errorHandler(500, "Server error while removing role"));
    }
};

// @desc    Get clients (users with client role)
// @route   GET /api/users/clients
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
