import { Document } from 'mongoose';

// ===== USER TYPES =====
export interface IUser extends Document {
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

// User creation input (without _id, createdAt, updatedAt)
export interface ICreateUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: 'super_admin' | 'finance' | 'project_manager' | 'staff';
  phone?: string;
  isActive?: boolean;
  avatar?: string;
}

// User update input (all fields optional except _id)
export interface IUpdateUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: 'super_admin' | 'finance' | 'project_manager' | 'staff';
  phone?: string;
  isActive?: boolean;
  avatar?: string;
}

// User response (without password)
export interface IUserResponse {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'super_admin' | 'finance' | 'project_manager' | 'staff';
  phone?: string;
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

// ===== CLIENT TYPES =====
export interface IClient extends Document {
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

// ===== SERVICE TYPES =====
export interface IService extends Document {
  _id: string;
  title: string;
  description: string;
  features: string[];
  isActive: boolean;
  icon?: string;
  createdBy: string; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}

// ===== QUOTATION TYPES =====
export interface IQuotation extends Document {
  _id: string;
  quotationNumber: string;
  client: string; // Reference to Client
  projectTitle: string;
  projectDescription: string;
  services: Array<{
    service: string; // Reference to Service
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
  createdBy: string; // Reference to User
  convertedToInvoice?: string; // Reference to Invoice
  createdAt: Date;
  updatedAt: Date;
}

// ===== INVOICE TYPES =====
export interface IInvoice extends Document {
  _id: string;
  invoiceNumber: string;
  client: string; // Reference to Client
  quotation?: string; // Reference to Quotation
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
  createdBy: string; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}

// ===== PAYMENT TYPES =====
export interface IPayment extends Document {
  _id: string;
  paymentNumber: string;
  invoice: string; // Reference to Invoice
  client: string; // Reference to Client
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

// ===== PROJECT TYPES =====
export interface IProject extends Document {
  _id: string;
  projectNumber: string;
  title: string;
  description: string;
  client: string; // Reference to Client
  quotation?: string; // Reference to Quotation
  invoice?: string; // Reference to Invoice
  services: string[]; // References to Services
  status: 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string[]; // References to User (team members)
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
    uploadedBy: string;
    uploadedAt: Date;
  }>;
  notes?: string;
  createdBy: string; // Reference to User
  createdAt: Date;
  updatedAt: Date;
}

// ===== TESTIMONIAL TYPES =====
export interface ITestimonial extends Document {
  _id: string;
  client: string; // Reference to Client
  project?: string; // Reference to Project
  rating: number; // 1-5
  message: string;
  isApproved: boolean;
  isPublished: boolean;
  approvedBy?: string; // Reference to User
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===== NOTIFICATION TYPES =====
export interface INotification extends Document {
  _id: string;
  recipient: string; // Reference to User or Client
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

// ===== CONTACT MESSAGE TYPES =====
export interface IContactMessage extends Document {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  repliedBy?: string; // Reference to User
  repliedAt?: Date;
  reply?: string;
  createdAt: Date;
  updatedAt: Date;
}