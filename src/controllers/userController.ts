import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { errorHandler } from '../middleware/errorHandler';
import User from '../models/User';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = await User.findById(req.user?._id)
            .select('-password -otpCode -resetPasswordToken');

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
                    role: user.role,
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
            avatar?: string;
        } = req.body;

        const user = await User.findById(req.user?._id);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Update allowed fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        if (avatar) user.avatar = avatar;

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

        // Filter by role
        if (role) {
            query.role = role;
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

        const user = await User.findById(userId).select('-password -otpCode -resetPasswordToken');

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
                    role: user.role
                }
            }
        });

    } catch (error: any) {
        console.error('Update user status error:', error);
        next(errorHandler(500, "Server error while updating user status"));
    }
};

// @desc    Set user as admin (Admin only)
// @route   PUT /api/users/:userId/admin
// @access  Private (Admin)
export const setUserAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const { role }: { role: 'super_admin' | 'finance' | 'project_manager' | 'staff' } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Validate role
        const validRoles = ['super_admin', 'finance', 'project_manager', 'staff'];
        if (!validRoles.includes(role)) {
            return next(errorHandler(400, "Invalid role"));
        }

        user.role = role;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User role updated to ${role} successfully`,
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role
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

        const user = await User.findById(userId);

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
                    role: user.role
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
        const { firstName, lastName, email, phone, role }: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            role?: 'super_admin' | 'finance' | 'project_manager' | 'staff';
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

        // Derive password from phone and hash
        const passwordHash: string = bcrypt.hashSync(String(phone), 12);

        // Create user
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password: passwordHash,
            role: role || 'staff',
            isActive: true,
            emailVerified: false,
        });

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
                    role: user.role,
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
