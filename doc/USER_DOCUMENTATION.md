# 👥 SIRE Tech API - User Management Documentation

## 📋 Table of Contents
- [User Management Overview](#user-management-overview)
- [User Controller](#user-controller)
- [User Routes](#user-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Database Indexes](#database-indexes)
- [Testing Considerations](#testing-considerations)
- [Performance Monitoring](#performance-monitoring)
- [Future Enhancements](#future-enhancements)
- [Notification Services](#notification-services)
- [Helper Functions](#helper-functions)

---

## User Management Overview

User Management covers all users in the unified system (including former clients). All users authenticate via JWT and are assigned roles from the Role model. Users can have multiple roles assigned. Role-based access control (RBAC) governs permissions throughout the system. The default role for new registrations is "client".

---

## 👤 User Model

### Schema Definition
```typescript
interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;                 // hashed, select: false by default
  roles: ObjectId[];                // Array of Role references
  phone: string;                    // Required field
  company?: string;                  // Client company name
  address?: string;                  // Client address
  city?: string;                    // Client city
  country?: string;                  // Client country
  isActive: boolean;                // soft-disable account
  emailVerified: boolean;           // verified via OTP in Auth flow
  avatar?: string;
  avatarPublicId?: string;          // Cloudinary public_id for lifecycle management
  // OTP Verification
  otpCode?: string;                 // select: false
  otpExpiry?: Date;                 // select: false
  // Password Reset
  resetPasswordToken?: string;      // select: false
  resetPasswordExpiry?: Date;       // select: false
  // Activity
  lastLoginAt?: Date;
  // Notification Preferences
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  fullName?: string;                // virtual
  primaryRole?: IRole;              // virtual (first role in array)
}
```

### Validation Rules
```typescript
firstName: { required: true, maxlength: 50 }
lastName:  { required: true, maxlength: 50 }
email:     { required: true, unique: true, format: email }
password:  { required: true, minlength: 6, select: false }
roles:     { type: Array, ref: 'Role' }
phone:     { required: true, unique: true }
company:   { optional, maxlength: 100 }
address:   { optional, maxlength: 200 }
city:      { optional, maxlength: 50 }
country:   { optional, maxlength: 50 }
isActive:  { default: true }
emailVerified: { default: false }
```

### Database Indexes
```typescript
// Common indexes
userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ company: 1 });
userSchema.index({ email: 1, isActive: 1 });
```

---

## 🎮 User Controller

All endpoints return consistent API responses: `{ success, message?, data?, error? }`.

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { errorHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Role from '../models/Role';
import { createInAppNotification } from '../utils/notificationHelper';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
```

### Functions Overview
- `getUserProfile()` - Get current user profile (with roles populated)
- `updateUserProfile()` - Update own profile
- `changePassword()` - Change password
- `getNotificationPreferences()` - Get notification preferences
- `updateNotificationPreferences()` - Update notification preferences
- `getAllUsers()` - Get all users (admin) with role filtering
- `getUserById()` - Get single user (admin) with roles populated
- `updateUser()` - Update any user (admin)
- `updateUserStatus()` - Update user status (super admin)
- `setUserAdmin()` - Set user admin role (super admin) - DEPRECATED: Use assignRole instead
- `getUserRoles()` - Get user roles (admin) with roles populated
- `deleteUser()` - Delete user (super admin)
- `adminCreateCustomer()` - Admin creates a customer (assigns default "client" role)
- `assignRole()` - Assign role to user (super admin)
- `removeRole()` - Remove role from user (super admin)
- `getClients()` - Get clients (users with client role) (admin)

### getUserProfile
**Route:** GET `/api/users/profile`  |  **Access:** Private

Returns the authenticated user's profile (excludes sensitive fields).

Controller Implementation:
```typescript
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?._id).select('-password -otpCode -resetPasswordToken');
    if (!user) return next(errorHandler(404, 'User not found'));
    res.status(200).json({ success: true, data: { user: { /* fields */ } } });
  } catch (e) { next(errorHandler(500, 'Server error while fetching user profile')); }
};
```

### updateUserProfile
**Route:** PUT `/api/users/profile`  |  **Access:** Private

Allows a user to update their own profile (firstName, lastName, phone) and avatar. Avatars can be:
- Uploaded directly as multipart form-data (`avatar` file field).
- Provided as an already-hosted URL string.
- Removed entirely by sending `avatar: null` (or an empty string), which deletes the stored Cloudinary asset.

Controller Implementation:
```typescript
export const updateUserProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const user = await User.findById(req.user?._id);
    if (!user) return next(errorHandler(404, 'User not found'));
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError);
        }
      }
      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (
      avatar === null ||
      (typeof avatar === 'string' && avatar.trim().length === 0)
    ) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError);
        }
      }

      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError);
        }
      }

      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }
    await user.save();
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: { /* fields */ } } });
  } catch (e) { next(errorHandler(500, 'Server error while updating profile')); }
};
```

### changePassword
**Route:** PUT `/api/users/change-password`  |  **Access:** Private

Changes the authenticated user's password after verifying current password.

Controller Implementation:
```typescript
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return next(errorHandler(400, 'Current password and new password are required'));
    const user = await User.findById(req.user?._id).select('+password');
    if (!user) return next(errorHandler(404, 'User not found'));

    const ok = bcrypt.compareSync(currentPassword, user.password);
    if (!ok) return next(errorHandler(400, 'Current password is incorrect'));
    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (e) { next(errorHandler(500, 'Server error while changing password')); }
};
```

### getNotificationPreferences
**Route:** GET `/api/users/notifications`  |  **Access:** Private

Controller Implementation:
```typescript
export const getNotificationPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?._id).select('notificationPreferences');
    if (!user) return next(errorHandler(404, 'User not found'));
    res.status(200).json({ success: true, data: { notificationPreferences: user.notificationPreferences || {} } });
  } catch (e) { next(errorHandler(500, 'Server error while fetching notification preferences')); }
};
```

### updateNotificationPreferences
**Route:** PUT `/api/users/notifications`  |  **Access:** Private

Controller Implementation:
```typescript
export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const { email, sms, inApp } = req.body;
    const user = await User.findById(req.user?._id);
    if (!user) return next(errorHandler(404, 'User not found'));
    user.notificationPreferences = user.notificationPreferences || {};
    if (email !== undefined) user.notificationPreferences.email = email;
    if (sms !== undefined) user.notificationPreferences.sms = sms;
    if (inApp !== undefined) user.notificationPreferences.inApp = inApp;
    await user.save();
    res.status(200).json({ success: true, message: 'Notification preferences updated successfully', data: { notificationPreferences: user.notificationPreferences } });
  } catch (e) { next(errorHandler(500, 'Server error while updating notification preferences')); }
};
```

### getAllUsers
**Route:** GET `/api/users`  |  **Access:** Private (Admin: super_admin, finance, project_manager)

Supports pagination and filtering by search, role, and status flags.

Controller Implementation:
```typescript
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query: any = {};
    if (search) query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName:  { $regex: search, $options: 'i' } },
      { email:     { $regex: search, $options: 'i' } }
    ];
    if (role) query.role = role;
    if (status === 'active') query.isActive = true;
    else if (status === 'inactive') query.isActive = false;
    if (status === 'verified') query.emailVerified = true;
    else if (status === 'unverified') query.emailVerified = false;
    const options = { page: parseInt(page as string), limit: parseInt(limit as string), select: '-password -otpCode -resetPasswordToken' };
    const users = await User.find(query).select(options.select).sort({ createdAt: 'desc' }).limit(options.limit).skip((options.page - 1) * options.limit);
    const total = await User.countDocuments(query);
    res.status(200).json({ success: true, data: { users, pagination: { currentPage: options.page, totalPages: Math.ceil(total / options.limit), totalUsers: total, hasNextPage: options.page < Math.ceil(total / options.limit), hasPrevPage: options.page > 1 } } });
  } catch (e) { next(errorHandler(500, 'Server error while fetching users')); }
};
```

### getUserById
**Route:** GET `/api/users/:userId`  |  **Access:** Private (Admin)

Controller Implementation:
```typescript
export const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password -otpCode -resetPasswordToken');
    if (!user) return next(errorHandler(404, 'User not found'));
    res.status(200).json({ success: true, data: { user } });
  } catch (e) { next(errorHandler(500, 'Server error while fetching user')); }
};
```

### updateUser
**Route:** PUT `/api/users/:userId`  |  **Access:** Private (Admin: super_admin, finance, project_manager)

Allows an admin to update any user's profile information including firstName, lastName, phone, email, and avatar. Email updates are validated for format and uniqueness. Avatars can be:
- Uploaded directly as multipart form-data (`avatar` file field).
- Provided as an already-hosted URL string.
- Removed entirely by sending `avatar: null` (or an empty string), which deletes the stored Cloudinary asset.

Controller Implementation:
```typescript
export const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, email, avatar } = req.body;
    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, 'User not found'));
    
    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    
    // Email update requires validation
    if (email) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) return next(errorHandler(400, 'Please provide a valid email'));
      
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingUser) return next(errorHandler(400, 'Email is already taken by another user'));
      
      user.email = email.toLowerCase();
    }

    // Handle avatar upload via multipart/form-data
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, 'sire-tech/avatars');
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError);
        }
      }
      user.avatar = uploadResult.url;
      user.avatarPublicId = uploadResult.public_id;
    } else if (avatar === null || (typeof avatar === 'string' && avatar.trim().length === 0)) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError);
        }
      }
      user.avatar = null;
      user.avatarPublicId = null;
    } else if (typeof avatar === 'string' && avatar.trim().length > 0) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId);
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError);
        }
      }
      user.avatar = avatar.trim();
      user.avatarPublicId = null;
    }
    
    await user.save();
    res.status(200).json({ 
      success: true, 
      message: 'User updated successfully', 
      data: { 
        user: { 
          id: user._id, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          email: user.email, 
          phone: user.phone, 
          avatar: user.avatar, 
          role: user.role, 
          isActive: user.isActive 
        } 
      } 
    });
  } catch (e) { next(errorHandler(500, 'Server error while updating user')); }
};
```

### updateUserStatus
**Route:** PUT `/api/users/:userId/status`  |  **Access:** Private (Super Admin)

**Purpose:** Update user account status (deactivate/activate)
**Process:**
- Update user `isActive` status
- **Send in-app notification to user** (if account is deactivated)
**Response:** Updated user status

**Notifications:**
- **User** receives in-app notification: "Account Status Changed" (only if account is deactivated) with deactivation message

Controller Implementation:
```typescript
export const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params; const { isActive } = req.body;
    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, 'User not found'));
    // Update status
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();

    // Send notification to user if account is deactivated
    if (!user.isActive) {
      try {
        await createInAppNotification({
          recipient: user._id.toString(),
          recipientModel: 'User',
          category: 'general',
          subject: 'Account Status Changed',
          message: `Your admin account has been deactivated. Please contact super admin for assistance.`,
          metadata: {
            userId: user._id,
            isActive: false
          },
          io: req.app.get('io')
        });
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Don't fail the request if notification fails
      }
    }

    res.status(200).json({ success: true, message: 'User status updated successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isActive: user.isActive, role: user.role } } });
  } catch (e) { next(errorHandler(500, 'Server error while updating user status')); }
};
```

### setUserAdmin
**Route:** PUT `/api/users/:userId/admin`  |  **Access:** Private (Super Admin)

Controller Implementation:
```typescript
export const setUserAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params; const { role } = req.body;
    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, 'User not found'));
    const validRoles = ['super_admin','finance','project_manager','staff'];
    if (!validRoles.includes(role)) return next(errorHandler(400, 'Invalid role'));
    user.role = role; await user.save();
    res.status(200).json({ success: true, message: `User role updated to ${role} successfully`, data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } } });
  } catch (e) { next(errorHandler(500, 'Server error while updating user admin status')); }
};
```

### getUserRoles
**Route:** GET `/api/users/:userId/roles`  |  **Access:** Private (Admin)

Controller Implementation:
```typescript
export const getUserRoles = async (req, res, next) => {
  try {
    const { userId } = req.params; const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, 'User not found'));
    res.status(200).json({ success: true, data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role } } });
  } catch (e) { next(errorHandler(500, 'Server error while fetching user roles')); }
};
```

### deleteUser
**Route:** DELETE `/api/users/:userId`  |  **Access:** Private (Super Admin)

Controller Implementation:
```typescript
export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user && String(req.user._id) === String(userId)) return next(errorHandler(400, 'You cannot delete your own account'));
    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, 'User not found'));
    await User.findByIdAndDelete(userId);
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (e) { next(errorHandler(500, 'Server error while deleting user')); }
};
```

### adminCreateCustomer
**Route:** POST `/api/users/admin-create`  |  **Access:** Private (Admin: super_admin, finance)

Creates a new user/customer quickly (password derived from phone then hashed).

Controller Implementation:
```typescript
export const adminCreateCustomer = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, role } = req.body;
    if (!firstName || !lastName || !email || !phone) return next(errorHandler(400, 'firstName, lastName, email and phone are required'));
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) return next(errorHandler(400, `A user with this ${existing.email === email ? 'email' : 'phone'} already exists`));
    const passwordHash = bcrypt.hashSync(String(phone), 12);
    const user = await User.create({ firstName, lastName, email: email.toLowerCase(), phone, password: passwordHash, role: role || 'staff', isActive: true, emailVerified: false });
    res.status(201).json({ success: true, message: 'Customer created successfully', data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive, emailVerified: user.emailVerified, createdAt: user.createdAt } } });
  } catch (e) { next(errorHandler(500, 'Server error while creating customer')); }
};
```

---

## 🛣️ User Routes

### Base Path: `/api/users`

```typescript
GET    /profile                  // Get current user profile
PUT    /profile                  // Update own profile (multipart/form-data for avatar)
PUT    /change-password          // Change password
GET    /notifications            // Get notification preferences
PUT    /notifications            // Update notification preferences
POST   /admin-create             // Admin create customer
GET    /                         // Get all users (admin)
GET    /:userId                  // Get single user (admin)
PUT    /:userId                  // Update user (admin)
PUT    /:userId/status           // Update user status (super admin)
PUT    /:userId/admin            // Set user admin role (super admin)
GET    /:userId/roles            // Get user roles (admin)
DELETE /:userId                  // Delete user (super admin)
```

### Router Implementation

**File: `src/routes/userRoutes.ts`**

```typescript
import express from 'express';
import {
    getUserProfile,
    updateUserProfile,
    changePassword,
    getNotificationPreferences,
    updateNotificationPreferences,
    getAllUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    setUserAdmin,
    getUserRoles,
    deleteUser,
    adminCreateCustomer
} from '../controllers/userController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';
import { uploadUserAvatar } from '../config/cloudinary';

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update own profile
 * @access  Private
 */
