
# 🔐 SIRE Tech API - Authentication System Documentation

## 📋 Table of Contents
- [Authentication Overview](#authentication-overview)
- [Authentication Controller](#authentication-controller)
- [Authentication Routes](#authentication-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)

---

## 🔑 Authentication Overview

The SIRE Tech API uses JWT (JSON Web Tokens) for authentication with a unified role-based access control (RBAC) system. All users (including former clients) are managed through a single User model with role assignments. The system incorporates OTP verification and comprehensive security features.

### Authentication Flow
1. **Registration/Login** → Generate JWT tokens with role-based payload (roleIds array)
2. **OTP Verification** → Email/SMS verification for new accounts
3. **Token Validation** → Middleware verifies tokens and user status
4. **Role Authorization** → Check user roles and permissions
5. **Protected Routes** → Access granted based on roles and verification status

### Unified User System
- **Single User Model** - All users (clients, admins, staff) use the same User model
- **Role-Based Access** - Users have roles array referencing Role documents
- **Default Role** - New users automatically receive "client" role on registration
- **Multiple Roles** - Users can have multiple roles assigned
- **Presaved Roles** - Roles are stored in database and fetched dynamically

### User Roles
- `client` - Default role for clients/customers (assigned automatically on registration)
- `super_admin` - Full system access, can manage all users and system settings
- `finance` - Financial operations access, invoice/payment management
- `project_manager` - Project management access, team assignment, milestone tracking
- `staff` - Basic admin access, client management, service catalog

### Security Features
- **OTP Verification** - Email and SMS verification for new accounts
- **Password Reset** - Secure token-based password reset flow
- **Refresh Tokens** - Separate refresh token mechanism for security
- **Account Status** - Active/inactive user management
- **Email Verification** - Required for sensitive operations

---

## 🎮 Authentication Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import { errorHandler } from '../middleware/errorHandler';
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from '../services/notificationService';
import User, { IUser } from '../models/User';
import { generateTokens, generateOTP } from '../utils/authHelpers';
```

### Functions Overview

#### `register(userData)`
**Purpose:** Register new user with OTP verification
**Access:** Public (for client registration) or Super admin (for admin creation)
**Validation:**
- Email uniqueness check
- Password strength validation
- Phone number format validation
- Role assignment validation (optional, defaults to "client")
**Process:**
- Generate and hash password
- Assign default "client" role (or specified role if provided)
- Create OTP code with expiry
- Send OTP via email and SMS
- Set user as unverified initially
**Response:** User data without password, verification status, with roles array

**Controller Implementation:**
```typescript
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { firstName, lastName, email, phone, password, role }: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
            password: string;
            role?: string;
        } = req.body

        // Validation
        if (!firstName || !lastName || !email || !phone || !password) {
            return next(errorHandler(400, "All fields are required"))
        }

        // Validate email format
        if (!validator.isEmail(email)) {
            return next(errorHandler(400, "Please provide a valid email"))
        }

        // Validate phone format
        if (!validator.isMobilePhone(phone)) {
            return next(errorHandler(400, "Please provide a valid phone number"))
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        })

        if (existingUser) {
            return next(errorHandler(400, "User already exists with this email or phone"))
        }

        // Hash password
        const saltRounds = 12
        const hashedPassword = bcrypt.hashSync(password, saltRounds)

        // Generate OTP
        const otp: string = generateOTP()
        const otpExpiry: Date = new Date(Date.now() + (parseInt(process.env.OTP_EXP_MINUTES || '10')) * 60 * 1000)

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

        // Create user
        const user: IUser = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            roles: assignedRoles,
            otpCode: otp,
            otpExpiry,
            emailVerified: false
        })

        await user.save()

        // Send OTP via email and SMS
        const notificationResult: any = await sendOTPNotification(email, phone, otp, `${firstName} ${lastName}`)
        console.log('OTP notification result:', notificationResult)

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
        })

    } catch (error: any) {
        console.error('Register error:', error)
        next(errorHandler(500, "Server error during registration"))
    }
}
```


#### `verifyOTP(email/phone, otp)`
**Purpose:** Verify OTP and activate account
**Access:** Public
**Validation:**
- OTP code match
- OTP expiration check
- User existence verification
**Process:**
- Verify OTP code and expiry
- Mark user as verified
- Clear OTP fields
- Send welcome notification
- Generate JWT tokens
**Response:** User data + JWT tokens

**Controller Implementation:**
```typescript
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, phone, otp }: {
            email?: string;
            phone?: string;
            otp: string;
        } = req.body

        if (!otp) {
            return next(errorHandler(400, "OTP is required"))
        }

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"))
        }

        // Find user by email or phone (select otpCode and otpExpiry explicitly)
        const query = email ? { email: email.toLowerCase() } : { phone }
        const user = await User.findOne(query).select('+otpCode +otpExpiry')

        if (!user) {
            return next(errorHandler(404, "User not found"))
        }

        // Check if OTP has expired
        if (user.otpExpiry && user.otpExpiry < new Date()) {
            return next(errorHandler(400, "OTP has expired. Please request a new one"))
        }

        // Check if OTP is correct (trim whitespace for safety)
        if (user.otpCode !== otp.trim()) {
            return next(errorHandler(400, "Incorrect OTP code"))
        }

        // Update user verification status
        user.emailVerified = true
        user.otpCode = undefined
        user.otpExpiry = undefined
        await user.save()

        // Send welcome notification
        const welcomeResult = await sendWelcomeNotification(user.email, user.phone, `${user.firstName} ${user.lastName}`)
        console.log('Welcome notification result:', welcomeResult)

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user)

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
                    role: user.role,
                    emailVerified: user.emailVerified
                },
                accessToken,
                refreshToken
            }
        })

    } catch (error) {
        console.error('Verify OTP error:', error)
        next(errorHandler(500, "Server error during OTP verification"))
    }
}
```

#### `resendOTP(email/phone)`
**Purpose:** Resend OTP for verification
**Access:** Public
**Validation:**
- User existence check
- Verification status check
**Process:**
- Generate new OTP with expiry
- Send via email and SMS
- Update user record
**Response:** Confirmation message

**Controller Implementation:**
```typescript
export const resendOTP = async (req, res, next) => {
    try {
        const { email, phone } = req.body

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"))
        }

        // Find user by email or phone
        const query = email ? { email: email.toLowerCase() } : { phone }
        const user = await User.findOne(query)

        if (!user) {
            return next(errorHandler(404, "User not found"))
        }

        // Check if user is already verified
        if (user.emailVerified) {
            return next(errorHandler(400, "Account is already verified"))
        }

        // Generate new OTP
        const otp = generateOTP()
        const otpExpiry = new Date(Date.now() + (parseInt(process.env.OTP_EXP_MINUTES) || 10) * 60 * 1000)

        // Update user with new OTP
        user.otpCode = otp
        user.otpExpiry = otpExpiry
        await user.save()

        // Send OTP via email and SMS
        const notificationResult = await sendOTPNotification(user.email, user.phone, otp, `${user.firstName} ${user.lastName}`)
        console.log('Resend OTP notification result:', notificationResult)

        res.status(200).json({
            success: true,
            message: "OTP has been resent to your email and phone",
            data: {
                userId: user._id,
                email: user.email,
                phone: user.phone,
                otpExpiry: otpExpiry
            }
        })

    } catch (error) {
        console.error('Resend OTP error:', error)
        next(errorHandler(500, "Server error during OTP resend"))
    }
}
```

#### `login(credentials)`
**Purpose:** Authenticate admin users
**Validation:**
- Email/phone and password match
- Account active status
- Email verification status
- Account activation status
**Process:**
- Verify credentials
- Update last login timestamp
- Generate JWT tokens with role payload
**Response:** User data + JWT tokens

**Controller Implementation:**
```typescript
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, phone, password }: {
            email?: string;
            phone?: string;
            password: string;
        } = req.body

        if (!password) {
            return next(errorHandler(400, "Password is required"))
        }

        if (!email && !phone) {
            return next(errorHandler(400, "Email or phone is required"))
        }

        // Find user by email or phone
        const query: any = email ? { email: email.toLowerCase() } : { phone }
        const user: IUser | null = await User.findOne(query)

        if (!user) {
            if (email) {
                return next(errorHandler(401, "Email does not exist"))
            } else {
                return next(errorHandler(401, "Phone number does not exist"))
            }
        }

        // Check password
        const isPasswordValid: boolean = bcrypt.compareSync(password, user.password)

        if (!isPasswordValid) {
            return next(errorHandler(401, "Password is incorrect"))
        }

        // Check if user is verified
        if (!user.emailVerified) {
            return next(errorHandler(403, "Please verify your email before logging in"))
        }

        // Check if user is active
        if (!user.isActive) {
            return next(errorHandler(403, "Account is deactivated. Please contact support."))
        }

        // Update last login
        user.lastLoginAt = new Date()
        await user.save()

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user)

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
        })

    } catch (error) {
        console.error('Login error:', error)
        next(errorHandler(500, "Server error during login"))
    }
}
```

#### `logout()`
**Purpose:** Invalidate current session
**Implementation:** Client-side token removal
**Security:** Token blacklisting (optional)

**Controller Implementation:**
```typescript
export const logout = async (req, res, next) => {
    try {
        // In a production app, you might want to blacklist the token
        // For now, we'll just send a success response
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        })

    } catch (error) {
        console.error('Logout error:', error)
        next(errorHandler(500, "Server error during logout"))
    }
}
```

#### `forgotPassword(email)`
**Purpose:** Send password reset instructions
**Process:**
- Generate secure reset token
- Set token expiry (15 minutes)
- Send reset instructions via email and SMS
- Store token in user record
**Response:** Confirmation message

**Controller Implementation:**
```typescript
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body

        if (!email) {
            return next(errorHandler(400, "Email is required"))
        }

        const user = await User.findOne({ email: email.toLowerCase() })

        if (!user) {
            return next(errorHandler(404, "No user found with this email"))
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex')
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

        user.resetPasswordToken = resetToken
        user.resetPasswordExpiry = resetExpiry
        await user.save()

        // Send password reset notification via email and SMS
        const notificationResult = await sendPasswordResetNotification(
            user.email, 
            user.phone, 
            resetToken, 
            `${user.firstName} ${user.lastName}`
        )

        console.log('Password reset notification result:', notificationResult)

        res.status(200).json({
            success: true,
            message: "Password reset instructions sent to your email and phone"
        })

    } catch (error) {
        console.error('Forgot password error:', error)
        next(errorHandler(500, "Server error during password reset request"))
    }
}
```

#### `resetPassword(token, newPassword)`
**Purpose:** Reset password with token
**Validation:**
- Valid and non-expired token
- Password strength requirements
- Token existence check
**Process:**
- Verify token validity
- Hash new password
- Clear reset token fields
- Update user password
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params
        const { newPassword } = req.body

        if (!token || !newPassword) {
            return next(errorHandler(400, "Token and new password are required"))
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: new Date() }
        })

        if (!user) {
            return next(errorHandler(400, "Invalid or expired reset token"))
        }

        // Hash new password
        const hashedPassword = bcrypt.hashSync(newPassword, 12)

        // Update user password and clear reset fields
        user.password = hashedPassword
        user.resetPasswordToken = undefined
        user.resetPasswordExpiry = undefined
        await user.save()

        res.status(200).json({
            success: true,
            message: "Password reset successfully"
        })

    } catch (error) {
        console.error('Reset password error:', error)
        next(errorHandler(500, "Server error during password reset"))
    }
}
```

