import jwt from 'jsonwebtoken';

// Helper function to generate JWT tokens
export const generateTokens = (user: any): { accessToken: string; refreshToken: string } => {
    // Extract role IDs from user.roles (can be ObjectId or populated)
    const roleIds = user.roles 
        ? user.roles.map((role: any) => role._id ? role._id.toString() : role.toString())
        : [];

    const payload = {
        userId: user._id,
        roleIds: roleIds,
        userType: "user"
    };

    const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as any
    );

    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

// Helper function to generate OTP
export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
