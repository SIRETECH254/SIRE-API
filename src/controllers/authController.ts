import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import { errorHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Role from '../models/Role';
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from '../services/internal/notificationService';

// Helper function to generate JWT tokens
const generateTokens = (user: any): { accessToken: string; refreshToken: string } => {
    const payload = {
        userId: user._id,
        role: user.role
    };

    const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' } as any
    );

    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

// Helper function to generate OTP
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, email, phone, password, role }: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            password: string;
            role?: 'super_admin' | 'finance' | 'project_manager' | 'staff';
        } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !phone || !password) {
            return next(errorHandler(400, "All fields are required"));
        }

        // Validate email format
        if (!validator.isEmail(email)) {
            return next(errorHandler(400, "Please provide a valid email"));
        }

        // Validate phone format
        if (!validator.isMobilePhone(phone)) {
            return next(errorHandler(400, "Please provide a valid phone number"));
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (existingUser) {
            return next(errorHandler(400, "User already exists with this email or phone"));
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword: string = bcrypt.hashSync(password, saltRounds);

        // Get default "client" role (or specified role if provided)
        let assignedRoles: any[] = [];
        if (role) {
            // If role is specified, find it by name
            const specifiedRole = await Role.findOne({ name: role.toLowerCase() });
            if (specifiedRole) {
                assignedRoles = [specifiedRole._id];
            } else {
                return next(errorHandler(400, `Role "${role}" not found`));
            }
        } else {
            // Default to "client" role
            const clientRole = await Role.findOne({ name: 'client' });
            if (!clientRole) {
                return next(errorHandler(500, "Default client role not found. Please run migration script first."));
            }
            assignedRoles = [clientRole._id];
        }

        // Generate OTP
        const otp: string = generateOTP();
        const otpExpiry: Date = new Date(Date.now() + (parseInt(process.env.OTP_EXP_MINUTES || '10')) * 60 * 1000);

        // Create user
        const user = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            roles: assignedRoles,
            otpCode: otp,
            otpExpiry,
            emailVerified: false
        });

        await user.save();

        // Send OTP via email and SMS
        const notificationResult = await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`);
        console.log('OTP notification result:', notificationResult);

        // Populate roles for response
        await user.populate('roles', 'name displayName');

        res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify your email with the OTP sent.",
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                roles: user.roles,
                emailVerified: user.emailVerified
            }
        });

    } catch (error: any) {
        console.error('Register error:', error);
        next(errorHandler(500, "Server error during registration"));
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

        // Find user by email or phone (select otpCode and otpExpiry explicitly)
        const query: any = email ? { email: email.toLowerCase() } : { phone };
        const user = await User.findOne(query).select('+otpCode +otpExpiry');

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Check if OTP has expired
        if (user.otpExpiry && user.otpExpiry < new Date()) {
            return next(errorHandler(400, "OTP has expired. Please request a new one"));
        }

        // Check if OTP is correct (trim whitespace for safety)
        if (user.otpCode !== otp.trim()) {
            return next(errorHandler(400, "Incorrect OTP code"));
        }

        // Update user verification status
        user.emailVerified = true;
        user.otpCode = undefined as any;
        user.otpExpiry = undefined as any;
        await user.save();

        // Populate roles before generating tokens
        await user.populate('roles', 'name displayName');

        // Send welcome notification
        const welcomeResult = await sendWelcomeNotification(user.email, user.phone || '', `${user.firstName} ${user.lastName}`);
        console.log('Welcome notification result:', welcomeResult);

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    roles: user.roles,
                    emailVerified: user.emailVerified
                },
                accessToken,
                refreshToken
            }
        });

    } catch (error: any) {
        console.error('Verify OTP error:', error);
        next(errorHandler(500, "Server error during OTP verification"));
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, phone }: { email?: string; phone?: string } = req.body;

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"));
        }

        // Find user by email or phone
        const query: any = email ? { email: email.toLowerCase() } : { phone };
        const user = await User.findOne(query);

        if (!user) {
            return next(errorHandler(404, "User not found"));
        }

        // Check if user is already verified
        if (user.emailVerified) {
            return next(errorHandler(400, "Account is already verified"));
        }

        // Generate new OTP
        const otp: string = generateOTP();
        const otpExpiry: Date = new Date(Date.now() + (parseInt(process.env.OTP_EXP_MINUTES || '10')) * 60 * 1000);

        // Update user with new OTP
        user.otpCode = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP via email and SMS
        const notificationResult = await sendOTPNotification(user.email, user.phone || '', otp, `${user.firstName} ${user.lastName}`);
        console.log('Resend OTP notification result:', notificationResult);

        res.status(200).json({
            success: true,
            message: "OTP has been resent to your email and phone",
            data: {
                userId: user._id,
                email: user.email,
                phone: user.phone,
                otpExpiry: otpExpiry
            }
        });

    } catch (error: any) {
        console.error('Resend OTP error:', error);
        next(errorHandler(500, "Server error during OTP resend"));
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

        // Find user by email or phone with roles populated
        const query: any = email ? { email: email.toLowerCase() } : { phone };
        const user = await User.findOne(query).select('+password').populate('roles', 'name displayName');

        if (!user) {
            if (email) {
                return next(errorHandler(401, "Email does not exist"));
            } else {
                return next(errorHandler(401, "Phone number does not exist"));
            }
        }

        // Check password
        const isPasswordValid: boolean = bcrypt.compareSync(password, user.password);

        if (!isPasswordValid) {
            return next(errorHandler(401, "Password is incorrect"));
        }

        // Check if user is verified
        if (!user.emailVerified) {
            return next(errorHandler(403, "Please verify your email before logging in"));
        }

        // Check if user is active
        if (!user.isActive) {
            return next(errorHandler(403, "Account is deactivated. Please contact support."));
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    roles: user.roles,
                    emailVerified: user.emailVerified
                },
                accessToken,
                refreshToken
            }
        });

    } catch (error: any) {
        console.error('Login error:', error);
        next(errorHandler(500, "Server error during login"));
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // In a production app, you might want to blacklist the token
        // For now, we'll just send a success response
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error: any) {
        console.error('Logout error:', error);
        next(errorHandler(500, "Server error during logout"));
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email }: { email: string } = req.body;

        if (!email) {
            return next(errorHandler(400, "Email is required"));
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return next(errorHandler(404, "No user found with this email"));
        }

        // Generate reset token
        const resetToken: string = crypto.randomBytes(32).toString('hex');
        const resetExpiry: Date = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiry = resetExpiry;
        await user.save();

        // Send password reset notification via email and SMS
        const notificationResult = await sendPasswordResetNotification(
            user.email, 
            user.phone || '', 
            resetToken, 
            `${user.firstName} ${user.lastName}`
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
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { token } = req.params;
        const { newPassword }: { newPassword: string } = req.body;

        if (!token || !newPassword) {
            return next(errorHandler(400, "Token and new password are required"));
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: new Date() }
        });

        if (!user) {
            return next(errorHandler(400, "Invalid or expired reset token"));
        }

        // Hash new password
        const hashedPassword: string = bcrypt.hashSync(newPassword, 12);

        // Update user password and clear reset fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined as any;
        user.resetPasswordExpiry = undefined as any;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error: any) {
        console.error('Reset password error:', error);
        next(errorHandler(500, "Server error during password reset"));
    }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { refreshToken }: { refreshToken: string } = req.body;

        if (!refreshToken) {
            return next(errorHandler(400, "Refresh token is required"));
        }

        // Verify refresh token
        const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET as string);

        // Check if user still exists with roles populated
        const user = await User.findById(decoded.userId).populate('roles', 'name displayName');

        if (!user || !user.isActive) {
            return next(errorHandler(403, "User not found or inactive"));
        }

        // Generate new tokens
        const tokens = generateTokens(user);

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: tokens
        });

    } catch (error: any) {
        console.error('Refresh token error:', error);
        next(errorHandler(403, "Invalid refresh token"));
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
                    createdAt: user.createdAt
                }
            }
        });

    } catch (error: any) {
        console.error('Get me error:', error);
        next(errorHandler(500, "Server error while fetching user profile"));
    }
};