router.put('/profile', authenticateToken, uploadUserAvatar.single('avatar'), updateUserProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change password
 * @access  Private
 */
router.put('/change-password', authenticateToken, changePassword);

/**
 * @route   GET /api/users/notifications
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/notifications', authenticateToken, getNotificationPreferences);

/**
 * @route   PUT /api/users/notifications
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/notifications', authenticateToken, updateNotificationPreferences);

/**
 * @route   POST /api/users/admin-create
 * @desc    Admin create customer
 * @access  Private (Admin only)
 */
router.post('/admin-create', authenticateToken, authorizeRoles(['super_admin', 'finance']), adminCreateCustomer);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllUsers);

/**
 * @route   GET /api/users/:userId
 * @desc    Get single user (admin)
 * @access  Private (Admin only)
 */
router.get('/:userId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getUserById);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user (admin)
 * @access  Private (Admin only)
 */
router.put('/:userId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), uploadUserAvatar.single('avatar'), updateUser);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Update user status (admin)
 * @access  Private (Admin only)
 */
router.put('/:userId/status', authenticateToken, authorizeRoles(['super_admin']), updateUserStatus);

/**
 * @route   PUT /api/users/:userId/admin
 * @desc    Set user admin status (admin)
 * @access  Private (Super Admin only)
 */
router.put('/:userId/admin', authenticateToken, requireAdmin, setUserAdmin);

/**
 * @route   GET /api/users/:userId/roles
 * @desc    Get user roles (admin)
 * @access  Private (Admin only)
 */
router.get('/:userId/roles', authenticateToken, authorizeRoles(['super_admin', 'finance']), getUserRoles);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user (admin)
 * @access  Private (Super Admin only)
 */
router.delete('/:userId', authenticateToken, requireAdmin, deleteUser);

/**
 * @route   POST /api/users/:userId/roles
 * @desc    Assign role to user
 * @access  Private (Super Admin only)
 */
router.post('/:userId/roles', authenticateToken, requireAdmin, assignRole);

/**
 * @route   DELETE /api/users/:userId/roles/:roleId
 * @desc    Remove role from user
 * @access  Private (Super Admin only)
 */
router.delete('/:userId/roles/:roleId', authenticateToken, requireAdmin, removeRole);

/**
 * @route   GET /api/users/clients
 * @desc    Get clients (users with client role)
 * @access  Private (Admin)
 */
router.get('/clients', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getClients);

export default router;
```

> **Note:** `uploadUserAvatar` comes from `config/cloudinary.ts` and wraps Multer + Cloudinary storage. It enforces a 2 MB limit and only accepts image mimetypes, automatically uploading the file to `sire-tech/avatars`.

### Route Details

#### `GET /api/users/profile`
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
      "email": "john@example.com",
      "phone": "+254712345678",
      "avatar": "https://cloudinary.com/...",
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client",
          "description": "Client role",
          "permissions": []
        }
      ],
      "company": "Example Corp",
      "address": "123 Main St",
      "city": "Nairobi",
      "country": "Kenya",
      "isActive": true,
      "emailVerified": true,
      "lastLoginAt": "2025-01-01T12:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

#### `PUT /api/users/profile`
**Headers:** `Authorization: Bearer <token>`

**Body (multipart/form-data with avatar upload):**
```
firstName=John
lastName=Smith
phone=+254712345679
avatar=<file>
```

**Body (JSON with existing avatar URL):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+254712345679",
  "avatar": "https://res.cloudinary.com/.../profile-photo.jpg"
}
```

**Body (JSON to remove avatar):**
```json
{
  "avatar": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Smith",
      "email": "john@example.com",
      "phone": "+254712345679",
      "avatar": "https://cloudinary.com/...",
      "roles": [...],
      "isActive": true,
      "emailVerified": true
    }
  }
}
```

#### `PUT /api/users/change-password`
**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### `GET /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": false,
      "inApp": true
    }
  }
}
```

#### `PUT /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "email": true,
  "sms": false,
  "inApp": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification preferences updated successfully",
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": false,
      "inApp": true
    }
  }
}
```

#### `POST /api/users/admin-create`
**Headers:** `Authorization: Bearer <admin_token>`

**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Customer",
  "email": "jane@customer.com",
  "phone": "+254712345680",
  "roleNames": ["client"],
  "company": "Customer Corp",
  "address": "456 Main St",
  "city": "Nairobi",
  "country": "Kenya"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "Jane",
      "lastName": "Customer",
      "email": "jane@customer.com",
      "phone": "+254712345680",
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client"
        }
      ],
      "company": "Customer Corp",
      "address": "456 Main St",
      "city": "Nairobi",
      "country": "Kenya",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/users`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name or email
