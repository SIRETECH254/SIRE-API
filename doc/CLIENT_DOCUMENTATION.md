
# 👥 SIRE Tech API - Client Management Documentation

## 📋 Table of Contents
- [Client Overview](#client-overview)
- [Client Model](#client-model)
- [Client Controller](#client-controller)
- [Client Routes](#client-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Integration with Other Modules](#integration-with-other-modules)

---

## 👤 Client Overview

The SIRE Tech API Client Management System handles all client-related operations including registration, authentication, profile management, and client-specific data access. Clients are the primary users who purchase services, receive quotations, and manage projects.

### Client System Features
- **Client Registration** - Public registration with email verification
- **Client Authentication** - JWT-based login system
- **Profile Management** - Self-service profile updates
- **Client Dashboard** - Personalized client portal
- **Document Access** - View quotations, invoices, and projects
- **Payment History** - Track all payments and transactions
- **Testimonial Submission** - Share feedback and reviews

### Client vs User (Admin)
- **Clients** - External users who purchase services
- **Users (Admins)** - Internal staff who manage the system
- Separate authentication and authorization systems
- Different permission levels and access rights

---

## 🗄️ Client Model

### Schema Definition
```typescript
interface IClient {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  avatar?: string | null;
  avatarPublicId?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  // OTP Verification Fields
  otpCode?: string;
  otpExpiry?: Date;
  // Password Reset Fields
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  // Activity Tracking
  lastLoginAt?: Date;
  // Notification Preferences
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  fullName?: string; // Virtual field
}
```

### Key Features
- **Email Validation** - Unique email with format validation
- **Password Security** - Min 6 characters, hidden by default, bcrypt hashing
- **Company Information** - Optional business details
- **Location Tracking** - Address, city, and country fields
- **Avatar Support** - Profile picture with Cloudinary integration
- **Account Status** - Active/inactive toggle
- **Email Verification** - OTP-based verification system
- **Password Reset** - Secure token-based reset with expiration
- **Activity Tracking** - Last login timestamp
- **Virtual Fields** - Computed fullName field
- **Database Indexes** - Optimized queries on email, phone, isActive

### Validation Rules
```typescript
// Required fields
firstName: { required: true, maxlength: 50 }
lastName: { required: true, maxlength: 50 }
email: { required: true, unique: true, format: email }
password: { required: true, minlength: 6, select: false }
phone: { required: true, unique: true, format: phone }

// Optional fields
company: { maxlength: 100 }
address: { maxlength: 200 }
city: { maxlength: 50 }
country: { maxlength: 50 }
isActive: { default: true }
emailVerified: { default: false }
```

### Model Implementation

**File: `src/models/Client.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IClient } from '../types/index';

const clientSchema = new Schema<IClient>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  city: {
    type: String,
    trim: true,
    maxlength: [50, 'City name cannot exceed 50 characters']
  },
  country: {
    type: String,
    trim: true,
    maxlength: [50, 'Country name cannot exceed 50 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  // OTP Verification Fields
  otpCode: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  // Password Reset Fields
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpiry: {
    type: Date,
    select: false
  },
  // Activity Tracking
  lastLoginAt: {
    type: Date
  },
  // Notification Preferences
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: true
    },
    inApp: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
clientSchema.index({ email: 1 });
clientSchema.index({ phone: 1 });
clientSchema.index({ isActive: 1 });
clientSchema.index({ company: 1 });

// Virtual for full name
clientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
clientSchema.set('toJSON', { virtuals: true });

const Client = mongoose.model<IClient>('Client', clientSchema);

export default Client;
```

---

## 🎮 Client Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import { errorHandler } from '../middleware/errorHandler';
import Client, { IClient } from '../models/Client';
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from '../services/internal/notificationService';
import { generateTokens, generateOTP } from '../utils/index';
import { createInAppNotification } from '../utils/notificationHelper';
```

### Functions Overview

#### `registerClient(clientData)`
**Purpose:** Register new client with OTP verification
**Access:** Public
**Validation:**
- Email and phone uniqueness check
- Password strength validation
- Phone number format validation
- Email format validation
**Process:**
- Generate and hash password
- Create OTP code with expiry
- Handle optional avatar upload (if provided via multipart/form-data)
- Send OTP via email and SMS
- Set client as unverified initially
**Response:** Client data without password, verification status, including avatar if uploaded

**Controller Implementation:**
```typescript
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

        // Handle optional avatar upload if provided
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
```

#### `verifyClientOTP(email/phone, otp)`
**Purpose:** Verify OTP and activate client account
**Access:** Public
**Validation:**
- OTP code match
- OTP expiration check
- Client existence verification
**Process:**
- Verify OTP code and expiry
- Mark client as verified
- Clear OTP fields
- Send welcome notification
- Generate JWT tokens
**Response:** Client data + JWT tokens

**Controller Implementation:**
```typescript
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
```

#### `resendClientOTP(email/phone)`
**Purpose:** Resend OTP for verification
**Access:** Public
**Validation:**
- Client existence check
- Verification status check
**Process:**
- Generate new OTP with expiry
- Send via email and SMS
- Update client record
**Response:** Confirmation message

**Controller Implementation:**
```typescript
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
```

#### `loginClient(credentials)`
**Purpose:** Authenticate client users
**Validation:**
- Email/phone and password match
- Account active status
- Email verification status
**Process:**
- Verify credentials
- Update last login timestamp
- Generate JWT tokens
**Response:** Client data + JWT tokens

**Controller Implementation:**
```typescript
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
```

#### `getAllClients(query)`
**Purpose:** Get paginated client list with filtering (Admin only)
**Access:** Admin users only (super_admin, finance, project_manager)
**Features:**
- Pagination with configurable limits
- Search by name, email, or company
- Filter by status (active/inactive, verified/unverified)
- Sorting options
**Query Parameters:**
- page, limit, search, status
**Response:** Paginated client list

**Controller Implementation:**
```typescript
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
```

#### `getClient(clientId)`
**Purpose:** Get single client details
**Access:** Client themselves or Admin users
**Response:** Complete client profile without sensitive data

**Controller Implementation:**
```typescript
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
```

#### `updateClient(clientId, clientData)`
**Purpose:** Update client profile
**Access:** Client themselves or Admin users
**Allowed Fields:**
- firstName, lastName, phone, company, address, city, country
- avatar (can be uploaded via multipart/form-data, provided as URL, or removed by setting to null)
- Notification preferences
**Restrictions:** Cannot change email or verification status (except by admin)

**Controller Implementation:**
```typescript
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
        } else if (avatar === null || (typeof avatar === 'string' && avatar.trim().length === 0)) {
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
```

#### `updateClientStatus(clientId, isActive)`
**Purpose:** Update client account status (Admin only)
**Access:** Admin users (super_admin)
**Process:**
- Update client `isActive` status
- **Send in-app notification to client** (if account is deactivated)
**Response:** Updated client status

**Notifications:**
- **Client** receives in-app notification: "Account Status Changed" (only if account is deactivated) with deactivation message

**Controller Implementation:**
```typescript
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
                    io: req.app.get('io')
                });
            } catch (notificationError) {
                console.error('Error sending notification:', notificationError);
                // Don't fail the request if notification fails
            }
        }

        res.status(200).json({
            success: true,
            message: "Client status updated successfully",
            data: { client: { id: client._id, isActive: client.isActive } }
        });
    } catch (error: any) {
        console.error('Update client status error:', error);
        next(errorHandler(500, "Server error while updating client status"));
    }
};
```

#### `deleteClient(clientId)`
**Purpose:** Delete client account (Admin only)
**Access:** Admin users only (super_admin)
**Security:**
- Admin permission check
- Cascade deletion handling (related quotations, invoices, projects)
**Process:**
- Check for existing related documents
- Either prevent deletion or cascade delete
- Remove client record
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // Optional: Check for related documents before deletion
        // You might want to prevent deletion if client has active projects/invoices
        // Or implement cascade deletion

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
```

