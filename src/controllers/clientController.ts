import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import crypto from 'crypto';
import { errorHandler } from '../middleware/errorHandler';
import Client from '../models/Client';
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from '../services/internal/notificationService';
import { generateTokens, generateOTP } from '../utils/index';
import { createInAppNotification } from '../utils/notificationHelper';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

// @desc    Register new client
// @route   POST /api/clients/register
// @access  Public
export const registerClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, email, phone, password, company, address, city, country }: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            password: string;
            company?: string;
            address?: string;
            city?: string;
            country?: string;
        } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !phone || !password) {
            return next(errorHandler(400, "All required fields must be provided"));
        }

        // Validate email format
        if (!validator.isEmail(email)) {
            return next(errorHandler(400, "Please provide a valid email"));
        }

        // Validate phone format
        if (!validator.isMobilePhone(phone)) {
            return next(errorHandler(400, "Please provide a valid phone number"));
        }

        // Check if client already exists
        const existingClient = await Client.findOne({
            $or: [{ email }, { phone }]
        });

        if (existingClient) {
            return next(errorHandler(400, "Client already exists with this email or phone"));
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword: string = bcrypt.hashSync(password, saltRounds);

        // Generate OTP
        const otp: string = generateOTP();
        const otpExpiry: Date = new Date(Date.now() + (parseInt(process.env.OTP_EXP_MINUTES || '10')) * 60 * 1000);

        // Handle avatar upload if provided
        let avatarUrl: string | null = null;
        let avatarPublicId: string | null = null;
        
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');
                avatarUrl = uploadResult.url;
                avatarPublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error('Avatar upload error during registration:', uploadError);
                // Continue with registration even if avatar upload fails
            }
        }

        // Create client
        const client = new Client({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            company,
            address,
            city,
            country,
            avatar: avatarUrl,
            avatarPublicId: avatarPublicId,
            otpCode: otp,
            otpExpiry,
            emailVerified: false
        });

        await client.save();

        // Send OTP via email and SMS
        const notificationResult = await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`);
        console.log('OTP notification result:', notificationResult);

        res.status(201).json({
            success: true,
            message: "Client registered successfully. Please verify your email with the OTP sent.",
            data: {
                clientId: client._id,
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                phone: client.phone,
                company: client.company,
                avatar: client.avatar,
                emailVerified: client.emailVerified
            }
        });

    } catch (error: any) {
        console.error('Register client error:', error);
        next(errorHandler(500, "Server error during client registration"));
    }
};

// @desc    Verify client OTP
// @route   POST /api/clients/verify-otp
// @access  Public
export const verifyClientOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, phone, otp }: {
            email?: string;
            phone?: string;
            otp: string;
        } = req.body;

        if (!otp) {
            return next(errorHandler(400, "OTP is required"));
        }

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"));
        }

        // Find client by email or phone
        const query: any = email ? { email: email.toLowerCase() } : { phone };
        const client = await Client.findOne(query).select('+otpCode +otpExpiry');

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Check if OTP has expired
        if (client.otpExpiry && client.otpExpiry < new Date()) {
            return next(errorHandler(400, "OTP has expired. Please request a new one"));
        }

        // Check if OTP is correct
        if (client.otpCode !== otp.trim()) {
            return next(errorHandler(400, "Incorrect OTP code"));
        }

        // Update client verification status
        client.emailVerified = true;
        client.otpCode = undefined as any;
        client.otpExpiry = undefined as any;
        await client.save();

        // Send welcome notification
        const welcomeResult = await sendWelcomeNotification(client.email, client.phone || '', `${client.firstName} ${client.lastName}`);
        console.log('Welcome notification result:', welcomeResult);

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(client);

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    phone: client.phone,
                    company: client.company,
                    emailVerified: client.emailVerified
                },
                accessToken,
                refreshToken
            }
        });

    } catch (error: any) {
        console.error('Verify client OTP error:', error);
        next(errorHandler(500, "Server error during OTP verification"));
    }
};

// @desc    Resend client OTP
// @route   POST /api/clients/resend-otp
// @access  Public
export const resendClientOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, phone }: { email?: string; phone?: string } = req.body;

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"));
        }

        // Find client by email or phone
        const query: any = email ? { email: email.toLowerCase() } : { phone };
        const client = await Client.findOne(query);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Check if client is already verified
        if (client.emailVerified) {
            return next(errorHandler(400, "Account is already verified"));
        }

        // Generate new OTP
        const otp: string = generateOTP();
        const otpExpiry: Date = new Date(Date.now() + (parseInt(process.env.OTP_EXP_MINUTES || '10')) * 60 * 1000);

        // Update client with new OTP
        client.otpCode = otp;
        client.otpExpiry = otpExpiry;
        await client.save();

        // Send OTP via email and SMS
        const notificationResult = await sendOTPNotification(client.email, client.phone || '', otp, `${client.firstName} ${client.lastName}`);
        console.log('Resend OTP notification result:', notificationResult);

        res.status(200).json({
            success: true,
            message: "OTP has been resent to your email and phone",
            data: {
                clientId: client._id,
                email: client.email,
                phone: client.phone,
                otpExpiry: otpExpiry
            }
        });

    } catch (error: any) {
        console.error('Resend client OTP error:', error);
        next(errorHandler(500, "Server error during OTP resend"));
    }
};

// @desc    Login client
// @route   POST /api/clients/login
// @access  Public
export const loginClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, phone, password }: {
            email?: string;
            phone?: string;
            password: string;
        } = req.body;

        if (!password) {
            return next(errorHandler(400, "Password is required"));
        }

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"));
        }

        // Find client by email or phone
        const query: any = email ? { email: email.toLowerCase() } : { phone };
        const client = await Client.findOne(query).select('+password');

        if (!client) {
            if (email) {
                return next(errorHandler(401, "Email does not exist"));
            } else {
                return next(errorHandler(401, "Phone number does not exist"));
            }
        }

        // Check password
        const isPasswordValid: boolean = bcrypt.compareSync(password, client.password);

        if (!isPasswordValid) {
            return next(errorHandler(401, "Password is incorrect"));
        }

        // Check if client is verified
        if (!client.emailVerified) {
            return next(errorHandler(403, "Please verify your email before logging in"));
        }

        // Check if client is active
        if (!client.isActive) {
            return next(errorHandler(403, "Account is deactivated. Please contact support."));
        }

        // Update last login
        client.lastLoginAt = new Date();
        await client.save();

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(client);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    phone: client.phone,
                    company: client.company,
                    emailVerified: client.emailVerified
                },
                accessToken,
                refreshToken
            }
        });

    } catch (error: any) {
        console.error('Login client error:', error);
        next(errorHandler(500, "Server error during login"));
    }
};

// @desc    Forgot password
// @route   POST /api/clients/forgot-password
// @access  Public
export const forgotClientPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email }: { email: string } = req.body;

        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }

        const client = await Client.findOne({ email: email.toLowerCase() });

        if (!client) {
            return next(errorHandler(404, "No client found with this email"));
        }

        // Generate reset token
        const resetToken: string = crypto.randomBytes(32).toString('hex');
        const resetExpiry: Date = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        client.resetPasswordToken = resetToken;
        client.resetPasswordExpiry = resetExpiry;
        await client.save();

        // Send password reset notification via email and SMS
        const notificationResult = await sendPasswordResetNotification(
            client.email, 
            client.phone || '', 
            resetToken, 
            `${client.firstName} ${client.lastName}`
        );
        console.log('Password reset notification result:', notificationResult);

        res.status(200).json({
            success: true,
            message: "Password reset instructions sent to your email and phone"
        });

    } catch (error: any) {
        console.error('Forgot password error:', error);
        next(errorHandler(500, "Server error during password reset request"));
    }
};

// @desc    Reset password
// @route   POST /api/clients/reset-password/:token
// @access  Public
export const resetClientPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { token } = req.params;
        const { newPassword }: { newPassword: string } = req.body;

        if (!token || !newPassword) {
            return next(errorHandler(400, "Token and new password are required"));
        }

        // Find client with valid reset token
        const client = await Client.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: new Date() }
        });

        if (!client) {
            return next(errorHandler(400, "Invalid or expired reset token"));
        }

        // Hash new password
        const hashedPassword: string = bcrypt.hashSync(newPassword, 12);

        // Update client password and clear reset fields
        client.password = hashedPassword;
        client.resetPasswordToken = undefined as any;
        client.resetPasswordExpiry = undefined as any;
        await client.save();

        res.status(200).json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error: any) {
        console.error('Reset password error:', error);
        next(errorHandler(500, "Server error during password reset"));
    }
};

// @desc    Get client profile
// @route   GET /api/clients/profile
// @access  Private
export const getClientProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const client = await Client.findById(req.user?._id)
            .select('-password -otpCode -resetPasswordToken');

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    phone: client.phone,
                    company: client.company,
                    address: client.address,
                    city: client.city,
                    country: client.country,
                    isActive: client.isActive,
                    emailVerified: client.emailVerified,
                    lastLoginAt: client.lastLoginAt,
                    createdAt: client.createdAt,
                    updatedAt: client.updatedAt
                }
            }
        });

    } catch (error: any) {
        console.error('Get client profile error:', error);
        next(errorHandler(500, "Server error while fetching client profile"));
    }
};

// @desc    Update client profile
// @route   PUT /api/clients/profile
// @access  Private
export const updateClientProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, phone, company, address, city, country, avatar }: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            company?: string;
            address?: string;
            city?: string;
            country?: string;
            avatar?: string | null;
        } = req.body;

        const client = await Client.findById(req.user?._id);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Update allowed fields
        if (firstName) client.firstName = firstName;
        if (lastName) client.lastName = lastName;
        if (phone) client.phone = phone;
        if (company) client.company = company;
        if (address) client.address = address;
        if (city) client.city = city;
        if (country) client.country = country;

        // Handle avatar upload via multipart/form-data
        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');

            if (client.avatarPublicId) {
                try {
                    await deleteFromCloudinary(client.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            client.avatar = uploadResult.url;
            client.avatarPublicId = uploadResult.public_id;
        } else if (
            avatar === null ||
            (typeof avatar === 'string' && avatar.trim().length === 0)
        ) {
            if (client.avatarPublicId) {
                try {
                    await deleteFromCloudinary(client.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            client.avatar = null;
            client.avatarPublicId = null;
        } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
            if (client.avatarPublicId) {
                try {
                    await deleteFromCloudinary(client.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            // Allow direct avatar URL updates (e.g., already uploaded images)
            client.avatar = avatar.trim();
            client.avatarPublicId = null;
        }

        await client.save();

        res.status(200).json({
            success: true,
            message: "Client profile updated successfully",
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    phone: client.phone,
                    company: client.company,
                    address: client.address,
                    city: client.city,
                    country: client.country,
                    avatar: client.avatar
                }
            }
        });

    } catch (error: any) {
        console.error('Update client profile error:', error);
        next(errorHandler(500, "Server error while updating client profile"));
    }
};

// @desc    Change client password
// @route   PUT /api/clients/change-password
// @access  Private
export const changeClientPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { currentPassword, newPassword }: {
            currentPassword: string;
            newPassword: string;
        } = req.body;

        if (!currentPassword || !newPassword) {
            return next(errorHandler(400, "Current password and new password are required"));
        }

        const client = await Client.findById(req.user?._id).select('+password');

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Verify current password
        const isCurrentPasswordValid: boolean = bcrypt.compareSync(currentPassword, client.password);

        if (!isCurrentPasswordValid) {
            return next(errorHandler(400, "Current password is incorrect"));
        }

        // Hash new password
        const hashedNewPassword: string = bcrypt.hashSync(newPassword, 12);

        client.password = hashedNewPassword;
        await client.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error: any) {
        console.error('Change password error:', error);
        next(errorHandler(500, "Server error while changing password"));
    }
};

// @desc    Get client dashboard
// @route   GET /api/clients/dashboard
// @access  Private
export const getClientDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const client = await Client.findById(req.user?._id);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Aggregate statistics from quotations, invoices, payments, projects
        const stats = {
            quotations: { total: 0, pending: 0, accepted: 0, rejected: 0 },
            invoices: { total: 0, paid: 0, unpaid: 0, overdue: 0 },
            projects: { total: 0, active: 0, completed: 0 },
            payments: { total: 0, totalAmount: 0 }
        };

        res.status(200).json({
            success: true,
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    company: client.company
                },
                stats
            }
        });

    } catch (error: any) {
        console.error('Get client dashboard error:', error);
        next(errorHandler(500, "Server error while fetching client dashboard"));
    }
};

// @desc    Get all clients (Admin only)
// @route   GET /api/clients
// @access  Private (Admin)
export const getAllClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;

        const query: any = {};

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
            limit: parseInt(limit as string),
            select: '-password -otpCode -resetPasswordToken'
        };

        const clients = await Client.find(query)
            .select(options.select)
            .sort({ createdAt: 'desc' })
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit);

        const total = await Client.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                clients: clients,
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
        console.error('Get all clients error:', error);
        next(errorHandler(500, "Server error while fetching clients"));
    }
};

// @desc    Get single client
// @route   GET /api/clients/:clientId
// @access  Private (Client or Admin)
export const getClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId).select('-password -otpCode -resetPasswordToken');

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        res.status(200).json({
            success: true,
            data: {
                client: client
            }
        });

    } catch (error: any) {
        console.error('Get client error:', error);
        next(errorHandler(500, "Server error while fetching client"));
    }
};

// @desc    Update client
// @route   PUT /api/clients/:clientId
// @access  Private (Client or Admin)
export const updateClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;
        const { firstName, lastName, phone, company, address, city, country, avatar }: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            company?: string;
            address?: string;
            city?: string;
            country?: string;
            avatar?: string | null;
        } = req.body;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Update allowed fields
        if (firstName) client.firstName = firstName;
        if (lastName) client.lastName = lastName;
        if (phone) client.phone = phone;
        if (company) client.company = company;
        if (address) client.address = address;
        if (city) client.city = city;
        if (country) client.country = country;

        // Handle avatar upload via multipart/form-data
        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');

            if (client.avatarPublicId) {
                try {
                    await deleteFromCloudinary(client.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            client.avatar = uploadResult.url;
            client.avatarPublicId = uploadResult.public_id;
        } else if (
            avatar === null ||
            (typeof avatar === 'string' && avatar.trim().length === 0)
        ) {
            if (client.avatarPublicId) {
                try {
                    await deleteFromCloudinary(client.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            client.avatar = null;
            client.avatarPublicId = null;
        } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
            if (client.avatarPublicId) {
                try {
                    await deleteFromCloudinary(client.avatarPublicId);
                } catch (deleteError) {
                    console.error('Failed to delete previous avatar:', deleteError);
                }
            }

            // Allow direct avatar URL updates (e.g., already uploaded images)
            client.avatar = avatar.trim();
            client.avatarPublicId = null;
        }

        await client.save();

        res.status(200).json({
            success: true,
            message: "Client profile updated successfully",
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    phone: client.phone,
                    company: client.company,
                    address: client.address,
                    city: client.city,
                    country: client.country,
                    avatar: client.avatar
                }
            }
        });

    } catch (error: any) {
        console.error('Update client error:', error);
        next(errorHandler(500, "Server error while updating client"));
    }
};

// @desc    Update client status (Admin only)
// @route   PUT /api/clients/:clientId/status
// @access  Private (Admin)
export const updateClientStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;
        const { isActive }: { isActive: boolean } = req.body;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        if (isActive !== undefined) client.isActive = isActive;

        await client.save();

        // Send notification to client if account is deactivated
        if (!client.isActive) {
            try {
                await createInAppNotification({
                    recipient: client._id.toString(),
                    recipientModel: 'Client',
                    category: 'general',
                    subject: 'Account Status Changed',
                    message: `Your account has been deactivated. Please contact support for assistance.`,
                    metadata: {
                        clientId: client._id,
                        isActive: false
                    },
                    io: (req.app as any).get('io')
                });
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

        res.status(200).json({
            success: true,
            message: "Client status updated successfully",
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    isActive: client.isActive
                }
            }
        });

    } catch (error: any) {
        console.error('Update client status error:', error);
        next(errorHandler(500, "Server error while updating client status"));
    }
};

// @desc    Delete client (Admin only)
// @route   DELETE /api/clients/:clientId
// @access  Private (Admin)
export const deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        await Client.findByIdAndDelete(clientId);

        res.status(200).json({
            success: true,
            message: "Client deleted successfully"
        });

    } catch (error: any) {
        console.error('Delete client error:', error);
        next(errorHandler(500, "Server error while deleting client"));
    }
};

// @desc    Get client statistics
// @route   GET /api/clients/:clientId/stats
// @access  Private (Client or Admin)
export const getClientStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Aggregate data from related collections
        const stats = {
            quotations: { total: 0, pending: 0, accepted: 0, rejected: 0 },
            invoices: { total: 0, paid: 0, unpaid: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
            projects: { total: 0, active: 0, completed: 0 },
            payments: { total: 0, totalAmount: 0 }
        };

        res.status(200).json({
            success: true,
            data: {
                client: {
                    id: client._id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    email: client.email,
                    company: client.company
                },
                stats: stats
            }
        });

    } catch (error: any) {
        console.error('Get client stats error:', error);
        next(errorHandler(500, "Server error while fetching client statistics"));
    }
};

// @desc    Get client projects
// @route   GET /api/clients/:clientId/projects
// @access  Private (Client or Admin)
export const getClientProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Fetch projects from Project model when implemented
        const projects: any[] = [];

        res.status(200).json({
            success: true,
            data: {
                projects: projects
            }
        });

    } catch (error: any) {
        console.error('Get client projects error:', error);
        next(errorHandler(500, "Server error while fetching client projects"));
    }
};

// @desc    Get client invoices
// @route   GET /api/clients/:clientId/invoices
// @access  Private (Client or Admin)
export const getClientInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Fetch invoices from Invoice model when implemented
        const invoices: any[] = [];

        res.status(200).json({
            success: true,
            data: {
                invoices: invoices
            }
        });

    } catch (error: any) {
        console.error('Get client invoices error:', error);
        next(errorHandler(500, "Server error while fetching client invoices"));
    }
};

// @desc    Get client payments
// @route   GET /api/clients/:clientId/payments
// @access  Private (Client or Admin)
export const getClientPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Fetch payments from Payment model when implemented
        const payments: any[] = [];

        res.status(200).json({
            success: true,
            data: {
                payments: payments
            }
        });

    } catch (error: any) {
        console.error('Get client payments error:', error);
        next(errorHandler(500, "Server error while fetching client payments"));
    }
};

// @desc    Get client quotations
// @route   GET /api/clients/:clientId/quotations
// @access  Private (Client or Admin)
export const getClientQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Fetch quotations from Quotation model when implemented
        const quotations: any[] = [];

        res.status(200).json({
            success: true,
            data: {
                quotations: quotations
            }
        });

    } catch (error: any) {
        console.error('Get client quotations error:', error);
        next(errorHandler(500, "Server error while fetching client quotations"));
    }
};