#### `refreshToken(refreshToken)`
**Purpose:** Generate new access token
**Security:** Refresh token validation
**Process:**
- Verify refresh token
- Check user existence and status
- Generate new access and refresh tokens
**Response:** New token pair

**Controller Implementation:**
```typescript
export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body

        if (!refreshToken) {
            return next(errorHandler(400, "Refresh token is required"))
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)

        // Check if user still exists
        const user = await User.findById(decoded.userId)

        if (!user || !user.isActive) {
            return next(errorHandler(403, "User not found or inactive"))
        }

        // Generate new tokens
        const tokens = generateTokens(user)

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: tokens
        })

    } catch (error) {
        console.error('Refresh token error:', error)
        next(errorHandler(403, "Invalid refresh token"))
    }
}
```

#### `getMe()`
**Purpose:** Get current user profile
**Access:** Authenticated users only
**Response:** Complete user profile without sensitive data

**Controller Implementation:**
```typescript
export const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('-password -otpCode -resetPasswordToken')

        if (!user) {
            return next(errorHandler(404, "User not found"))
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
                    createdAt: user.createdAt
                }
            }
        })

    } catch (error) {
        console.error('Get me error:', error)
        next(errorHandler(500, "Server error while fetching user profile"))
    }
}
```


---

## 🛣️ Authentication Routes