- `role` (optional): Filter by role name
- `status` (optional): Filter by status (active, inactive, verified, unverified)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "+254712345678",
        "roles": [
          {
            "_id": "...",
            "name": "client",
            "displayName": "Client"
          }
        ],
        "isActive": true,
        "emailVerified": true,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+254712345678",
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client",
          "description": "Client role",
          "permissions": []
        }
      ],
      "company": "Example Corp",
      "address": "123 Main St",
      "city": "Nairobi",
      "country": "Kenya",
      "isActive": true,
      "emailVerified": true,
      "avatar": "https://cloudinary.com/...",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

#### `PUT /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`

**Body (multipart/form-data with avatar upload):**
```
firstName=John
lastName=Smith
phone=+254712345679
email=john.smith@example.com
avatar=<file>
```

**Body (JSON with existing avatar URL):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+254712345679",
  "email": "john.smith@example.com",
  "avatar": "https://res.cloudinary.com/.../profile-photo.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@example.com",
      "phone": "+254712345679",
      "avatar": "https://cloudinary.com/...",
      "role": "client",
      "isActive": true
    }
  }
}
```

#### `PUT /api/users/:userId/status`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Body:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "isActive": false,
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client"
        }
      ]
    }
  }
}
```

#### `PUT /api/users/:userId/admin`
**Headers:** `Authorization: Bearer <super_admin_token>`

