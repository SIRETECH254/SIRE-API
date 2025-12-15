import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { errorHandler } from "./errorHandler";
import type { IUserResponse } from "../types/index";

// Extend Request interface to include user
declare global {
    namespace Express {
        interface Request {
            user?: IUserResponse;
        }
    }
}

// Middleware to authenticate JWT token
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return next(errorHandler(401, "Access token required"));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

        // Get user with roles populated
        const user = await User.findById(decoded.userId).populate('roles', 'name displayName');

        if (!user) {
            return next(errorHandler(401, "User not found"));
        }

        if (!user.isActive) {
            return next(errorHandler(401, "User account is deactivated"));
        }

        // Extract role names for response
        const roleNames = user.roles && Array.isArray(user.roles)
            ? user.roles.map((role: any) => role.name || role)
            : [];

        // Add user to request object with role names
        req.user = {
            ...user.toObject(),
            roleNames
        } as IUserResponse;
        next();

    } catch (error: any) {
        if (error.name === 'JsonWebTokenError') {
            return next(errorHandler(401, "Invalid token"));
        } else if (error.name === 'TokenExpiredError') {
            return next(errorHandler(401, "Token expired"));
        }
        return next(errorHandler(500, "Authentication error"));
    }
};

// Middleware to authorize specific roles
export const authorizeRoles = (allowedRoles: string[] = []): ((req: Request, res: Response, next: NextFunction) => void) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (!req.user) {
                return next(errorHandler(401, "Authentication required"));
            }

            // Get user role names from populated roles or from roleNames field
            const userRoleNames = req.user.roleNames || [];

            // Check if user has any of the allowed roles
            const hasAllowedRole = allowedRoles.some(role => userRoleNames.includes(role));

            if (!hasAllowedRole) {
                return next(errorHandler(403, "Insufficient permissions"));
            }

            next();
        } catch (error: any) {
            return next(errorHandler(500, "Authorization error"));
        }
    };
};

// Middleware to check if user is admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    try {
        if (!req.user) {
            return next(errorHandler(401, "Authentication required"));
        }

        // Check if user has super_admin role
        const userRoleNames = req.user.roleNames || [];
        if (!userRoleNames.includes('super_admin')) {
            return next(errorHandler(403, "Admin access required"));
        }

        next();
    } catch (error: any) {
        return next(errorHandler(500, "Authorization error"));
    }
};

// Middleware to check if user owns the resource or is admin
export const requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (!req.user) {
                return next(errorHandler(401, "Authentication required"));
            }

            // Super admin can access everything
            const userRoleNames = req.user.roleNames || [];
            if (userRoleNames.includes('super_admin')) {
                return next();
            }

            // Check if user owns the resource
            const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

            if (!resourceUserId) {
                return next(errorHandler(400, "Resource user ID not found"));
            }

            if (req.user._id.toString() !== resourceUserId.toString()) {
                return next(errorHandler(403, "Access denied"));
            }

            next();
        } catch (error: any) {
            return next(errorHandler(500, "Authorization error"));
        }
    };
};

// Middleware to verify email
export const requireEmailVerification = (req: Request, res: Response, next: NextFunction): void => {
    try {
        if (!req.user) {
            return next(errorHandler(401, "Authentication required"));
        }

        if (!req.user.emailVerified) {
            return next(errorHandler(403, "Email verification required"));
        }

        next();
    } catch (error: any) {
        return next(errorHandler(500, "Verification error"));
    }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next();
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

        // Get user with roles populated
        const user = await User.findById(decoded.userId).populate('roles', 'name displayName');

        if (user && user.isActive) {
            const roleNames = user.roles && Array.isArray(user.roles)
                ? user.roles.map((role: any) => role.name || role)
                : [];
            req.user = {
                ...user.toObject(),
                roleNames
            } as IUserResponse;
        }

        next();
    } catch (error: any) {
        // Don't fail on token errors, just continue without user
        next();
    }
};