### Base Path: `/api/auth`

```typescript
POST   /register                 // Register new user with OTP
POST   /verify-otp               // Verify OTP and activate account
POST   /resend-otp               // Resend OTP for verification
POST   /login                    // User login (email/phone + password)
POST   /logout                   // Logout user
POST   /forgot-password          // Request password reset
POST   /reset-password/:token    // Reset password with token
POST   /refresh-token            // Refresh access token
GET    /me                       // Get current user profile
```

### Router Implementation

**File: `src/routes/authRoutes.ts`**

```typescript
import express from 'express';
import {
    register,
    verifyOTP,
    resendOTP,
    login,
    logout,
    forgotPassword,
    resetPassword,
    refreshToken,
    getMe
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with OTP verification
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and activate account
 * @access  Public
 */
router.post('/verify-otp', verifyOTP);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP for verification
 * @access  Public
 */
router.post('/resend-otp', resendOTP);

/**
 * @route   POST /api/auth/login
 * @desc    User login (email/phone + password)
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', resetPassword);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, getMe);

export default router;
```

### Route Details

#### `POST /api/auth/register`
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "admin@siretech.com",
  "password": "securePassword123",
  "phone": "+254712345678",
  "role": "finance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email with the OTP sent.",
  "data": {
    "userId": "...",
    "email": "admin@siretech.com",
    "phone": "+254712345678",
    "isVerified": false
  }
}
```

#### `POST /api/auth/verify-otp`
**Body:**
```json
{
  "email": "admin@siretech.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@siretech.com",
      "phone": "+254712345678",
      "role": "finance",
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `POST /api/auth/resend-otp`
**Body:**
```json
{
  "email": "admin@siretech.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP has been resent to your email and phone",
  "data": {
    "userId": "...",
    "email": "admin@siretech.com",
    "phone": "+254712345678",
    "otpExpiry": "2025-01-01T01:00:00.000Z"
  }
}
```

#### `POST /api/auth/login`
**Body:**
```json
{
  "email": "admin@siretech.com",
  "password": "securePassword123"
}
```
**Alternative (phone login):**
```json
{
  "phone": "+254712345678",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@siretech.com",
      "phone": "+254712345678",
      "avatar": "https://cloudinary.com/...",
      "role": "finance",
      "isVerified": true,
      "lastLoginAt": "2025-01-01T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `POST /api/auth/logout`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### `POST /api/auth/forgot-password`
**Body:**
```json
{
  "email": "admin@siretech.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email and phone"
}
```

#### `POST /api/auth/reset-password/:token`
**URL Parameter:** `token` - The reset token received via email

**Body:**
```json
{
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

#### `POST /api/auth/refresh-token`
**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `GET /api/auth/me`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@siretech.com",
      "phone": "+254712345678",
      "avatar": "https://cloudinary.com/...",
      "role": "finance",
      "isActive": true,
      "emailVerified": true,
      "lastLoginAt": "2025-01-01T12:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```


---

## 🛡️ Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token
**Process:**
1. Extract token from Authorization header
2. Verify token signature
3. Check token expiration
4. Find user in database
5. Verify user is active
6. Add user to request object

**Usage:**
```typescript
router.get('/protected', authenticateToken, controllerFunction);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check user permissions
**Parameters:**
- `allowedRoles` - Array of permitted roles

**Usage:**
```typescript
router.get('/admin-only', 
  authenticateToken, 
  authorizeRoles(['super_admin', 'finance']), 
  controllerFunction
);
```

#### `requireAdmin`
**Purpose:** Super admin access only
**Usage:**
```typescript
router.delete('/user/:id', 
  authenticateToken, 
  requireAdmin, 
  deleteUser
);
```

#### `requireOwnershipOrAdmin`
**Purpose:** User owns resource OR is admin
**Usage:**
```typescript
router.put('/profile/:id', 
  authenticateToken, 
  requireOwnershipOrAdmin('userId'), 
  updateProfile
);
```

#### `requireEmailVerification`
**Purpose:** Require verified email
**Usage:**
```typescript
router.post('/sensitive-action', 
  authenticateToken, 
  requireEmailVerification, 
  controllerFunction
);
```

#### `optionalAuth`
**Purpose:** Optional authentication (doesn't fail if no token)
**Usage:**
```typescript
router.get('/public-with-user-info', 
  optionalAuth, 
  controllerFunction
);
```

---

## 📝 API Examples

### Complete Authentication Flow

#### 1. Register User with OTP
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "admin@siretech.com",
    "password": "securePassword123",
    "phone": "+254712345678",
    "role": "finance"
  }'
```

#### 2. Verify OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@siretech.com",
    "otp": "123456"
  }'
```

#### 3. Login (Email or Phone)
```bash
# Email login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@siretech.com",
    "password": "securePassword123"
  }'

