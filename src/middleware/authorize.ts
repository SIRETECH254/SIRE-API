import { Request, Response, NextFunction } from 'express';

// Basic authorization middleware
export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Implementation will be added later
        next();
    };
};