**DEPRECATED:** Use `POST /api/users/:userId/roles` instead.

**Body:**
```json
{
  "role": "project_manager"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User role updated to project_manager successfully",
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "project_manager"
    }
  }
}
```

#### `GET /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client",
          "description": "Client role",
          "permissions": []
        },
        {
          "_id": "...",
          "name": "finance",
          "displayName": "Finance",
          "description": "Finance role",
          "permissions": ["invoice:read", "payment:read"]
        }
      ]
    }
  }
}
```

#### `POST /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Body:**
```json
{
  "roleName": "finance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role assigned successfully",
  "data": {
    "user": {
      "id": "...",
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client"
        },
        {
          "_id": "...",
          "name": "finance",
          "displayName": "Finance"
        }
      ]
    }
  }
}
```

#### `DELETE /api/users/:userId/roles/:roleId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Response:**
```json
{
  "success": true,
  "message": "Role removed successfully",
  "data": {
    "user": {
      "id": "...",
      "roles": [
        {
          "_id": "...",
          "name": "client",
          "displayName": "Client"
        }
      ]
    }
  }
}
```

#### `GET /api/users/clients`
**Headers:** `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name, email, or company
- `status` (optional): Filter by status (active, inactive, verified, unverified)

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "_id": "...",
        "firstName": "Jane",
        "lastName": "Customer",
        "email": "jane@customer.com",
        "phone": "+254712345680",
        "company": "Customer Corp",
        "roles": [
          {
            "_id": "...",
            "name": "client",
            "displayName": "Client"
          }
        ],
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

#### `DELETE /api/users/:userId`
**Headers:** `Authorization: Bearer <super_admin_token>`

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🛡️ Middleware

### Authentication Middleware

#### `authenticateToken`
Purpose: Verify JWT token

Usage:
```typescript
router.get('/protected', authenticateToken, controllerFunction);
```

#### `authorizeRoles(allowedRoles)`
Purpose: Check user permissions

Usage:
```typescript
router.get('/admin-only', 
  authenticateToken, 
  authorizeRoles(['super_admin', 'finance']), 
  controllerFunction
);
```

#### `requireAdmin`
Purpose: Super admin access only

Usage:
```typescript
router.delete('/user/:id', 
  authenticateToken, 
  requireAdmin, 
  deleteUser
);
```

#### `requireOwnershipOrAdmin`
Purpose: User owns resource OR is admin

Usage:
```typescript
router.get('/:userId', 
  authenticateToken, 
  authorizeRoles(['super_admin', 'finance', 'project_manager']), 
  getUserById
);
```

---

## 📝 API Examples

### Get Current User Profile
```bash
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <access_token>"
```

### Update Profile (with avatar upload)
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <access_token>" \
  -F "firstName=John" \
  -F "lastName=Smith" \
  -F "phone=+254712345679" \
  -F "avatar=@/path/to/profile-photo.jpg;type=image/jpeg"
```