#### `getClientStats(clientId)`
**Purpose:** Get client statistics and overview
**Access:** Client themselves or Admin users
**Response:** 
- Total quotations (pending, accepted, rejected)
- Total invoices (paid, unpaid, overdue)
- Total payments
- Active projects
- Total spent

**Controller Implementation:**
```typescript
export const getClientStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId);

        if (!client) {
            return next(errorHandler(404, "Client not found"));
        }

        // TODO: Aggregate data from related collections
        // This requires Quotation, Invoice, Payment, and Project models

        const stats = {
            quotations: {
                total: 0,
                pending: 0,
                accepted: 0,
                rejected: 0
            },
            invoices: {
                total: 0,
                paid: 0,
                unpaid: 0,
                overdue: 0,
                totalAmount: 0,
                paidAmount: 0
            },
            projects: {
                total: 0,
                active: 0,
                completed: 0
            },
            payments: {
                total: 0,
                totalAmount: 0
            }
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
```

#### `getClientProjects(clientId)`
**Purpose:** Get client's projects
**Access:** Client themselves or Admin users
**Response:** List of projects associated with the client

#### `getClientInvoices(clientId)`
**Purpose:** Get client's invoices
**Access:** Client themselves or Admin users
**Response:** List of invoices for the client

#### `getClientPayments(clientId)`
**Purpose:** Get client's payment history
**Access:** Client themselves or Admin users
**Response:** List of payments made by the client

