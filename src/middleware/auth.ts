import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import Client from "../models/Client";
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
        const user = await User.findById(decoded.userId);

        if (!user) {
            return next(errorHandler(401, "User not found"));
        }

        if (!user.isActive) {
            return next(errorHandler(401, "User account is deactivated"));
        }

        // Add user to request object
        req.user = user as IUserResponse;
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

            // Check if user has any of the allowed roles
            const userRole = req.user.role || '';

            if (!allowedRoles.includes(userRole)) {
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

        if (req.user.role !== 'super_admin') {
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
            if (req.user.role === 'super_admin') {
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

        // Get user
        const user = await User.findById(decoded.userId);

        if (user && user.isActive) {
            req.user = user as IUserResponse;
        }

        next();
    } catch (error: any) {
        // Don't fail on token errors, just continue without user
        next();
    }
};

// Middleware to authenticate Client token (for client-specific routes)
export const authenticateClientToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return next(errorHandler(401, "Access token required"));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

        // Try to find client first
        let client = await Client.findById(decoded.userId);

        if (client) {
            if (!client.isActive) {
                return next(errorHandler(401, "Client account is deactivated"));
            }
            // Add client to request object as user (for compatibility)
            req.user = {
                _id: client._id.toString(),
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                role: 'client' as any,
                phone: client.phone,
                isActive: client.isActive,
                emailVerified: client.emailVerified,
                createdAt: client.createdAt,
                updatedAt: client.updatedAt,
                fullName: `${client.firstName} ${client.lastName}`
            } as IUserResponse;
            return next();
        }

        // If not a client, try to find user
        const user = await User.findById(decoded.userId);

        if (!user) {
            return next(errorHandler(401, "User or client not found"));
        }

        if (!user.isActive) {
            return next(errorHandler(401, "User account is deactivated"));
        }

        // Add user to request object
        req.user = user as IUserResponse;
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