### Update Profile (using existing avatar URL)
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+254712345679",
    "avatar": "https://res.cloudinary.com/.../profile-photo.jpg"
  }'
```

### Remove Avatar
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "avatar": null
  }'
```
Sending `avatar: null` (or an empty string) removes the stored avatar and deletes the file from Cloudinary if it exists.

### Change Password
```bash
curl -X PUT http://localhost:5000/api/users/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword123"
  }'
```

### Get Users (Admin)
```bash
curl -X GET "http://localhost:5000/api/users?page=1&limit=10&search=john&status=active" \
  -H "Authorization: Bearer <admin_access_token>"
```

### Update User (Admin)
```bash
# Update user with avatar upload
curl -X PUT http://localhost:5000/api/users/<userId> \
  -H "Authorization: Bearer <admin_access_token>" \
  -F "firstName=John" \
  -F "lastName=Smith" \
  -F "phone=+254712345679" \
  -F "email=john.smith@example.com" \
  -F "avatar=@/path/to/profile-photo.jpg;type=image/jpeg"
```

```bash
# Update user with JSON (using existing avatar URL)
curl -X PUT http://localhost:5000/api/users/<userId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+254712345679",
    "email": "john.smith@example.com",
    "avatar": "https://res.cloudinary.com/.../profile-photo.jpg"
  }'
```

