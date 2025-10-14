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

User Management covers internal admin users who operate the system. Users authenticate via JWT and are assigned one of four roles: `super_admin`, `finance`, `project_manager`, `staff`. Role-based access control (RBAC) governs permissions for administration tasks.

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
  role: 'super_admin' | 'finance' | 'project_manager' | 'staff';
  phone?: string;
  isActive: boolean;                // soft-disable account
  emailVerified: boolean;           // verified via OTP in Auth flow
  avatar?: string;
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
}
```

### Validation Rules
```typescript
firstName: { required: true, maxlength: 50 }
lastName:  { required: true, maxlength: 50 }
email:     { required: true, unique: true, format: email }
password:  { required: true, minlength: 6, select: false }
role:      { enum: ['super_admin','finance','project_manager','staff'], default: 'staff' }
phone:     { optional, unique: true }
isActive:  { default: true }
emailVerified: { default: false }
```

### Database Indexes
```typescript
// Common indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
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
```

### Functions Overview
- `getUserProfile()` - Get current user profile
- `updateUserProfile()` - Update own profile
- `changePassword()` - Change password
- `getNotificationPreferences()` - Get notification preferences
- `updateNotificationPreferences()` - Update notification preferences
- `getAllUsers()` - Get all users (admin)
- `getUserById()` - Get single user (admin)
- `updateUserStatus()` - Update user status (super admin)
- `setUserAdmin()` - Set user admin role (super admin)
- `getUserRoles()` - Get user roles (admin)
- `deleteUser()` - Delete user (super admin)
- `adminCreateCustomer()` - Admin creates a customer

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

Allows a user to update their own profile (firstName, lastName, phone, avatar).

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
    if (avatar) user.avatar = avatar;
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

### updateUserStatus
**Route:** PUT `/api/users/:userId/status`  |  **Access:** Private (Super Admin)

Controller Implementation:
```typescript
export const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params; const { isActive } = req.body;
    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, 'User not found'));
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();
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
PUT    /profile                  // Update own profile
PUT    /change-password          // Change password
GET    /notifications            // Get notification preferences
PUT    /notifications            // Update notification preferences
POST   /admin-create             // Admin create customer
GET    /                         // Get all users (admin)
GET    /:userId                  // Get single user (admin)
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
    updateUserStatus,
    setUserAdmin,
    getUserRoles,
    deleteUser,
    adminCreateCustomer
} from '../controllers/userController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

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
router.put('/profile', authenticateToken, updateUserProfile);

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

export default router;
```

### Route Details

#### `GET /api/users/profile`
Returns the current user's profile.

#### `PUT /api/users/profile`
Update own profile fields.

#### `PUT /api/users/change-password`
Change password after verifying current password.

#### `GET /api/users`
List users with pagination and filters.

#### `GET /api/users/:userId`
Get single user details.

#### `PUT /api/users/:userId/status`
Toggle user active status (super admin only).

#### `PUT /api/users/:userId/admin`
Set user role (super admin only).

#### `GET /api/users/:userId/roles`
Get user roles.

#### `DELETE /api/users/:userId`
Delete user (super admin only).

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

### Update Profile
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+254712345679",
    "avatar": "https://cloudinary.com/..."
  }'
```

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

## 🔄 Future Enhancements

- Advanced role management (granular permissions)
- Audit logs for admin actions
- Avatar upload via Cloudinary with transformations
- Bulk user import/export

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team