---

## 🛣️ Client Routes

### Base Path: `/api/clients`

```typescript
// Public Routes
POST   /register                  // Client registration with OTP
POST   /verify-otp                // Verify OTP and activate account
POST   /resend-otp                // Resend OTP for verification
POST   /login                     // Client login
POST   /forgot-password           // Request password reset
POST   /reset-password/:token     // Reset password with token

// Protected Routes (Client or Admin)
GET    /profile                   // Get current client profile
PUT    /profile                   // Update own profile
PUT    /change-password           // Change password
GET    /dashboard                 // Client dashboard with stats

// Admin Only Routes
GET    /                          // Get all clients (paginated)
GET    /:clientId                 // Get single client
PUT    /:clientId                 // Update client (admin)
DELETE /:clientId                 // Delete client
PUT    /:clientId/status          // Update client status

// Client-specific Data Routes
GET    /:clientId/stats           // Get client statistics
GET    /:clientId/projects        // Get client projects
GET    /:clientId/invoices        // Get client invoices
GET    /:clientId/payments        // Get client payments
GET    /:clientId/quotations      // Get client quotations
```

### Router Implementation

**File: `src/routes/clientRoutes.ts`**

```typescript
import express from 'express';
import {
    registerClient,
    verifyClientOTP,
    resendClientOTP,
    loginClient,
    forgotClientPassword,
    resetClientPassword,
    getClientProfile,
    updateClientProfile,
    changeClientPassword,
    getClientDashboard,
    getAllClients,
    getClient,
    updateClient,
    deleteClient,
    updateClientStatus,
    getClientStats,
    getClientProjects,
    getClientInvoices,
    getClientPayments,
    getClientQuotations
} from '../controllers/clientController';
import { authenticateToken, authorizeRoles, requireOwnershipOrAdmin } from '../middleware/auth';
import { uploadUserAvatar } from '../config/cloudinary';

const router = express.Router();

/**
 * @route   POST /api/clients/register
 * @desc    Register new client with OTP verification
 * @access  Public
 */
router.post('/register', registerClient);

/**
 * @route   POST /api/clients/verify-otp
 * @desc    Verify OTP and activate client account
 * @access  Public
 */
router.post('/verify-otp', verifyClientOTP);

/**
 * @route   POST /api/clients/resend-otp
 * @desc    Resend OTP for verification
 * @access  Public
 */
router.post('/resend-otp', resendClientOTP);

/**
 * @route   POST /api/clients/login
 * @desc    Client login (email/phone + password)
 * @access  Public
 */
router.post('/login', loginClient);

/**
 * @route   POST /api/clients/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', forgotClientPassword);

/**
 * @route   POST /api/clients/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', resetClientPassword);

/**
 * @route   GET /api/clients/profile
 * @desc    Get current client profile
 * @access  Private (Client)
 */
router.get('/profile', authenticateToken, getClientProfile);

/**
 * @route   PUT /api/clients/profile
 * @desc    Update own profile
 * @access  Private (Client)
 */
router.put('/profile', authenticateToken, uploadUserAvatar.single('avatar'), updateClientProfile);

/**
 * @route   PUT /api/clients/change-password
 * @desc    Change client password
 * @access  Private (Client)
 */
router.put('/change-password', authenticateToken, changeClientPassword);

/**
 * @route   GET /api/clients/dashboard
 * @desc    Get client dashboard with statistics
 * @access  Private (Client)
 */
router.get('/dashboard', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/clients
 * @desc    Get all clients (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllClients);

/**
 * @route   GET /api/clients/:clientId
 * @desc    Get single client
 * @access  Private (Client or Admin)
 */
router.get('/:clientId', authenticateToken, requireOwnershipOrAdmin('clientId'), getClient);

/**
 * @route   PUT /api/clients/:clientId
 * @desc    Update client (admin)
 * @access  Private (Client or Admin)
 */
router.put('/:clientId', authenticateToken, requireOwnershipOrAdmin('clientId'), uploadUserAvatar.single('avatar'), updateClient);

/**
 * @route   DELETE /api/clients/:clientId
 * @desc    Delete client
 * @access  Private (Super Admin only)
 */
router.delete('/:clientId', authenticateToken, authorizeRoles(['super_admin']), deleteClient);

/**
 * @route   PUT /api/clients/:clientId/status
 * @desc    Update client status (admin)
 * @access  Private (Admin only)
 */
router.put('/:clientId/status', authenticateToken, authorizeRoles(['super_admin']), updateClientStatus);

/**
 * @route   GET /api/clients/:clientId/stats
 * @desc    Get client statistics
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/stats', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientStats);

/**
 * @route   GET /api/clients/:clientId/projects
 * @desc    Get client projects
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/projects', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientProjects);

/**
 * @route   GET /api/clients/:clientId/invoices
 * @desc    Get client invoices
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/invoices', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientInvoices);

/**
 * @route   GET /api/clients/:clientId/payments
 * @desc    Get client payments
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/payments', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientPayments);

/**
 * @route   GET /api/clients/:clientId/quotations
 * @desc    Get client quotations
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/quotations', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientQuotations);

export default router;
```

