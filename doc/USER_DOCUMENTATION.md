# 👥 SIRE Tech API - User Management Documentation

## 📋 Table of Contents
- [User Model](#user-model)
- [User Controller](#user-controller)
- [User Routes](#user-routes)
- [API Examples](#api-examples)
- [Security Features](#security-features)

---

## 👤 User Model

### Schema Definition
```typescript
interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'super_admin' | 'finance' | 'project_manager' | 'staff';
  phone?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  fullName?: string;
}
```

### Key Features
- **Email Validation** - Unique email with format validation
- **Password Security** - Min 6 characters, bcrypt hashing
- **Role-Based Access** - Enum with 4 admin roles
- **Account Status** - Active/inactive toggle
- **OTP & Reset** - OTP verification and password reset
- **Activity Tracking** - Last login timestamp

---

## 🎮 User Controller

### Key Endpoints
- `getUserProfile()` - Get current user profile
- `updateUserProfile()` - Update own profile
- `changePassword()` - Change password
- `getAllUsers()` - Admin: get users (paginated)
- `getUserById()` - Admin: get a single user
- `updateUserStatus()` - Super admin: toggle active status
- `setUserAdmin()` - Super admin: set admin role
- `getUserRoles()` - Admin: get roles
- `deleteUser()` - Super admin: delete user
- `adminCreateCustomer()` - Admin: create customer

Refer to `src/controllers/userController.ts` for implementation details.

---

## 🛣️ User Routes

### Base Path: `/api/users`

```typescript
GET    /profile                  // Get current user profile
PUT    /profile                  // Update own profile
PUT    /change-password          // Change password
GET    /notifications            // Get notification preferences
PUT    /notifications            // Update notification preferences
GET    /                         // Get all users (admin)
GET    /:userId                  // Get single user (admin)
PUT    /:userId/status           // Update user status (super admin)
PUT    /:userId/admin            // Set user admin status (super admin)
GET    /:userId/roles            // Get user roles (admin)
DELETE /:userId                  // Delete user (super admin)
POST   /admin-create             // Admin create customer
```

---

## 📝 API Examples

Examples mirror those previously in `AUTH_DOCUMENTATION.md` under user sections, now consolidated here.

---

## 🔒 Security Features

- **Role-Based Access** enforced via middleware
- **Sensitive Data Exclusion** in responses
- **Ownership Checks** for self-service endpoints

---

**Last Updated:** October 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team