# Phone login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+254712345678",
    "password": "securePassword123"
  }'
```

#### 4. Access Protected Route
```bash
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <access_token>"
```

#### 5. Update Profile
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+254712345679",
    "country": "Kenya",
    "timezone": "Africa/Nairobi"
  }'
```

#### 6. Change Password
```bash
curl -X PUT http://localhost:5000/api/users/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword123"
  }'
```

#### 7. Password Reset Flow
```bash
# Request reset
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@siretech.com"}'

# Reset password
curl -X POST http://localhost:5000/api/auth/reset-password/<reset_token> \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "newSecurePassword123"}'
```

#### 8. Admin Create Customer
```bash
curl -X POST http://localhost:5000/api/users/admin-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "Jane Customer",
    "email": "jane@customer.com",
    "phone": "+254712345680",
    "roles": ["customer"]
  }'
```

#### 9. Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

---

## 🔒 Security Features

### Password Security
- **Hashing:** bcryptjs with 12 salt rounds
- **Minimum Length:** 6 characters
- **Hidden by Default:** Password field excluded from queries
- **Password Reset:** Secure token-based reset with 15-minute expiry
- **Change Password:** Current password verification required

### JWT Security
- **Secret Key:** Environment variable
- **Access Token:** Short-lived (15 minutes default)
- **Refresh Token:** Long-lived (7 days) for renewal
- **Token Payload:** 
  - `userId` - User ID
  - `roleIds` - Array of role IDs assigned to user
  - `userType` - Always "user" for unified system
