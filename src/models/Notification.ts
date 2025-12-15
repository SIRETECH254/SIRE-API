import mongoose, { Schema } from 'mongoose';
import type { INotification } from '../types/index';

const notificationSchema = new Schema<INotification>({
  recipient: {
    type: Schema.Types.ObjectId,
    required: [true, 'Recipient is required'],
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: [true, 'Recipient model is required'],
    enum: {
      values: ['User'],
      message: 'Recipient model must be User'
    },
    default: 'User'
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: {
      values: ['email', 'sms', 'push', 'in_app'],
      message: 'Type must be email, sms, push, or in_app'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['invoice', 'payment', 'project', 'quotation', 'general'],
      message: 'Category must be invoice, payment, project, quotation, or general'
    }
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'sent', 'failed'],
      message: 'Status must be pending, sent, or failed'
    },
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  // Bidirectional Notification Support
  actions: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['api', 'navigate', 'modal', 'confirm'],
      required: true 
    },
    endpoint: String,
    method: { 
      type: String, 
      enum: ['GET', 'POST', 'PATCH', 'DELETE'] 
    },
    payload: Schema.Types.Mixed,
    route: String,
    modal: String,
    variant: { 
      type: String, 
      enum: ['primary', 'secondary', 'danger', 'success'] 
    },
    requiresConfirmation: Boolean,
    confirmationMessage: String
  }],
  context: {
    resourceId: String,
    resourceType: String,
    additionalData: Schema.Types.Mixed
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1 });
notificationSchema.index({ recipientModel: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ readAt: 1 });
notificationSchema.index({ recipient: 1, readAt: 1 });
notificationSchema.index({ createdAt: -1 });

notificationSchema.virtual('isUnread').get(function() {
  return !(this as any).readAt;
});

notificationSchema.set('toJSON', { virtuals: true });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;