### Route Details

#### `POST /api/clients/register`
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "client@example.com",
  "password": "securePassword123",
  "phone": "+254712345678",
  "company": "Acme Corporation",
  "address": "123 Main Street",
  "city": "Nairobi",
  "country": "Kenya"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Client registered successfully. Please verify your email with the OTP sent.",
  "data": {
    "clientId": "...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "client@example.com",
    "phone": "+254712345678",
    "company": "Acme Corporation",
    "emailVerified": false
  }
}
```

#### `POST /api/clients/verify-otp`
**Body:**
```json
{
  "email": "client@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "client": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "client@example.com",
      "phone": "+254712345678",
      "company": "Acme Corporation",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `POST /api/clients/login`
**Body:**
```json
{
  "email": "client@example.com",
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
    "client": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "client@example.com",
      "phone": "+254712345678",
      "company": "Acme Corporation",
      "emailVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### `GET /api/clients`
**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by name, email, or company
- `status` - Filter by status (active, inactive, verified, unverified)

**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "client@example.com",
        "phone": "+254712345678",
        "company": "Acme Corporation",
        "isActive": true,
        "emailVerified": true,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalClients": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/clients/:clientId/stats`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "client@example.com",
      "company": "Acme Corporation"
    },
    "stats": {
      "quotations": {
        "total": 15,
        "pending": 3,
        "accepted": 10,
        "rejected": 2
      },
      "invoices": {
        "total": 8,
        "paid": 5,
        "unpaid": 2,
        "overdue": 1,
        "totalAmount": 50000,
        "paidAmount": 35000
      },
      "projects": {
        "total": 10,
        "active": 3,
        "completed": 7
      },
      "payments": {
        "total": 12,
        "totalAmount": 35000
      }
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load client
**Usage in Client Routes:**
```typescript
router.get('/profile', authenticateToken, getClientProfile);
```

#### `requireOwnershipOrAdmin(resourceIdField)`
**Purpose:** Ensure client owns resource OR user is admin
**Usage:**
```typescript
router.get('/:clientId', authenticateToken, requireOwnershipOrAdmin('clientId'), getClient);
```

### Authorization Middleware

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check admin permissions for client management
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllClients);
```

---

## 📝 API Examples

### Complete Client Flow

#### 1. Register Client
```bash
curl -X POST http://localhost:5000/api/clients/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@company.com",
    "password": "SecurePass123",
    "phone": "+254712345678",
    "company": "Tech Solutions Ltd",
    "address": "456 Business Ave",
    "city": "Nairobi",
    "country": "Kenya"
  }'
```

#### 2. Verify OTP
```bash
curl -X POST http://localhost:5000/api/clients/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@company.com",
    "otp": "123456"
  }'
```

#### 3. Login Client
```bash
curl -X POST http://localhost:5000/api/clients/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@company.com",
    "password": "SecurePass123"
  }'
```

#### 4. Get Client Dashboard
```bash
curl -X GET http://localhost:5000/api/clients/dashboard \
  -H "Authorization: Bearer <client_access_token>"
