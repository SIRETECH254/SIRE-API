import { Request, Response, NextFunction } from 'express';

// Basic validation middleware
export const validate = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Implementation will be added later
        next();
    };
};
