import { Document, Types } from 'mongoose';

// ===== ROLE TYPES =====
export interface IRole extends Document {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== USER TYPES =====
export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: Types.ObjectId[]; // Array of Role references
  phone: string; // Required field
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
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
  primaryRole?: IRole; // Virtual field (first role in array)
}

// User creation input (without _id, createdAt, updatedAt)
export interface ICreateUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles?: Types.ObjectId[];
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
  avatar?: string;
}

// User update input (all fields optional except _id)
export interface IUpdateUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  roles?: Types.ObjectId[];
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
  avatar?: string;
}

// User response (without password)
export interface IUserResponse {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: Types.ObjectId[];
  roleNames?: string[]; // Populated role names
  phone: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
}

// ===== COMMON API TYPES =====
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ===== SERVICE TYPES =====
export interface IService extends Document {
  _id: string;
  title: string;
  description: string;
  features: string[];
  isActive: boolean;
  icon?: string;
  createdBy: Types.ObjectId; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}

// ===== QUOTATION TYPES =====
export interface IQuotation extends Document {
  _id: string;
  quotationNumber: string;
  project: Types.ObjectId; // Reference to Project
  client: Types.ObjectId; // Reference to User
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
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'converted';
  validUntil: Date;
  notes?: string;
  createdBy: Types.ObjectId; // Reference to User
  convertedToInvoice?: Types.ObjectId; // Reference to Invoice
  createdAt: Date;
  updatedAt: Date;
}

// ===== INVOICE TYPES =====
export interface IInvoice extends Document {
  _id: string;
  invoiceNumber: string;
  client: Types.ObjectId; // Reference to User
  quotation?: Types.ObjectId; // Reference to Quotation
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
  createdBy: Types.ObjectId; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}

// ===== PAYMENT TYPES =====
export interface IPayment extends Document {
  _id: string;
  paymentNumber: string;
  invoice: Types.ObjectId; // Reference to Invoice
  client: Types.ObjectId; // Reference to User
  amount: number;
  paymentMethod: 'mpesa' | 'paystack';
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
  reference?: string;
  paymentDate: Date;
  notes?: string;
  metadata?: Record<string, any>;
  processorRefs?: {
    daraja?: {
      merchantRequestId?: string;
      checkoutRequestId?: string;
    };
    paystack?: {
      reference?: string;
    };
  };
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

// ===== PROJECT TYPES =====
export interface IProject extends Document {
  _id: string;
  projectNumber: string;
  title: string;
  description: string;
  client: Types.ObjectId; // Reference to User
  quotation?: Types.ObjectId; // Reference to Quotation
  invoice?: Types.ObjectId; // Reference to Invoice
  services: Types.ObjectId[]; // References to Services
  status: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: Types.ObjectId[]; // References to User (team members)
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
    uploadedBy: Types.ObjectId;
    uploadedAt: Date;
  }>;
  notes?: string;
  createdBy: Types.ObjectId; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}

// ===== TESTIMONIAL TYPES =====
export interface ITestimonial extends Document {
  _id: string;
  client: Types.ObjectId; // Reference to User
  project?: Types.ObjectId; // Reference to Project
  rating: number; // 1-5
  message: string;
  isApproved: boolean;
  isPublished: boolean;
  approvedBy?: Types.ObjectId; // Reference to User
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===== NOTIFICATION TYPES =====
export interface INotification extends Document {
  _id: string;
  recipient: Types.ObjectId; // Reference to User
  recipientModel: 'User';
  type: 'email' | 'sms' | 'push' | 'in_app';
  category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
  subject: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
  // Bidirectional Notification Support
  actions?: NotificationAction[];
  context?: NotificationContext;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'api' | 'navigate' | 'modal' | 'confirm';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, any>;
  route?: string;
  modal?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface NotificationContext {
  resourceId: string;
  resourceType: string;
  additionalData?: Record<string, any>;
}

// ===== CONTACT MESSAGE TYPES =====
export interface IContactMessage extends Document {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  repliedBy?: Types.ObjectId; // Reference to User
  repliedAt?: Date;
  reply?: string;
  createdAt: Date;
  updatedAt: Date;
}