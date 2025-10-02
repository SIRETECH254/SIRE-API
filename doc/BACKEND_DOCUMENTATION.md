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
- **Authentication:** JWT (JSON Web Tokens)
- **File Handling:** Multer (for file uploads)
- **Email:** Nodemailer
- **SMS:** Twilio / Africa's Talking
- **Payment Gateways:** M-Pesa, Stripe, PayPal

---

## 📦 Required Packages

### Core Dependencies
```json
{
  "africastalking": "^0.7.3",
  "axios": "^1.10.0",
  "bcryptjs": "^3.0.2",
  "cloudinary": "^1.41.0",
  "cors": "^2.8.5",
  "dotenv": "^17.1.0",
  "express": "^4.18.2",
  "joi": "^18.0.0",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.16.2",
  "mongoose-paginate-v2": "^1.9.1",
  "multer": "^2.0.1",
  "multer-storage-cloudinary": "^4.0.0",
  "nodemailer": "^7.0.5",
  "nodemon": "^3.1.10",
  "pdfkit": "^0.17.1",
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
  "tsx": "^4.20.5",
  "@types/node": "^24.5.2",
  "@types/express": "^5.0.0",
  "@types/cors": "^2.8.17",
  "@types/bcryptjs": "^2.4.6",
  "@types/jsonwebtoken": "^9.0.6",
  "@types/nodemailer": "^6.4.15",
  "@types/multer": "^1.4.11"
}
```

---

## 🗄️ Database Models

