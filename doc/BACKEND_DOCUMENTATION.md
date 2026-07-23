# 🚀 Sire Tech API - Backend Documentation

## 📋 Table of Contents
- [Technology Stack](#technology-stack)
- [Required Packages](#required-packages)
- [Database Models](#database-models)
- [Controllers](#controllers)
- [Routes](#routes)
- [Architecture Overview](#architecture-overview)

---

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB (Mongoose ODM)


---

## 📦 Required Packages

### Core Dependencies
```json
{
  "@types/bcryptjs": "^2.4.6",
  "@types/cors": "^2.8.19",
  "@types/express": "^5.0.3",
  "@types/jsonwebtoken": "^9.0.10",
  "@types/multer": "^2.0.0",
  "@types/node": "^24.5.2",
  "@types/nodemailer": "^7.0.2",
  "@types/pdfkit": "^0.17.3",
  "@types/stream-buffers": "^3.0.8",
  "@types/swagger-jsdoc": "^6.0.4",
  "@types/swagger-ui-express": "^4.1.8",
  "@types/validator": "^13.15.3",
  "africastalking": "^0.7.7",
  "axios": "^1.12.2",
  "bcryptjs": "^3.0.2",
  "cloudinary": "^1.41.3",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^4.21.2",
  "joi": "^18.0.1",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.18.3",
  "mongoose-paginate-v2": "^1.9.1",
  "multer": "^2.0.2",
  "multer-storage-cloudinary": "^4.0.0",
  "nodemailer": "^7.0.6",
  "nodemon": "^3.1.10",
  "pdfkit": "^0.17.2",
  "socket.io": "^4.8.1",
  "stream-buffers": "^3.0.3",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "validator": "^13.15.15"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.9.2",
  "tsx": "^4.20.5"
}
```

---

## 🗄️ Database Models

### 1. User Model (Unified)
```typescript
interface IUser {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string; // select: false
  roles: ObjectId[]; // Role references
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
  otpCode?: string; // select: false
  otpExpiry?: Date; // select: false
  resetPasswordToken?: string; // select: false
  resetPasswordExpiry?: Date; // select: false
  lastLoginAt?: Date;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `roles` - Role references (default assigned in `authController.register`)
- `password`, `otpCode`, `otpExpiry`, `resetPasswordToken`, `resetPasswordExpiry` - Not returned in queries by default
- Virtuals: `fullName`, `primaryRole`

---

### 2. Role Model
```typescript
interface IRole {
  _id: ObjectId;
  name: string; // Unique, lowercase (e.g., 'super_admin', 'client')
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- System roles cannot be deleted (`isSystemRole` enforced in model hooks).

---

### 3. Service Model
```typescript
interface IService {
  _id: ObjectId;
  title: string;
  description: string;
  features: string[];
  isActive: boolean;
  icon?: string;
  createdBy: ObjectId; // User reference
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. Quotation Model
```typescript
interface IQuotation {
  _id: ObjectId;
  quotationNumber: string; // Auto-generated (QT-YYYY-0001)
  project: ObjectId;
  client: ObjectId;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number; // amount, not percentage
  discount: number; // amount, not percentage
  totalAmount: number;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'converted';
  validUntil: Date;
  notes?: string;
  createdBy: ObjectId;
  convertedToInvoice?: ObjectId;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- Totals are recalculated in pre-save hooks.
- `quotationNumber` is generated automatically if missing.

---

### 5. Invoice Model
```typescript
interface IInvoice {
  _id: ObjectId;
  invoiceNumber: string; // Auto-generated (INV-YYYY-0001)
  client: ObjectId;
  quotation?: ObjectId;
  projectTitle: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number; // amount
  discount: number; // amount
  totalAmount: number;
  paidAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  pdf?: { url?: string };
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- `invoiceNumber` is generated in a pre-validate hook.
- `remainingBalance` is a virtual field.

---

### 6. Payment Model
```typescript
interface IPayment {
  _id: ObjectId;
  paymentNumber: string; // Auto-generated (PAY-YYYY-0001)
  invoice: ObjectId;
  client: ObjectId;
  amount: number;
  paymentMethod: 'mpesa' | 'paystack';
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  reference?: string;
  paymentDate: Date;
  notes?: string;
  metadata?: Record<string, any>;
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
    paystack?: { reference?: string };
  };
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- `paymentNumber` is generated automatically (pre-validate).

---

### 7. Project Model
```typescript
interface IProject {
  _id: ObjectId;
  projectNumber: string; // Auto-generated (PRJ-YYYY-0001)
  title: string;
  description: string;
  client: ObjectId;
  quotation?: ObjectId;
  invoice?: ObjectId;
  services: ObjectId[];
  status: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: ObjectId[];
  startDate?: Date;
  endDate?: Date;
  completionDate?: Date;
  progress: number; // 0-100
  milestones: Array<{
    title: string;
    description?: string;
    dueDate: Date;
    status: 'pending' | 'in_progress' | 'completed';
    completedDate?: Date;
  }>;
  attachments: Array<{
    name: string;
    url: string;
    uploadedBy: ObjectId;
    uploadedAt: Date;
  }>;
  notes?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- `projectNumber` is generated on save if missing.
- `completionDate` is set when status changes to `completed`.

---

### 8. Testimonial Model
```typescript
interface ITestimonial {
  _id: ObjectId;
  client: ObjectId;
  project?: ObjectId;
  rating: number; // 1-5
  message: string;
  isApproved: boolean;
  isPublished: boolean;
  approvedBy?: ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 9. Notification Model
```typescript
interface INotification {
  _id: ObjectId;
  recipient: ObjectId;
  recipientModel: 'User';
  type: 'email' | 'sms' | 'push' | 'in_app';
  category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
  subject: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
  actions?: Array<{
    id: string;
    label: string;
    type: 'api' | 'navigate' | 'modal' | 'confirm';
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    payload?: any;
    route?: string;
    modal?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    requiresConfirmation?: boolean;
    confirmationMessage?: string;
  }>;
  context?: {
    resourceId?: string;
    resourceType?: string;
    additionalData?: any;
  };
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- `isUnread` is a virtual (true when `readAt` is empty).

---

### 10. ContactMessage Model
```typescript
interface IContactMessage {
  _id: ObjectId;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  repliedBy?: ObjectId;
  repliedAt?: Date;
  reply?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- `message` max length: 2000 characters.
- `reply` max length: 2000 characters.

---

### 11. QuotationRequest Model
```typescript
interface IQuotationRequest {
  _id: ObjectId;
  requestNumber: string; // Auto-generated (RQR-YYYY-0001)
  // Contact
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  // Project scope
  projectTitle: string;
  projectType: 'web_development' | 'mobile_app' | 'ui_ux_design' | 'cloud_infrastructure'
             | 'data_analytics' | 'cybersecurity' | 'ai_ml' | 'consulting' | 'other';
  description: string; // 20–2000 chars
  services?: string[]; // free-text service names
  // Constraints
  budget?: string;     // e.g. "$5,000–$10,000" (string range)
  deadline?: Date;
  // Supporting
  attachments?: string[]; // Cloudinary URLs, max 10
  notes?: string;         // max 500 chars
  referralSource?: string;
  // System / admin
  status: 'new' | 'reviewed' | 'converted' | 'rejected';
  assignedTo?: ObjectId;   // Reference to User
  linkedProject?: ObjectId; // Reference to Project (set on convert)
  linkedUser?: ObjectId;   // Reference to User (auto-matched by email or set on convert)
  // Audit
  reviewedAt?: Date;
  convertedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Notes:**
- `requestNumber` is auto-generated in a pre-save hook using year-prefix regex count (`RQR-YYYY-0001`).
- `budget` is a `string`, not a number — clients submit ranges like "$5,000–$10,000".
- `services` is `string[]` (not ObjectId refs) — submitter is anonymous and enters free text.
- Terminal statuses (`converted`, `rejected`) cannot be changed via `PATCH /:id/status`.
- `convertToProject` uses a Mongoose session for atomic writes across two collections.
- Status flow: `new → reviewed → converted` (terminal) or `new/reviewed → rejected` (terminal).

---

## 🎮 Controllers

### 1. Auth Controllers

#### `authController.ts`
- `register()` - Public registration with OTP verification (defaults to client role unless `role` is provided)
- `verifyOTP()` - Verify OTP and activate account
- `resendOTP()` - Resend OTP for verification
- `login()` - User login (email/phone + password)
- `logout()` - Logout user
- `forgotPassword()` - Send password reset via email/SMS
- `resetPassword()` - Reset password with token
- `refreshToken()` - Refresh JWT token
- `getMe()` - Get current user profile

**Note:** Registration requires the `client` role to exist (see `npm run migrate:roles`).

---

### 2. Role Controllers

#### `roleController.ts`
- `createRole()` - Create new role (super admin only)
- `getAllRoles()` - Get all roles
- `getRole()` - Get single role by ID
- `updateRole()` - Update role (super admin only)
- `deleteRole()` - Delete role (super admin only, cannot delete system roles)
- `getUsersByRole()` - Get all users with a specific role
- `getClients()` - Get all users with 'client' role

---

### 3. Service Controllers

#### `serviceController.ts`
- `createService()` - Create new service (admin)
- `getAllServices()` - Get all services
- `getActiveServices()` - Get published services
- `getService()` - Get single service
- `updateService()` - Update service (admin)
- `deleteService()` - Delete service (admin)
- `toggleServiceStatus()` - Activate/deactivate service
- `uploadServiceIcon()` - Upload service icon (admin)

---

### 4. Quotation Controllers

#### `quotationController.ts`
- `createQuotation()` - Create quotation (admin or client request)
- `getAllQuotations()` - Get all quotations (admin)
- `getQuotationsByClient()` - Get quotations for a client
- `getQuotation()` - Get single quotation
- `updateQuotation()` - Update quotation (admin)
- `deleteQuotation()` - Delete quotation (admin)
- `acceptQuotation()` - Client accepts quotation
- `rejectQuotation()` - Client rejects quotation
- `convertToInvoice()` - Convert quotation to invoice
- `generateQuotationPDFController()` - Generate PDF
- `sendQuotation()` - Email quotation to client

---

### 5. Invoice Controllers

#### `invoiceController.ts`
- `createInvoice()` - Create invoice (admin)
- `getAllInvoices()` - Get all invoices (admin)
- `getInvoiceStats()` - Invoice statistics (admin)
- `getOverdueInvoices()` - Overdue invoices (admin)
- `getClientInvoices()` - Client invoices
- `getInvoice()` - Get single invoice
- `updateInvoice()` - Update invoice (admin)
- `deleteInvoice()` - Delete invoice (admin)
- `markAsPaid()` - Mark invoice as paid
- `markAsOverdue()` - Mark invoice as overdue
- `cancelInvoice()` - Cancel invoice
- `generateInvoicePDFController()` - Generate PDF
- `sendInvoice()` - Email invoice to client

---

### 6. Payment Controllers

#### `paymentController.ts`
- `createPaymentAdmin()` - Record payment (admin)
- `getAllPayments()` - Get all payments (admin)
- `getPayment()` - Get single payment
- `updatePayment()` - Update payment (admin)
- `deletePayment()` - Delete payment (admin)
- `getClientPayments()` - Get client's payments
- `getInvoicePayments()` - Get payments for an invoice
- `initiatePayment()` - Initiate payment (handles both M-Pesa and Paystack)
- `mpesaWebhook()` - M-Pesa webhook handler
- `paystackWebhook()` - Paystack webhook handler
- `queryMpesaByCheckoutId()` - Query M-Pesa payment status by checkout request ID

---

### 7. Project Controllers

#### `projectController.ts`
- `createProject()` - Create project (admin)
- `getAllProjects()` - Get all projects
- `getProjectStats()` - Get project statistics (admin)
- `getProject()` - Get single project
- `updateProject()` - Update project
- `deleteProject()` - Delete project (admin)
- `assignTeamMembers()` - Assign team to project
- `updateProjectStatus()` - Update status
- `updateProgress()` - Update progress percentage
- `addMilestone()` - Add project milestone
- `updateMilestone()` - Update milestone
- `deleteMilestone()` - Delete milestone
- `uploadAttachment()` - Upload project files (supports multiple files, max 10 per request)
- `deleteAttachment()` - Delete project file
- `getClientProjects()` - Get client's projects
- `getAssignedProjects()` - Get projects assigned to current user

---

### 8. Testimonial Controllers

#### `testimonialController.ts`
- `createTestimonial()` - Client submits testimonial
- `getAllTestimonials()` - Get all testimonials (admin)
- `getPublishedTestimonials()` - Get public testimonials
- `getMyTestimonials()` - Get authenticated client's testimonials
- `getTestimonial()` - Get single testimonial
- `updateTestimonial()` - Update testimonial
- `deleteTestimonial()` - Delete testimonial
- `approveTestimonial()` - Admin approves testimonial
- `publishTestimonial()` - Publish testimonial
- `unpublishTestimonial()` - Unpublish testimonial

---

### 9. Notification Controllers

#### `notificationController.ts`
- `sendNotification()` - Send notification (admin)
- `getUserNotifications()` - Get user's notifications
- `getNotification()` - Get single notification
- `markAsRead()` - Mark notification as read
- `markAllAsRead()` - Mark all as read
- `deleteNotification()` - Delete notification
- `getUnreadCount()` - Get unread notification count
- `getUnreadNotifications()` - Get unread notifications
- `getNotificationsByCategory()` - Get notifications by category
- `sendInvoiceReminder()` - Send invoice reminder (admin)
- `sendPaymentConfirmation()` - Send payment confirmation (admin)
- `sendProjectUpdate()` - Send project update notification (admin)
- `sendBulkNotification()` - Send bulk notification (super admin)

---

### 10. Contact Controllers

#### `contactController.ts`
- `submitContactMessage()` - Submit contact form
- `getMyMessages()` - Get client's own contact messages
- `getAllMessages()` - Get all messages (admin)
- `getMessage()` - Get single message
- `markAsRead()` - Mark as read
- `replyToMessage()` - Reply to message
- `deleteMessage()` - Delete message
- `archiveMessage()` - Archive message

---

### 11. QuotationRequest Controllers

#### `quotationRequestController.ts`
- `submitQuotationRequest()` - Public RFQ submission (no auth required); sends admin alert email + client acknowledgement + in-app notifications to admin team
- `getAllQuotationRequests()` - Get all requests with pagination and filters (`status`, `projectType`, `assignedTo`, `search`)
- `getQuotationRequest()` - Get single request with full population
- `updateRequestStatus()` - Move request to `reviewed` or `rejected` (sets audit timestamps, notifies assignee/client)
- `convertToProject()` - Atomically create a Project from the RFQ (requires `clientUserId`); uses Mongoose session
- `deleteQuotationRequest()` - Delete request (blocked if `converted`)

---

### 12. Dashboard Controllers

#### `dashboardController.ts`
- `getAdminDashboard()` - Admin dashboard stats
- `getClientDashboard()` - Client dashboard stats
- `getRevenueStats()` - Revenue analytics
- `getProjectStats()` - Project statistics
- `getClientActivityStats()` - Client activity
- `getServiceDemandStats()` - Service demand analytics

---

### 13. User Controllers (Admin Management)

#### `userController.ts`
- `getUserProfile()` - Get current user profile
- `updateUserProfile()` - Update own profile
- `changePassword()` - Change password
- `getNotificationPreferences()` - Get notification preferences
- `updateNotificationPreferences()` - Update notification preferences
- `getAllUsers()` - Get all admin users
- `getUserById()` - Get single user (admin)
- `updateUser()` - Update any user (admin)
- `updateUserStatus()` - Update user status (super admin)
- `setUserAdmin()` - Set user admin role (super admin)
- `getUserRoles()` - Get user roles (admin)
- `deleteUser()` - Delete user (super admin)
- `adminCreateCustomer()` - Admin creates a customer
- `assignRole()` - Assign role to user (super admin)
- `removeRole()` - Remove role from user (super admin)
- `getClients()` - Get users with client role

---

## 🛣️ Routes

### Auth Routes
**Base:** `/api/auth`

```typescript
POST   /register                  // Registration with OTP
POST   /verify-otp                // Verify OTP and activate account
POST   /resend-otp                // Resend OTP for verification
POST   /login                     // User login (email/phone + password)
POST   /logout                    // Logout user
POST   /forgot-password           // Forgot password
POST   /reset-password/:token     // Reset password
POST   /refresh-token             // Refresh token
GET    /me                        // Get current user profile
```

**Note:** New users are assigned the `client` role by default unless a valid `role` is provided.

---

### Role Routes
**Base:** `/api/roles`

```typescript
POST   /                          // Create role (super admin only)
GET    /                          // Get all roles
GET    /:roleId                   // Get single role
PUT    /:roleId                   // Update role (super admin only)
DELETE /:roleId                   // Delete role (super admin only)
GET    /:roleId/users             // Get users with specific role
GET    /client/users              // Get all users with 'client' role
```

---

### Service Routes
**Base:** `/api/services`

```typescript
GET    /active                    // Get active services (public)
POST   /                          // Create service (admin)
GET    /                          // Get all services (admin)
GET    /:serviceId                // Get single service (public)
PUT    /:serviceId                // Update service (admin)
DELETE /:serviceId                // Delete service (super admin only)
PATCH  /:serviceId/toggle-status  // Toggle service status (admin)
POST   /:serviceId/icon           // Upload service icon (admin)
```

---

### Quotation Routes
**Base:** `/api/quotations`

```typescript
POST   /                          // Create quotation (admin)
GET    /                          // Get all quotations (admin)
GET    /client/:clientId          // Get quotations for a client
POST   /:quotationId/accept       // Accept quotation (client)
POST   /:quotationId/reject       // Reject quotation (client)
POST   /:quotationId/send         // Send quotation via email (admin)
GET    /:quotationId/pdf          // Generate PDF
POST   /:quotationId/convert-to-invoice  // Convert to invoice (admin)
GET    /:quotationId              // Get single quotation
PUT    /:quotationId              // Update quotation (admin)
DELETE /:quotationId              // Delete quotation (admin)
```

---

### Invoice Routes
**Base:** `/api/invoices`

```typescript
POST   /                          // Create invoice (admin)
GET    /                          // Get all invoices (admin)
GET    /stats                     // Invoice statistics (admin)
GET    /overdue                   // Overdue invoices (admin)
GET    /client/:clientId          // Get client invoices
GET    /:invoiceId                // Get single invoice
PUT    /:invoiceId                // Update invoice (admin)
DELETE /:invoiceId                // Delete invoice (admin)
PATCH  /:invoiceId/mark-paid      // Mark as paid (admin)
PATCH  /:invoiceId/mark-overdue   // Mark as overdue (admin)
PATCH  /:invoiceId/cancel         // Cancel invoice (admin)
GET    /:invoiceId/pdf            // Generate PDF
POST   /:invoiceId/send           // Send invoice via email (admin)
```

---

### Payment Routes
**Base:** `/api/payments`

```typescript
POST   /                          // Create payment (admin)
GET    /                          // Get all payments (admin)
GET    /client/:clientId          // Get client payments
GET    /invoice/:invoiceId        // Get invoice payments
GET    /:paymentId                // Get single payment
PUT    /:paymentId                // Update payment (admin)
DELETE /:paymentId                // Delete payment (admin)
POST   /initiate                  // Initiate payment (M-Pesa or Paystack)
POST   /webhooks/mpesa            // M-Pesa webhook
POST   /webhooks/paystack         // Paystack webhook
GET    /mpesa-status/:checkoutRequestId  // Query M-Pesa payment status
```

---

### Project Routes
**Base:** `/api/projects`

```typescript
POST   /                          // Create project (admin)
GET    /                          // Get all projects (admin)
GET    /stats                     // Get project statistics (admin)
GET    /assigned                  // Get assigned projects
GET    /client/:clientId          // Get client projects
GET    /:projectId                // Get single project
PUT    /:projectId                // Update project
DELETE /:projectId                // Delete project (admin)
POST   /:projectId/assign         // Assign team members (admin)
PATCH  /:projectId/status         // Update status
PATCH  /:projectId/progress       // Update progress
POST   /:projectId/milestones     // Add milestone
PUT    /:projectId/milestones/:milestoneId  // Update milestone
DELETE /:projectId/milestones/:milestoneId  // Delete milestone
POST   /:projectId/attachments    // Upload attachments (multiple files supported, max 10)
DELETE /:projectId/attachments/:attachmentId  // Delete attachment
```

---

### Testimonial Routes
**Base:** `/api/testimonials`

```typescript
POST   /                          // Create testimonial (client)
GET    /published                 // Get published testimonials
GET    /my                        // Get authenticated client's testimonials
GET    /                          // Get all testimonials (admin)
POST   /:id/approve               // Approve testimonial (admin)
POST   /:id/publish               // Publish testimonial (admin)
POST   /:id/unpublish             // Unpublish testimonial (admin)
GET    /:id                       // Get single testimonial
PUT    /:id                       // Update testimonial
DELETE /:id                       // Delete testimonial
```

---

### Notification Routes
**Base:** `/api/notifications`

```typescript
POST   /                          // Send notification (admin)
GET    /                          // Get user notifications
GET    /unread-count              // Get unread count
GET    /unread                    // Get unread notifications
GET    /:notificationId           // Get single notification
PATCH  /:notificationId/read      // Mark as read
DELETE /:notificationId           // Delete notification
PATCH  /read-all                  // Mark all as read
POST   /invoice-reminder          // Send invoice reminder (admin)
POST   /payment-confirmation      // Send payment confirmation (admin)
POST   /project-update            // Send project update (admin)
POST   /bulk                      // Send bulk notification (super admin)
GET    /category/:category        // Get notifications by category
```

---

### Contact Routes
**Base:** `/api/contact`

```typescript
POST   /                          // Submit contact message
GET    /my-messages               // Get client messages
GET    /                          // Get all messages (admin)
GET    /:messageId                // Get single message
PATCH  /:messageId/read           // Mark as read
POST   /:messageId/reply          // Reply to message
DELETE /:messageId                // Delete message
PATCH  /:messageId/archive        // Archive message
```

---

### Quotation Request Routes
**Base:** `/api/quotation-requests`

```typescript
POST   /                          // Submit RFQ — Public (no auth)
GET    /                          // Get all requests (super_admin, finance, project_manager)
PATCH  /:requestId/status         // Update status to reviewed/rejected (admin)
POST   /:requestId/convert        // Convert to Project (super_admin, project_manager)
GET    /:requestId                // Get single request (admin)
DELETE /:requestId                // Delete request (super_admin only)
```

**Access summary:**
- `POST /` — no authentication required
- All other routes — require `authenticateToken`
- Convert — requires `super_admin` or `project_manager` role
- Delete — requires `super_admin` role only

---

### Dashboard Routes
**Base:** `/api/dashboard`

```typescript
GET    /admin                     // Admin dashboard
GET    /client                    // Client dashboard
GET    /revenue                   // Revenue stats
GET    /projects                  // Project stats
GET    /client-activity           // Client activity
GET    /service-demand            // Service demand
```

---

### User Routes (Admin Management)
**Base:** `/api/users`

```typescript
GET    /profile                   // Get own profile
PUT    /profile                   // Update own profile
PUT    /change-password           // Change password
GET    /notifications             // Get notification preferences
PUT    /notifications             // Update notification preferences
POST   /admin-create              // Admin create customer
GET    /clients                   // Get users with client role
GET    /                          // Get all users (admin)
GET    /:userId                   // Get single user (admin)
PUT    /:userId                   // Update user (admin)
PUT    /:userId/status            // Update user status (super admin)
PUT    /:userId/admin             // Set user as admin (super admin)
GET    /:userId/roles             // Get user roles (admin)
DELETE /:userId                   // Delete user (super admin)
POST   /:userId/roles             // Assign role to user (super admin)
DELETE /:userId/roles/:roleId     // Remove role from user (super admin)
```

---

### Utility Routes
```typescript
GET    /api                        // API root info
GET    /api/health                 // Health check
GET    /api/debug/cors             // CORS debug info
GET    /api/docs                   // Swagger UI
```

## 🏗️ Architecture Overview

### Folder Structure
```
sire-api/
├── src/
│   ├── config/
│   │   ├── cloudinary.ts        # File upload config
│   │   ├── swagger.ts          # Swagger documentation config
│   │   
│   ├── models/
│   │   ├── User.ts
│   │   ├── Role.ts
│   │   ├── Service.ts
│   │   ├── QuotationRequest.ts   # Public RFQ intake (entry point)
│   │   ├── Quotation.ts
│   │   ├── Invoice.ts
│   │   ├── Payment.ts
│   │   ├── Project.ts
│   │   ├── Testimonial.ts
│   │   ├── Notification.ts
│   │   └── ContactMessage.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── roleController.ts
│   │   ├── serviceController.ts
│   │   ├── quotationRequestController.ts  # Public RFQ intake
│   │   ├── quotationController.ts
│   │   ├── invoiceController.ts
│   │   ├── paymentController.ts
│   │   ├── projectController.ts
│   │   ├── testimonialController.ts
│   │   ├── notificationController.ts
│   │   ├── contactController.ts
│   │   ├── dashboardController.ts
│   │   └── userController.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── roleRoutes.ts
│   │   ├── serviceRoutes.ts
│   │   ├── quotationRequestRoutes.ts  # Public RFQ intake
│   │   ├── quotationRoutes.ts
│   │   ├── invoiceRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   ├── projectRoutes.ts
│   │   ├── testimonialRoutes.ts
│   │   ├── notificationRoutes.ts
│   │   ├── contactRoutes.ts
│   │   ├── dashboardRoutes.ts
│   │   └── userRoutes.ts
│   ├── middleware/
│   │   ├── auth.ts              # JWT authentication and authorization
│   │   ├── errorHandler.ts     # Error handling helpers
│   │   ├── authorize.ts         # Placeholder (unused)
│   │   └── validate.ts          # Placeholder (unused)
│   ├── scripts/
│   │   └── migrateToRoles.ts    # Seed system roles
│   ├── services/
│   │   ├── internal/
│   │   │   ├── notificationService.ts # Internal notifications
│   │   │   └── paymentService.ts      # Payment processing service
│   │   └── external/
│   │       ├── darajaService.ts       # M-Pesa Daraja API
│   │       ├── paystackService.ts     # Paystack payment gateway
│   │       ├── emailService.ts        # Email service (Nodemailer)
│   │       └── smsService.ts          # SMS service (Africa's Talking)
│   ├── utils/
│   │   ├── generatePDF.ts       # PDF generation utilities (PDFKit)
│   │   ├── pdfUpload.ts         # PDF generation + Cloudinary upload
│   │   ├── notificationHelper.ts # In-app notification helper
│   │   └── index.ts             # JWT utilities and OTP generation
│   ├── types/
│   │   ├── africastalking.d.ts  # Africa's Talking types
│   │   └── index.ts             # Custom types
│   └── index.ts                 # App entry point
├── doc/                         # Documentation
├── .env                         # Environment variables
├── .gitignore
├── package.json
└── tsconfig.json
```

---

### Middleware

#### Authentication Middleware
- `authenticateToken` - Verify JWT token and load user
- `authorizeRoles(allowedRoles)` - Role-based access control
- `requireAdmin` - Super admin access only
- `requireOwnershipOrAdmin` - User owns resource OR is admin
- `requireEmailVerification` - Require verified email
- `optionalAuth` - Optional authentication (doesn't fail if no token)

#### Error Handling
- `errorHandler` - Error helper used across controllers
- Global error handler is defined in `src/index.ts`

#### File Upload
- File upload is handled via `config/cloudinary.ts` with Cloudinary integration
- **User Avatars:** 2MB limit
- **Service Icons:** 1MB limit
- **Project Attachments:** Multiple files (max 10 per request, 10MB per file)
- Supported formats: Images (jpg, jpeg, png, gif, webp) and Documents (pdf, doc, docx, txt)

#### Real-time (Socket.io)
- Socket server is initialized in `src/index.ts`
- Clients can subscribe to `project`, `payment`, `invoice`, and `quotation` updates

---

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=4000
API_BASE_URL=https://yourdomain.com
CORS_ORIGIN=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/sire-tech

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_secret

# OTP
OTP_EXP_MINUTES=10

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
FROM_EMAIL=noreply@siretech.com

# SMS
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username

# M-Pesa (Daraja API)
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_shortcode
MPESA_PASSKEY=your_passkey

# Paystack
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_CURRENCY=KES

# Cloudinary (File Upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL
FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
```

---

### Security Features

1. **Authentication**
   - JWT-based authentication
   - Password hashing with bcryptjs
   - OTP email verification
   - Password reset via email/SMS

2. **Authorization**
   - Role-based access control (RBAC)
   - Route-level permissions
   - Resource ownership validation

3. **API Security**
   - CORS allowlist
   - Error responses include stack traces only in development

---

### Integration Points

1. **Payment Gateways**
   - M-Pesa (Mobile Money via Daraja API)
   - Paystack (Cards and Bank Transfer)

2. **Communication**
   - Nodemailer (Email)
   - Africa's Talking (SMS)

3. **File Storage**
   - Cloudinary (Images/Documents)

4. **PDF Generation**
   - PDFKit in `utils/generatePDF.ts`
   - Cloudinary upload in `utils/pdfUpload.ts`

5. **Real-time**
   - Socket.io for live updates and notifications

---

## 📄 PDF Generation

- PDF rendering is handled by `utils/generatePDF.ts` using PDFKit.
- PDFs are uploaded to Cloudinary with `utils/pdfUpload.ts` and stored in `Quotation.pdfUrl` or `Invoice.pdf.url`.

---

## 🚀 Getting Started

### Installation
```bash
cd sire-api
npm install
```

### Seed Default Roles
```bash
npm run migrate:roles
```

### Database Setup
```bash
# Ensure MongoDB is running
mongod
```

### Run Development Server
```bash
npm run dev:mcp
```

### Build for Production
```bash
npm run build
npm start
```

---

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

---

## 🔄 Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

**Last Updated:** January 2026
**Version:** 0.1.0

**Note:** This documentation reflects the current codebase implementation.