### Update User Status (Super Admin)
```bash
curl -X PUT http://localhost:5000/api/users/<userId>/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{ "isActive": false }'
```

### Set User Role (Super Admin)
```bash
curl -X PUT http://localhost:5000/api/users/<userId>/admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{ "role": "project_manager" }'
```

### Delete User (Super Admin)
```bash
curl -X DELETE http://localhost:5000/api/users/<userId> \
  -H "Authorization: Bearer <super_admin_token>"
```

---

## 🔒 Security Features

- **RBAC:** Route-level authorization via `authenticateToken`, `authorizeRoles`, `requireAdmin`.
- **Least Privilege:** Sensitive actions limited to `super_admin` (delete, role changes).
- **Sensitive Fields Excluded:** Password, OTP, reset tokens never returned.
- **Ownership:** Self-service endpoints operate on `req.user._id`.

---

## 🚨 Error Handling

Common responses:
```json
// 404 - User Not Found
{ "success": false, "message": "User not found" }

// 400 - Invalid Role
{ "success": false, "message": "Invalid role" }

// 400 - Self Deletion Attempt
{ "success": false, "message": "You cannot delete your own account" }

// 401/403 - Auth/Authorization Errors
{ "success": false, "message": "Access token required" }
```

---

## 🔔 Notification Integration

The User Management system sends **in-app notifications** via Socket.io for real-time updates:

#### Notification Events

1. **User Account Deactivated** (`updateUserStatus`)
   - **Recipient:** User (only if account is deactivated)
   - **Category:** `general`
   - **Subject:** "Account Status Changed"
   - **Message:** Notifies user that their admin account has been deactivated
   - **Metadata:** `userId`, `isActive: false`

#### Notification Preferences

All notifications respect user notification preferences:
- If `inApp` preference is `false`, notifications are skipped
- Default behavior: Notifications are sent unless explicitly disabled

#### Additional Notification Types

Users also receive notifications from other modules:
- **Quotation Notifications:** Quotation accepted/rejected (for finance/admin who created quotations)
- **Invoice Notifications:** Invoice created from quotation (confirmation)
- **Project Notifications:** Assigned to project, project status updated, milestones added/updated

---

## 📊 Database Indexes

- Advanced role management (granular permissions)
- Audit logs for admin actions
- Avatar upload via Cloudinary with transformations
- Bulk user import/export

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