### 1. User Model (Admin)
```typescript
interface IUser {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'super_admin' | 'finance' | 'project_manager' | 'staff';
  phone?: string;
  isActive: boolean;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `firstName`, `lastName` - Admin name
- `email` - Unique, required
- `password` - Hashed password
- `role` - Access level (super_admin, finance, project_manager, staff)
- `phone` - Contact number
- `isActive` - Account status
- `avatar` - Profile image URL
- Timestamps

---

### 2. Client Model
```typescript
interface IClient {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `firstName`, `lastName` - Client name
- `email` - Unique, required
- `password` - Hashed password
- `phone` - Contact number
- `company` - Business name (optional)
- `address`, `city`, `country` - Location details
- `isActive` - Account status
- `emailVerified` - Email verification status
- Timestamps

---

### 3. Service Model
```typescript
interface IService {
  _id: ObjectId;
  title: string;
  description: string;
  category: 'web_development' | 'mobile_app' | 'digital_marketing' | 'ui_ux_design' | 'consulting' | 'other';
  basePrice?: number;
  features: string[];
  isActive: boolean;
  icon?: string;
  createdBy: ObjectId; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `title` - Service name
- `description` - Detailed description
- `category` - Service type
- `basePrice` - Starting price (optional)
- `features` - Array of service features
- `isActive` - Visibility status
- `icon` - Service icon/image
- `createdBy` - Admin who created it
- Timestamps

---

### 4. Quotation Model
```typescript
interface IQuotation {
  _id: ObjectId;
  quotationNumber: string; // Auto-generated (QT-2025-0001)
  client: ObjectId; // Reference to Client
  projectTitle: string;
  projectDescription: string;
  services: Array<{
    service: ObjectId; // Reference to Service
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'converted';
  validUntil: Date;
  notes?: string;
  createdBy: ObjectId; // Reference to User
  convertedToInvoice?: ObjectId; // Reference to Invoice
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `quotationNumber` - Unique identifier
- `client` - Client reference
- `projectTitle`, `projectDescription` - Project details
- `services` - Array of requested services with pricing
- `subtotal`, `tax`, `discount`, `totalAmount` - Pricing breakdown
- `status` - Quotation lifecycle status
- `validUntil` - Expiration date
- `notes` - Additional information
- `createdBy` - Admin who created it
- `convertedToInvoice` - Invoice reference (if converted)
- Timestamps

---

### 5. Invoice Model
```typescript
interface IInvoice {
  _id: ObjectId;
  invoiceNumber: string; // Auto-generated (INV-2025-0001)
  client: ObjectId; // Reference to Client
  quotation?: ObjectId; // Reference to Quotation (if converted)
  projectTitle: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  createdBy: ObjectId; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `invoiceNumber` - Unique identifier
- `client` - Client reference
- `quotation` - Source quotation (optional)
- `projectTitle` - Project name
- `items` - Billing items
- `subtotal`, `tax`, `discount`, `totalAmount` - Pricing breakdown
- `paidAmount` - Amount paid so far
- `status` - Payment status
- `dueDate` - Payment deadline
- `paidDate` - When fully paid
- `notes` - Additional information
- `createdBy` - Admin who created it
- Timestamps

---

### 6. Payment Model
```typescript
interface IPayment {
  _id: ObjectId;
  paymentNumber: string; // Auto-generated (PAY-2025-0001)
  invoice: ObjectId; // Reference to Invoice
  client: ObjectId; // Reference to Client
  amount: number;
  paymentMethod: 'mpesa' | 'bank_transfer' | 'stripe' | 'paypal' | 'cash';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  reference?: string;
  paymentDate: Date;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `paymentNumber` - Unique identifier
- `invoice` - Invoice reference
- `client` - Client reference
- `amount` - Payment amount
- `paymentMethod` - Payment channel
- `status` - Payment status
- `transactionId` - Gateway transaction ID
- `reference` - Payment reference
- `paymentDate` - When payment was made
- `notes` - Additional information
- `metadata` - Extra payment data
- Timestamps

---

### 7. Project Model
```typescript
interface IProject {
  _id: ObjectId;
  projectNumber: string; // Auto-generated (PRJ-2025-0001)
  title: string;
  description: string;
  client: ObjectId; // Reference to Client
  quotation?: ObjectId; // Reference to Quotation
  invoice?: ObjectId; // Reference to Invoice
  services: ObjectId[]; // References to Services
  status: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: ObjectId[]; // References to User (team members)
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
  createdBy: ObjectId; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `projectNumber` - Unique identifier
- `title`, `description` - Project details
- `client` - Client reference
- `quotation`, `invoice` - Related documents
- `services` - Services included
- `status` - Project lifecycle status
- `priority` - Urgency level
- `assignedTo` - Team members assigned
- `startDate`, `endDate`, `completionDate` - Timeline
- `progress` - Completion percentage
- `milestones` - Project milestones
- `attachments` - Project files
- `notes` - Additional information
- `createdBy` - Admin who created it
- Timestamps

---

### 8. Testimonial Model
```typescript
interface ITestimonial {
  _id: ObjectId;
  client: ObjectId; // Reference to Client
  project?: ObjectId; // Reference to Project
  rating: number; // 1-5
  message: string;
  isApproved: boolean;
  isPublished: boolean;
  approvedBy?: ObjectId; // Reference to User
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `client` - Client who gave testimonial
- `project` - Related project (optional)
- `rating` - Star rating (1-5)
- `message` - Testimonial text
- `isApproved` - Admin approval status
- `isPublished` - Public visibility
- `approvedBy` - Admin who approved
- `approvedAt` - Approval timestamp
- Timestamps

---

### 9. Notification Model
```typescript
interface INotification {
  _id: ObjectId;
  recipient: ObjectId; // Reference to User or Client
  recipientModel: 'User' | 'Client';
  type: 'email' | 'sms' | 'push' | 'in_app';
  category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
  subject: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `recipient` - Who receives the notification
- `recipientModel` - User type (Admin or Client)
- `type` - Notification channel
- `category` - Notification category
- `subject`, `message` - Notification content
- `status` - Delivery status
- `sentAt` - When sent
- `readAt` - When read
- `metadata` - Additional data
- Timestamps

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
  repliedBy?: ObjectId; // Reference to User
  repliedAt?: Date;
  reply?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Fields:**
- `name`, `email`, `phone` - Sender details
- `subject`, `message` - Message content
- `status` - Message status
- `repliedBy` - Admin who replied
- `repliedAt` - Reply timestamp
- `reply` - Reply message
- Timestamps

---

## 🎮 Controllers

### 1. Auth Controllers

#### `authController.ts`
- `registerClient()` - Client registration
- `registerAdmin()` - Admin registration (super admin only)
- `login()` - Login for both clients and admins
- `logout()` - Logout user
- `forgotPassword()` - Send password reset email
- `resetPassword()` - Reset password with token
- `verifyEmail()` - Verify client email
- `refreshToken()` - Refresh JWT token
- `getMe()` - Get current user profile

---

### 2. Client Controllers

#### `clientController.ts`
- `getAllClients()` - Get all clients (admin)
- `getClient()` - Get single client
- `updateClient()` - Update client profile
- `deleteClient()` - Delete client (admin)
- `getClientStats()` - Get client statistics
- `getClientProjects()` - Get client's projects
- `getClientInvoices()` - Get client's invoices
- `getClientPayments()` - Get client's payments

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

---

### 4. Quotation Controllers

#### `quotationController.ts`
- `createQuotation()` - Create quotation (admin or client request)
- `getAllQuotations()` - Get all quotations (admin)
- `getQuotation()` - Get single quotation
- `updateQuotation()` - Update quotation (admin)
- `deleteQuotation()` - Delete quotation (admin)
- `acceptQuotation()` - Client accepts quotation
- `rejectQuotation()` - Client rejects quotation
- `convertToInvoice()` - Convert quotation to invoice
- `generateQuotationPDF()` - Generate PDF
- `sendQuotation()` - Email quotation to client
- `getClientQuotations()` - Get client's quotations

---

### 5. Invoice Controllers

#### `invoiceController.ts`
- `createInvoice()` - Create invoice (admin)
- `getAllInvoices()` - Get all invoices (admin)
- `getInvoice()` - Get single invoice
- `updateInvoice()` - Update invoice (admin)
- `deleteInvoice()` - Delete invoice (admin)
- `markAsPaid()` - Mark invoice as paid
- `markAsOverdue()` - Mark invoice as overdue
- `generateInvoicePDF()` - Generate PDF
- `sendInvoice()` - Email invoice to client
- `getClientInvoices()` - Get client's invoices
- `getInvoiceStats()` - Get invoice statistics

---

### 6. Payment Controllers

#### `paymentController.ts`
- `createPayment()` - Record payment
- `getAllPayments()` - Get all payments (admin)
- `getPayment()` - Get single payment
- `updatePayment()` - Update payment (admin)
- `deletePayment()` - Delete payment (admin)
- `initiateMpesaPayment()` - M-Pesa integration
- `mpesaCallback()` - M-Pesa webhook
- `initiateStripePayment()` - Stripe integration
- `stripeWebhook()` - Stripe webhook
- `getClientPayments()` - Get client's payments
- `getPaymentStats()` - Get payment statistics

---

### 7. Project Controllers

#### `projectController.ts`
- `createProject()` - Create project (admin)
- `getAllProjects()` - Get all projects
- `getProject()` - Get single project
- `updateProject()` - Update project
- `deleteProject()` - Delete project (admin)
- `assignTeamMembers()` - Assign team to project
- `updateProjectStatus()` - Update status
- `updateProgress()` - Update progress percentage
- `addMilestone()` - Add project milestone
- `updateMilestone()` - Update milestone
- `uploadAttachment()` - Upload project file
- `deleteAttachment()` - Delete project file
- `getClientProjects()` - Get client's projects

---

### 8. Testimonial Controllers

#### `testimonialController.ts`
- `createTestimonial()` - Client submits testimonial
- `getAllTestimonials()` - Get all testimonials (admin)
- `getPublishedTestimonials()` - Get public testimonials
- `getTestimonial()` - Get single testimonial
- `updateTestimonial()` - Update testimonial
- `deleteTestimonial()` - Delete testimonial
- `approveTestimonial()` - Admin approves testimonial
- `publishTestimonial()` - Publish testimonial
- `unpublishTestimonial()` - Unpublish testimonial

---

### 9. Notification Controllers

#### `notificationController.ts`
- `sendNotification()` - Send notification
- `getUserNotifications()` - Get user's notifications
- `markAsRead()` - Mark notification as read
- `markAllAsRead()` - Mark all as read
- `deleteNotification()` - Delete notification
- `sendInvoiceReminder()` - Send invoice reminder
- `sendPaymentConfirmation()` - Send payment confirmation

---

### 10. Contact Controllers

#### `contactController.ts`
- `submitContactMessage()` - Submit contact form
- `getAllMessages()` - Get all messages (admin)
- `getMessage()` - Get single message
- `markAsRead()` - Mark as read
- `replyToMessage()` - Reply to message
- `deleteMessage()` - Delete message
- `archiveMessage()` - Archive message

---

### 11. Dashboard Controllers

#### `dashboardController.ts`
- `getAdminDashboard()` - Admin dashboard stats
- `getClientDashboard()` - Client dashboard stats
- `getRevenueStats()` - Revenue analytics
- `getProjectStats()` - Project statistics
- `getClientActivityStats()` - Client activity
- `getServiceDemandStats()` - Service demand analytics

---

### 12. User Controllers (Admin Management)

#### `userController.ts`
- `createUser()` - Create admin user (super admin)
- `getAllUsers()` - Get all admin users
- `getUser()` - Get single user
- `updateUser()` - Update user
- `deleteUser()` - Delete user
- `toggleUserStatus()` - Activate/deactivate user
- `updateRole()` - Update user role
- `updateProfile()` - Update own profile

---

## 🛣️ Routes

### Auth Routes
**Base:** `/api/auth`

```typescript
POST   /register/client           // Client registration
POST   /register/admin            // Admin registration (super admin only)
POST   /login                     // Login
POST   /logout                    // Logout
POST   /forgot-password           // Forgot password
POST   /reset-password/:token     // Reset password
POST   /verify-email/:token       // Verify email
POST   /refresh-token             // Refresh token
GET    /me                        // Get current user
```

---

### Client Routes
**Base:** `/api/clients`

```typescript
GET    /                          // Get all clients (admin)
GET    /:id                       // Get single client
PUT    /:id                       // Update client
DELETE /:id                       // Delete client (admin)
GET    /:id/stats                 // Get client stats
GET    /:id/projects              // Get client projects
GET    /:id/invoices              // Get client invoices
GET    /:id/payments              // Get client payments
```

---

### Service Routes
**Base:** `/api/services`

```typescript
POST   /                          // Create service (admin)
GET    /                          // Get all services
GET    /active                    // Get active services
GET    /:id                       // Get single service
PUT    /:id                       // Update service (admin)
DELETE /:id                       // Delete service (admin)
PATCH  /:id/toggle-status         // Toggle service status
```

---

### Quotation Routes
**Base:** `/api/quotations`

```typescript
POST   /                          // Create quotation
GET    /                          // Get all quotations (admin)
GET    /client/:clientId          // Get client quotations
GET    /:id                       // Get single quotation
PUT    /:id                       // Update quotation
DELETE /:id                       // Delete quotation
POST   /:id/accept                // Accept quotation (client)
POST   /:id/reject                // Reject quotation (client)
POST   /:id/convert-to-invoice    // Convert to invoice
GET    /:id/pdf                   // Generate PDF
POST   /:id/send                  // Send quotation via email
```

---

### Invoice Routes
**Base:** `/api/invoices`

```typescript
POST   /                          // Create invoice
GET    /                          // Get all invoices (admin)
GET    /client/:clientId          // Get client invoices
GET    /:id                       // Get single invoice
PUT    /:id                       // Update invoice
DELETE /:id                       // Delete invoice
PATCH  /:id/mark-paid             // Mark as paid
PATCH  /:id/mark-overdue          // Mark as overdue
GET    /:id/pdf                   // Generate PDF
POST   /:id/send                  // Send invoice via email
GET    /stats                     // Invoice statistics
```

---

### Payment Routes
**Base:** `/api/payments`

```typescript
POST   /                          // Create payment
GET    /                          // Get all payments (admin)
GET    /client/:clientId          // Get client payments
GET    /:id                       // Get single payment
PUT    /:id                       // Update payment
DELETE /:id                       // Delete payment
POST   /mpesa/initiate            // Initiate M-Pesa payment
POST   /mpesa/callback            // M-Pesa callback
POST   /stripe/initiate           // Initiate Stripe payment
POST   /stripe/webhook            // Stripe webhook
GET    /stats                     // Payment statistics
```

---

### Project Routes
**Base:** `/api/projects`

```typescript
POST   /                          // Create project
GET    /                          // Get all projects
GET    /client/:clientId          // Get client projects
GET    /:id                       // Get single project
PUT    /:id                       // Update project
DELETE /:id                       // Delete project
POST   /:id/assign                // Assign team members
PATCH  /:id/status                // Update status
PATCH  /:id/progress              // Update progress
POST   /:id/milestones            // Add milestone
PUT    /:id/milestones/:milestoneId  // Update milestone
POST   /:id/attachments           // Upload attachment
DELETE /:id/attachments/:attachmentId  // Delete attachment
```

---

### Testimonial Routes
**Base:** `/api/testimonials`

```typescript
POST   /                          // Create testimonial (client)
GET    /                          // Get all testimonials (admin)
GET    /published                 // Get published testimonials
GET    /:id                       // Get single testimonial
PUT    /:id                       // Update testimonial
DELETE /:id                       // Delete testimonial
POST   /:id/approve               // Approve testimonial (admin)
POST   /:id/publish               // Publish testimonial (admin)
POST   /:id/unpublish             // Unpublish testimonial (admin)
```

---

### Notification Routes
**Base:** `/api/notifications`

```typescript
POST   /                          // Send notification
GET    /                          // Get user notifications
PATCH  /:id/read                  // Mark as read
PATCH  /read-all                  // Mark all as read
DELETE /:id                       // Delete notification
POST   /invoice-reminder          // Send invoice reminder
POST   /payment-confirmation      // Send payment confirmation
```

---

### Contact Routes
**Base:** `/api/contact`

```typescript
POST   /                          // Submit contact message
GET    /                          // Get all messages (admin)
GET    /:id                       // Get single message
PATCH  /:id/read                  // Mark as read
POST   /:id/reply                 // Reply to message
DELETE /:id                       // Delete message
PATCH  /:id/archive               // Archive message
```

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
POST   /                          // Create admin user (super admin)
GET    /                          // Get all users
GET    /:id                       // Get single user
PUT    /:id                       // Update user
DELETE /:id                       // Delete user
PATCH  /:id/toggle-status         // Toggle status
PATCH  /:id/role                  // Update role
PUT    /profile                   // Update own profile
```

---

## 🏗️ Architecture Overview

### Folder Structure
```
sire-api/
├── src/
│   ├── config/
│   │   ├── database.ts          # MongoDB connection
│   │   ├── cloudinary.ts        # File upload config
│   │   ├── swagger.ts          # Swagger documentation config
│   │   └── payment.ts           # Payment gateway config
│   │   
│   ├── models/
│   │   ├── User.ts
│   │   ├── Client.ts
│   │   ├── Service.ts
│   │   ├── Quotation.ts
│   │   ├── Invoice.ts
│   │   ├── Payment.ts
│   │   ├── Project.ts
│   │   ├── Testimonial.ts
│   │   ├── Notification.ts
│   │   └── ContactMessage.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── clientController.ts
│   │   ├── serviceController.ts
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
│   │   ├── clientRoutes.ts
│   │   ├── serviceRoutes.ts
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
│   │   ├── auth.ts              # JWT authentication
│   │   ├── authorize.ts         # Role-based access
│   │   ├── validate.ts          # Request validation
│   │   ├── errorHandler.ts     # Error handling
│   │   └── upload.ts            # File upload
│   ├── services/
│   │   ├── internal/
│   │   │   ├── emailService.ts      # Internal email service
│   │   │   ├── smsService.ts        # Internal SMS service
│   │   │   ├── pdfService.ts        # Internal PDF generation
│   │   │   ├── notificationService.ts # Internal notifications
│   │   │   ├── fileService.ts       # Internal file handling
│   │   │   └── analyticsService.ts   # Internal analytics
│   │   └── external/
│   │       ├── daraja.ts            # M-Pesa Daraja API
│   │       ├── paystack.ts         # Paystack payment gateway
│   │       ├── stripe.ts           # Stripe payment gateway
│   │       ├── paypal.ts           # PayPal integration
│   │       ├── africastalking.ts   # Africa's Talking SMS
│   │       ├── cloudinary.ts       # Cloudinary file storage
│   │       ├── nodemailer.ts      # Nodemailer email service
│   │       └── quickbooks.ts       # QuickBooks integration
│   ├── utils/
│   │   ├── generatePDF.ts       # PDF generation utilities
│   │   ├── generateToken.ts     # JWT utilities
│   │   ├── validators.ts        # Validation schemas
│   │   ├── helpers.ts           # General helper functions
│   │   ├── constants.ts         # Application constants
│   │   └── logger.ts            # Logging utilities 
│   ├── types/
│   │   ├── express.d.ts         # Express type extensions
│   │   └── index.ts             # Custom types
│   └── index.ts                 # App entry point
├── @doc/                        # Documentation
├── .env                         # Environment variables
├── .gitignore
├── package.json
└── tsconfig.json
```

---

### Middleware

#### Authentication Middleware
- `protect` - Verify JWT token
- `authorize(...roles)` - Role-based access control

#### Validation Middleware
- `validateRequest` - Validate request body/params/query

#### Error Handling
- `errorHandler` - Global error handler
- `asyncHandler` - Async route wrapper

#### File Upload
- `uploadSingle` - Single file upload
- `uploadMultiple` - Multiple files upload

---

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/sire-tech

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password
FROM_EMAIL=noreply@siretech.com
FROM_NAME=Sire Tech

# SMS
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username

# M-Pesa
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Cloudinary (File Upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL
CLIENT_URL=http://localhost:3000
```

---

### Security Features

1. **Authentication**
   - JWT-based authentication
   - Password hashing with bcryptjs
   - Email verification
   - Password reset functionality

2. **Authorization**
   - Role-based access control (RBAC)
   - Route-level permissions
   - Resource ownership validation

3. **Data Protection**
   - Helmet.js for security headers
   - CORS configuration
   - Rate limiting
   - Input validation and sanitization
   - MongoDB injection prevention

4. **API Security**
   - Request validation
   - Error message sanitization
   - Secure cookie handling
   - HTTPS enforcement in production

---

### Integration Points

1. **Payment Gateways**
   - M-Pesa (Mobile Money)
   - Stripe (Cards)
   - PayPal

2. **Communication**
   - Nodemailer (Email)
   - Africa's Talking (SMS)

3. **File Storage**
   - Cloudinary (Images/Documents)

4. **PDF Generation**
   - PDFKit (Invoices/Quotations with table support)
   - **Recommended for Tables:** PDFKit with custom table utilities
   - **Alternative:** Puppeteer for HTML-to-PDF with complex layouts

5. **Future Integrations**
   - QuickBooks (Accounting)
   - AI API (Quotation Generation)

---

## 📄 PDF Generation with Table Support

### Recommended PDF Libraries for Tables

Based on your requirements for table support in PDFs, here are the best options:

#### 1. **PDFKit (Recommended)**
- **Version:** `^0.17.1` (as specified in your dependencies)
- **Table Support:** Excellent with custom table utilities
- **Pros:** 
  - Native table support with proper formatting
  - Lightweight and fast
  - Full control over table styling
  - Works well for invoices, quotations, and reports
- **Cons:** Requires manual table layout code

#### 2. **Puppeteer (Alternative for Complex Layouts)**
- **Table Support:** Excellent (renders HTML tables perfectly)
- **Pros:**
  - Perfect HTML table rendering
  - CSS styling support
  - Handles complex layouts automatically
- **Cons:** Heavier resource usage, requires headless browser

#### 3. **pdfmake (JSON-based)**
- **Table Support:** Good with declarative syntax
- **Pros:** Easy to use, JSON-based table definitions
- **Cons:** Limited styling options compared to PDFKit

### PDFKit Table Implementation Example

```typescript
// utils/generatePDF.ts
import PDFDocument from 'pdfkit';
import { StreamBuffers } from 'stream-buffers';

export const generateInvoicePDF = (invoiceData: any) => {
  const doc = new PDFDocument({ margin: 50 });
  const stream = new StreamBuffers();
  
  doc.pipe(stream);
  
  // Header
  doc.fontSize(20).text('INVOICE', 50, 50);
  doc.fontSize(12).text(`Invoice #: ${invoiceData.invoiceNumber}`, 50, 80);
  
  // Table headers
  const tableTop = 150;
  const itemCodeX = 50;
  const descriptionX = 100;
  const quantityX = 350;
  const priceX = 400;
  const totalX = 500;
  
  // Table header
  doc.fontSize(10)
     .text('Item', itemCodeX, tableTop)
     .text('Description', descriptionX, tableTop)
     .text('Qty', quantityX, tableTop)
     .text('Price', priceX, tableTop)
     .text('Total', totalX, tableTop);
  
  // Table rows
  let currentY = tableTop + 20;
  invoiceData.items.forEach((item: any) => {
    doc.fontSize(9)
       .text(item.code, itemCodeX, currentY)
       .text(item.description, descriptionX, currentY)
       .text(item.quantity.toString(), quantityX, currentY)
       .text(`$${item.price.toFixed(2)}`, priceX, currentY)
       .text(`$${item.total.toFixed(2)}`, totalX, currentY);
    
    currentY += 20;
  });
  
  // Totals
  const totalsY = currentY + 20;
  doc.fontSize(10)
     .text(`Subtotal: $${invoiceData.subtotal.toFixed(2)}`, 400, totalsY)
     .text(`Tax: $${invoiceData.tax.toFixed(2)}`, 400, totalsY + 20)
     .text(`Total: $${invoiceData.totalAmount.toFixed(2)}`, 400, totalsY + 40);
  
  doc.end();
  
  return new Promise((resolve) => {
    stream.on('finish', () => {
      resolve(stream.getContents());
    });
  });
};
```

### Advanced Table Utilities for PDFKit

```typescript
// utils/tableUtils.ts
export class PDFTable {
  private doc: PDFDocument;
  private startX: number;
  private startY: number;
  private tableWidth: number;
  private columnWidths: number[];
  
  constructor(doc: PDFDocument, startX: number, startY: number, tableWidth: number, columnWidths: number[]) {
    this.doc = doc;
    this.startX = startX;
    this.startY = startY;
    this.tableWidth = tableWidth;
    this.columnWidths = columnWidths;
  }
  
  drawTable(headers: string[], rows: string[][], options: any = {}) {
    const { cellPadding = 5, fontSize = 10, headerFontSize = 12 } = options;
    let currentY = this.startY;
    
    // Draw headers
    this.doc.fontSize(headerFontSize).fillColor('#333');
    let currentX = this.startX;
    headers.forEach((header, index) => {
      this.doc.text(header, currentX + cellPadding, currentY + cellPadding);
      currentX += this.columnWidths[index];
    });
    
    // Draw header underline
    this.doc.moveTo(this.startX, currentY + 25)
           .lineTo(this.startX + this.tableWidth, currentY + 25)
           .stroke();
    
    currentY += 30;
    
    // Draw rows
    this.doc.fontSize(fontSize).fillColor('#000');
    rows.forEach((row, rowIndex) => {
      currentX = this.startX;
      row.forEach((cell, cellIndex) => {
        this.doc.text(cell, currentX + cellPadding, currentY + cellPadding);
        currentX += this.columnWidths[cellIndex];
      });
      
      // Draw row separator
      if (rowIndex < rows.length - 1) {
        this.doc.moveTo(this.startX, currentY + 20)
               .lineTo(this.startX + this.tableWidth, currentY + 20)
               .stroke();
      }
      
      currentY += 25;
    });
    
    return currentY;
  }
}
```

### Puppeteer Alternative (for HTML Tables)

```typescript
// utils/puppeteerPDF.ts
import puppeteer from 'puppeteer';

export const generateHTMLToPDF = async (htmlContent: string) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent);
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '1cm',
      right: '1cm',
      bottom: '1cm',
      left: '1cm'
    }
  });
  