- **Token Verification:** Signature and expiry validation

### OTP Verification
- **6-Digit Code:** Random numeric OTP generation
- **Dual Channel:** Email and SMS delivery
- **Expiry Time:** Configurable (default 10 minutes)
- **Resend Protection:** Rate limiting on resend requests
- **Account Activation:** Required before login access


### Access Control
- **Role-Based:** Granular permissions per role
- **Resource Ownership:** Users can only access their own data
- **Admin Override:** Super admin can access everything
- **Account Status:** Active/inactive user management
- **Email Verification:** Required for sensitive operations

### Input Validation
- **Email Format:** Regex validation with uniqueness
- **Phone Format:** International format validation
- **Required Fields:** Server-side validation
- **Unique Constraints:** Database-level uniqueness
- **OTP Format:** 6-digit numeric validation

### Rate Limiting
- **Login Attempts:** Prevent brute force attacks
- **OTP Requests:** Limit OTP generation and resend
- **Password Reset:** Limit reset requests
- **API Calls:** General rate limiting per endpoint

### Security Headers
- **CORS:** Configured origins with credentials
- **Helmet:** Security headers for XSS protection
- **HTTPS:** Required in production
- **Token Storage:** Secure HTTP-only cookies (optional)

---

## 🚨 Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token required",
  "error": "No token provided in Authorization header"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions",
  "error": "User role 'staff' not allowed for this action"
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Email format is invalid"
}
```

#### 409 Conflict
```json
{
  "success": false,
  "message": "Email already exists",
  "error": "User with this email is already registered"
}
```

---

## 📊 Database Indexes

### Performance Optimizations
```typescript
// Email index for fast login lookups
userSchema.index({ email: 1 });