```

#### 5. Update Client Profile
```bash
# Update profile with avatar upload
curl -X PUT http://localhost:5000/api/clients/profile \
  -H "Authorization: Bearer <client_access_token>" \
  -F "firstName=Jane" \
  -F "lastName=Smith-Johnson" \
  -F "phone=+254712345679" \
  -F "company=Tech Solutions International" \
  -F "city=Mombasa" \
  -F "avatar=@/path/to/profile-photo.jpg;type=image/jpeg"
```

```bash
# Update profile with JSON (using existing avatar URL)
curl -X PUT http://localhost:5000/api/clients/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <client_access_token>" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith-Johnson",
    "phone": "+254712345679",
    "company": "Tech Solutions International",
    "city": "Mombasa",
    "avatar": "https://res.cloudinary.com/.../profile-photo.jpg"
  }'
```

```bash
# Remove avatar
curl -X PUT http://localhost:5000/api/clients/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <client_access_token>" \
  -d '{
    "avatar": null
  }'
```

#### 6. Get Client Statistics
```bash
curl -X GET http://localhost:5000/api/clients/<clientId>/stats \
  -H "Authorization: Bearer <client_access_token>"
```

#### 7. Admin: Get All Clients
```bash
curl -X GET "http://localhost:5000/api/clients?page=1&limit=10&search=tech&status=active" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### 8. Admin: Update Client (with avatar)
```bash
# Admin update client with avatar upload
curl -X PUT http://localhost:5000/api/clients/<clientId> \
  -H "Authorization: Bearer <admin_access_token>" \
  -F "firstName=Jane" \
  -F "lastName=Smith" \
  -F "phone=+254712345679" \
  -F "company=Tech Solutions International" \
  -F "avatar=@/path/to/profile-photo.jpg;type=image/jpeg"
```

```bash
# Admin update client with JSON
curl -X PUT http://localhost:5000/api/clients/<clientId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "+254712345679",
    "company": "Tech Solutions International",
    "avatar": "https://res.cloudinary.com/.../profile-photo.jpg"
  }'
```

#### 9. Admin: Update Client Status
```bash
curl -X PUT http://localhost:5000/api/clients/<clientId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "isActive": false
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
- **Access Token:** Short-lived (configurable, default 1 day)
- **Refresh Token:** Long-lived (7 days) for renewal
- **Token Payload:** Client ID only (no sensitive data)
- **Token Verification:** Signature and expiry validation

### OTP Verification
- **6-Digit Code:** Random numeric OTP generation
- **Dual Channel:** Email and SMS delivery
- **Expiry Time:** Configurable (default 10 minutes)
- **Resend Protection:** Rate limiting on resend requests
- **Account Activation:** Required before login access

### Access Control
- **Resource Ownership:** Clients can only access their own data
- **Admin Override:** Admins can access all client data
- **Account Status:** Active/inactive client management
- **Email Verification:** Required for login

### Input Validation
- **Email Format:** Regex validation with uniqueness
- **Phone Format:** International format validation
- **Required Fields:** Server-side validation
- **Unique Constraints:** Database-level uniqueness (email, phone)
- **OTP Format:** 6-digit numeric validation

### Data Protection
- **Sensitive Data Exclusion:** Password, OTP, reset tokens hidden
- **Field Selection:** Only necessary fields returned
- **Error Messages:** Don't leak system information
- **Logging:** Sanitized logs without sensitive data

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
  "message": "Please verify your email before logging in",
  "error": "Email verification required"
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
  "message": "Client already exists with this email or phone",
  "error": "Duplicate email or phone number"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Client not found",
  "error": "No client found with the provided ID"
}
```

---

## 🔗 Integration with Other Modules

### Quotation Integration
- Clients can request quotations
- View quotation history
- Accept or reject quotations
- Track quotation status

### Invoice Integration
- Clients receive invoices
- View invoice details
- Track payment status
- Download invoice PDFs

### Payment Integration
- Clients make payments
- View payment history
- Payment confirmations
- Receipt generation

### Project Integration
- Clients view assigned projects
- Track project progress
- Access project milestones
- View project attachments

### Testimonial Integration
- Clients submit testimonials
- Rate completed projects
- Share feedback
- View published testimonials

### Notification Integration

