
# 🔐 SIRE Tech API - Authentication System Documentation

## 📋 Table of Contents
- [Authentication Overview](#authentication-overview)
- [User Model](#user-model)
- [Authentication Controller](#authentication-controller)
- [User Controller](#user-controller)
- [Authentication Routes](#authentication-routes)
- [User Routes](#user-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)

---

## 🔑 Authentication Overview

The SIRE Tech API uses JWT (JSON Web Tokens) for authentication with role-based access control (RBAC). The system supports both admin users and regular clients with different permission levels.

### Authentication Flow
1. **Registration/Login** → Generate JWT tokens
2. **Token Validation** → Middleware verifies tokens
3. **Role Authorization** → Check user permissions
4. **Protected Routes** → Access granted based on role

### User Roles
- `super_admin` - Full system access
- `finance` - Financial operations access
- `project_manager` - Project management access
- `staff` - Basic admin access

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
  createdAt: Date;
  updatedAt: Date;
  fullName?: string; // Virtual field
}
```

### Key Features
- **Email Validation** - Unique email with format validation
- **Password Security** - Min 6 characters, hidden by default
- **Role-Based Access** - Enum with 4 admin roles
- **Account Status** - Active/inactive toggle
- **Email Verification** - Boolean flag for verified accounts
- **Profile Avatar** - Optional Cloudinary URL
- **Virtual Fields** - Computed fullName field
- **Indexes** - Optimized queries on email, role, isActive

### Validation Rules
```typescript
// Required fields
firstName: { required: true, maxlength: 50 }
lastName: { required: true, maxlength: 50 }
email: { required: true, unique: true, format: email }
password: { required: true, minlength: 6, select: false }

// Optional fields
phone: { format: phone number }
role: { enum: ['super_admin', 'finance', 'project_manager', 'staff'], default: 'staff' }
isActive: { default: true }
emailVerified: { default: false }
```

---

## 🎮 Authentication Controller

### Functions Overview

#### `registerAdmin(userData)`
**Purpose:** Create new admin user (super admin only)
**Access:** Super admin only
**Validation:**
- Email uniqueness
- Password strength
- Role validation
**Response:** User data without password

#### `login(credentials)`
**Purpose:** Authenticate admin users
**Validation:**
- Email/password match
- Account active status
**Response:** User data + JWT tokens

#### `logout()`
**Purpose:** Invalidate current session
**Implementation:** Client-side token removal

#### `forgotPassword(email)`
**Purpose:** Send password reset email
**Process:**
- Generate reset token
- Send email with reset link
- Token expires in 1 hour

#### `resetPassword(token, newPassword)`
**Purpose:** Reset password with token
**Validation:**
- Valid token
- Password strength
- Token not expired

#### `refreshToken(refreshToken)`
**Purpose:** Generate new access token
**Security:** Refresh token validation

#### `getMe()`
**Purpose:** Get current user profile
**Access:** Authenticated users only

---

## 👥 User Controller

### Functions Overview

#### `createUser(userData)`
**Purpose:** Create new admin user
**Access:** Super admin only
**Validation:**
- Email uniqueness
- Role assignment
- Required fields

#### `getAllUsers(query)`
**Purpose:** Get paginated user list
**Access:** Admin users only
**Features:**
- Pagination
- Filtering by role/status
- Sorting options

#### `getUser(userId)`
**Purpose:** Get single user details
**Access:** Admin users or self
**Security:** Role-based access control

#### `updateUser(userId, updateData)`
**Purpose:** Update user information
**Access:** Admin users or self (limited fields)
**Validation:**
- Email uniqueness (if changing)
- Role restrictions

#### `deleteUser(userId)`
**Purpose:** Soft delete user account
**Access:** Super admin only
**Process:** Set isActive to false

#### `toggleUserStatus(userId)`
**Purpose:** Activate/deactivate user
**Access:** Super admin only

#### `updateRole(userId, newRole)`
**Purpose:** Change user role
**Access:** Super admin only
**Validation:** Valid role enum

#### `updateProfile(userData)`
**Purpose:** Update own profile
**Access:** Authenticated users
**Restrictions:** Cannot change role or sensitive fields

---

## 🛣️ Authentication Routes

### Base Path: `/api/auth`

```typescript
POST   /register/admin           // Register new admin (super admin only)
POST   /login                    // Admin login
POST   /logout                   // Logout user
POST   /forgot-password          // Request password reset
POST   /reset-password/:token    // Reset password with token
POST   /refresh-token            // Refresh access token
GET    /me                       // Get current user profile
```

### Route Details

#### `POST /api/auth/register/admin`
**Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "admin@siretech.com",
  "password": "securePassword123",
  "role": "finance",
  "phone": "+254712345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin user created successfully",
  "data": {
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@siretech.com",
      "role": "finance",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
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

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@siretech.com",
      "role": "finance",
      "fullName": "John Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 👥 User Routes

### Base Path: `/api/users`

```typescript
POST   /                         // Create user (super admin)
GET    /                         // Get all users (admin)
GET    /:id                      // Get single user
PUT    /:id                      // Update user
DELETE /:id                      // Delete user (super admin)
PATCH  /:id/toggle-status        // Toggle user status
PATCH  /:id/role                 // Update user role
PUT    /profile                  // Update own profile
```

### Route Details

#### `GET /api/users`
**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `role` - Filter by role
- `isActive` - Filter by status
- `sort` - Sort field
- `order` - Sort direction (asc/desc)

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `PUT /api/users/:id`
**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@siretech.com",
  "phone": "+254712345679"
}
```

#### `PATCH /api/users/:id/role`
**Body:**
```json
{
  "role": "project_manager"
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

#### 1. Register Admin User
```bash
curl -X POST http://localhost:3000/api/auth/register/admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "admin@siretech.com",
    "password": "securePassword123",
    "role": "finance"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@siretech.com",
    "password": "securePassword123"
  }'
```

#### 3. Access Protected Route
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <access_token>"
```

#### 4. Update Profile
```bash
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+254712345678"
  }'
```

#### 5. Password Reset Flow
```bash
# Request reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@siretech.com"}'

# Reset password
curl -X POST http://localhost:3000/api/auth/reset-password/<reset_token> \
  -H "Content-Type: application/json" \
  -d '{"password": "newSecurePassword123"}'
```

---

## 🔒 Security Features

### Password Security
- **Hashing:** bcryptjs with salt rounds
- **Minimum Length:** 6 characters
- **Hidden by Default:** Password field excluded from queries

### JWT Security
- **Secret Key:** Environment variable
- **Expiration:** Configurable (default 30 days)
- **Refresh Tokens:** Separate token for renewal

### Access Control
- **Role-Based:** Granular permissions per role
- **Resource Ownership:** Users can only access their own data
- **Admin Override:** Super admin can access everything

### Input Validation
- **Email Format:** Regex validation
- **Phone Format:** International format validation
- **Required Fields:** Server-side validation
- **Unique Constraints:** Database-level uniqueness

### Rate Limiting
- **Login Attempts:** Prevent brute force
- **Password Reset:** Limit reset requests
- **API Calls:** General rate limiting

### Security Headers
- **CORS:** Configured origins
- **Helmet:** Security headers
- **HTTPS:** Required in production

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
- **Multi-Factor Authentication:** SMS/Email OTP
- **OAuth Integration:** Google/Microsoft login
- **Session Management:** Device tracking
- **Audit Logging:** User action tracking
- **Password Policies:** Advanced requirements
- **Account Lockout:** Failed attempt protection

### Security Improvements
- **JWT Blacklisting:** Token invalidation
- **Device Fingerprinting:** Suspicious activity detection
- **Geolocation Validation:** Login location verification
- **Biometric Authentication:** Mobile app integration

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team