// Role index for role-based queries
userSchema.index({ role: 1 });

// Status index for active user filtering
userSchema.index({ isActive: 1 });

// Compound indexes for complex queries
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
```

---

## 🧪 Testing Considerations

### Unit Tests
- **Model Validation:** Test schema constraints
- **Password Hashing:** Verify bcrypt functionality
- **Virtual Fields:** Test computed properties

### Integration Tests
- **Authentication Flow:** Login/logout process
- **Authorization:** Role-based access control
- **Token Validation:** JWT verification

### Security Tests
- **Password Strength:** Weak password rejection
- **Token Expiration:** Expired token handling
- **SQL Injection:** Input sanitization
- **Rate Limiting:** Excessive request blocking

---

## 📈 Performance Monitoring

### Key Metrics
- **Login Success Rate:** Authentication effectiveness
- **Token Validation Time:** Middleware performance
- **Database Query Time:** User lookup efficiency
- **Error Rate:** System reliability

### Optimization Tips
- **Connection Pooling:** MongoDB connections
- **Token Caching:** Reduce database hits
- **Index Usage:** Monitor query performance
- **Rate Limiting:** Prevent abuse

---

## 🔄 Future Enhancements

### Planned Features
- **Multi-Factor Authentication:** Enhanced MFA with TOTP
- **Session Management:** Device tracking and management
- **Audit Logging:** Comprehensive user action tracking
- **Password Policies:** Advanced requirements and history
- **Account Lockout:** Failed attempt protection with progressive delays
- **Email Templates:** Customizable email templates for notifications
- **SMS Integration:** Enhanced SMS delivery with multiple providers

### Security Improvements
- **JWT Blacklisting:** Token invalidation and revocation
- **Device Fingerprinting:** Suspicious activity detection
- **Geolocation Validation:** Login location verification
- **Biometric Authentication:** Mobile app integration
- **Risk Assessment:** Login risk scoring based on behavior
- **Security Notifications:** Real-time security alerts
- **API Key Management:** For third-party integrations

---

## 📧 Notification Services

### Email & SMS Integration
The authentication system integrates with notification services for OTP delivery and password reset:

#### OTP Notification Service
```typescript
// Send OTP via email and SMS
const notificationResult = await sendOTPNotification(email, phone, otp, name)
```

#### Password Reset Notification
```typescript
// Send password reset instructions
const notificationResult = await sendPasswordResetNotification(
    user.email, 
    user.phone, 
    resetToken, 
    user.name
)
```

#### Welcome Notification
```typescript
// Send welcome message after verification
const welcomeResult = await sendWelcomeNotification(user.email, user.phone, user.name)
```

### Required Environment Variables
```env
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# OTP Configuration
OTP_EXP_MINUTES=10


# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# SMS Configuration (Africa's Talking)
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Notification Service Implementation
The system supports multiple notification channels:
- **Email:** Via Nodemailer with SMTP configuration
- **SMS:** Via Africa's Talking API
- **In-App:** Via Socket.io for real-time notifications
- **Push:** Via Firebase Cloud Messaging (future enhancement)

---

## 🔧 Helper Functions

### User Role Assignment
```typescript
// Assign default customer role to new users
export const assignDefaultRole = async (userId) => {
    try {
        const customerRole = await Role.findOne({ name: 'customer' })
        
        if (customerRole) {
            const user = await User.findById(userId)
            
            if (user && user.roles.length === 0) {
                user.addRole(customerRole._id)
                await user.save()
            }
        }
    } catch (error) {
        console.error('Assign default role error:', error)
    }
}
```


### User Population
```typescript
// Populate user roles for token generation
await user.populate('roles', 'name description')
```

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team