The Client system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **Client Account Deactivated** (`updateClientStatus`)
   - **Recipient:** Client (only if account is deactivated)
   - **Category:** `general`
   - **Subject:** "Account Status Changed"
   - **Message:** Notifies client that their account has been deactivated
   - **Metadata:** `clientId`, `isActive: false`

#### Notification Preferences

All notifications respect client notification preferences:
- If `inApp` preference is `false`, notifications are skipped
- Default behavior: Notifications are sent unless explicitly disabled

#### Additional Notification Types

Clients also receive notifications from other modules:
- **Quotation Notifications:** Created, sent, converted to invoice
- **Invoice Notifications:** Created, sent, paid, overdue, cancelled
- **Payment Notifications:** Successful, failed
- **Project Notifications:** Created, status updated, progress updated, milestones added/updated, attachments uploaded

---

## 📊 Database Indexes

### Performance Optimizations
```typescript
// Email index for fast login lookups
clientSchema.index({ email: 1 });

// Phone index for phone-based authentication
clientSchema.index({ phone: 1 });

// Status index for active client filtering
clientSchema.index({ isActive: 1 });

// Company index for business search
clientSchema.index({ company: 1 });

// Compound indexes for complex queries
clientSchema.index({ isActive: 1, emailVerified: 1 });
clientSchema.index({ country: 1, city: 1 });
```

---

## 🧪 Testing Considerations

### Unit Tests
- **Model Validation:** Test schema constraints
- **Password Hashing:** Verify bcrypt functionality
- **Virtual Fields:** Test computed properties
- **OTP Generation:** Validate format and expiry

### Integration Tests
- **Registration Flow:** Complete signup process
- **Authentication:** Login/logout functionality
- **Profile Updates:** Field modification
- **Admin Operations:** Client management by admins

### Security Tests
- **Password Strength:** Weak password rejection
- **Token Expiration:** Expired token handling
- **OTP Validation:** Invalid OTP rejection
- **Access Control:** Unauthorized access prevention

---

## 📈 Performance Monitoring

### Key Metrics
- **Registration Rate:** New client signups
- **Login Success Rate:** Authentication effectiveness
- **Token Validation Time:** Middleware performance
- **Database Query Time:** Client lookup efficiency
- **Error Rate:** System reliability

### Optimization Tips
- **Connection Pooling:** MongoDB connections
- **Index Usage:** Monitor query performance
- **Caching:** Cache frequently accessed client data
- **Rate Limiting:** Prevent abuse

---

## 🔄 Future Enhancements

### Planned Features
- **Multi-Factor Authentication:** Enhanced MFA with TOTP
- **Social Login:** Google, Facebook, LinkedIn integration
- **Client Portal:** Comprehensive self-service dashboard
- **Document Management:** Upload and manage documents
- **Communication Hub:** Direct messaging with support
- **Notification Center:** Centralized notification management
- **Mobile App Integration:** Native mobile app support
- **API Keys:** For third-party integrations

### Security Improvements
- **Advanced Password Policies:** Complexity requirements
- **Session Management:** Device tracking
- **Audit Logging:** Comprehensive activity tracking
- **Two-Factor Authentication:** SMS and authenticator app
- **IP Whitelisting:** Restrict access by location
- **Account Recovery:** Multiple recovery options

---

## 📧 Notification Services

### Client Notifications
The client system integrates with notification services for:
- **OTP Delivery:** Email and SMS verification codes
- **Password Reset:** Secure reset instructions
- **Welcome Messages:** Onboarding communications
- **Invoice Alerts:** Payment due reminders
- **Project Updates:** Status change notifications
- **Payment Confirmations:** Receipt delivery

### Required Environment Variables
```env
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# OTP Configuration
OTP_EXP_MINUTES=10

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# SMS Configuration (Africa's Talking)
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

## 🎯 Best Practices

### Client Data Management
1. **Data Privacy:** Never expose sensitive client data
2. **GDPR Compliance:** Implement data deletion on request
3. **Data Retention:** Clear policies for inactive accounts
4. **Audit Trails:** Track all client data modifications

### API Design
1. **RESTful Principles:** Follow REST conventions
2. **Consistent Responses:** Standardized response format
3. **Error Handling:** Clear, actionable error messages
4. **Versioning:** Plan for API versioning

### Security Practices
1. **Regular Updates:** Keep dependencies up to date
2. **Security Audits:** Regular vulnerability assessments
3. **Rate Limiting:** Prevent abuse and DDoS
4. **Input Sanitization:** Validate and sanitize all inputs

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