  await browser.close();
  return pdf;
};
```

### HTML Table Template for Puppeteer

```html
<!-- templates/invoice.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .invoice-table th, .invoice-table td { 
      border: 1px solid #ddd; 
      padding: 8px; 
      text-align: left; 
    }
    .invoice-table th { background-color: #f2f2f2; }
    .totals { text-align: right; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <p>Invoice #: {{invoiceNumber}}</p>
  </div>
  
  <table class="invoice-table">
    <thead>
      <tr>
        <th>Item</th>
        <th>Description</th>
        <th>Quantity</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{code}}</td>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>${{price}}</td>
        <td>${{total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  
  <div class="totals">
    <p>Subtotal: ${{subtotal}}</p>
    <p>Tax: ${{tax}}</p>
    <p><strong>Total: ${{totalAmount}}</strong></p>
  </div>
</body>
</html>
```

### Package Recommendations for Table Support

```json
{
  "pdfkit": "^0.17.1",           // Primary PDF generation
  "stream-buffers": "^3.0.3",    // For PDFKit streaming
  "puppeteer": "^21.0.0",        // Alternative for HTML-to-PDF
  "handlebars": "^4.7.8"         // For HTML templating (if using Puppeteer)
}
```

### Why PDFKit is Recommended for Your Use Case

1. **Native Table Support:** PDFKit has excellent built-in support for creating tables
2. **Performance:** Lightweight and fast compared to headless browsers
3. **Control:** Full control over table styling, borders, and formatting
4. **Server-Friendly:** No browser dependencies, works well in serverless environments
5. **Invoice/Quotation Ready:** Perfect for business documents with itemized tables

---

## 🚀 Getting Started

### Installation
```bash
cd sire-api
npm install
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

**Last Updated:** October 2025
**Version:** 1.0.0
