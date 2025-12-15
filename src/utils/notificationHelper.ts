import Notification from '../models/Notification';
import User from '../models/User';
import { Server as SocketIOServer } from 'socket.io';
import type { NotificationAction, NotificationContext } from '../types';

interface CreateInAppNotificationParams {
  recipient: string;
  recipientModel: 'User';
  category: 'invoice' | 'payment' | 'project' | 'quotation' | 'general';
  subject: string;
  message: string;
  actions?: NotificationAction[];
  context?: NotificationContext;
  expiresAt?: Date;
  metadata?: any;
  io?: SocketIOServer;
}

export const createInAppNotification = async (params: CreateInAppNotificationParams): Promise<any> => {
  try {
    const { 
      recipient, 
      recipientModel, 
      category, 
      subject, 
      message, 
      actions,
      context,
      expiresAt,
      metadata, 
      io 
    } = params;

    // ✅ CHECK USER NOTIFICATION PREFERENCES
    const recipientUser = await User.findById(recipient).select('notificationPreferences');
    
    // Check if in-app notifications are enabled for this user
    if (recipientUser && recipientUser.notificationPreferences) {
      const inAppEnabled = recipientUser.notificationPreferences.inApp;
      
      // If in-app notifications are disabled, skip sending
      if (inAppEnabled === false) {
        console.log(`In-app notification skipped for ${recipientModel} ${recipient}: preference disabled`);
        return null;
      }
    }

    // Create notification record
    const notification = new Notification({
      recipient,
      recipientModel,
      type: 'in_app',
      category,
      subject,
      message,
      actions, // Actions array for bidirectional notifications
      context, // Context data for actions
      expiresAt, // Optional expiry for time-sensitive actions
      metadata,
      status: 'pending'
    });

    await notification.save();

    // Mark as sent
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();

    // Emit Socket.io event with full notification data including actions
    if (io) {
      const roomId = `user_${recipient}`;
      io.to(roomId).emit('notification', {
        notificationId: notification._id,
        category,
        subject,
        message,
        actions, // Include actions in Socket.io event
        context,
        expiresAt,
        metadata,
        createdAt: notification.createdAt
      });
    }

    console.log(`In-app notification with actions sent to ${recipientModel} ${recipient}: ${subject}`);
    return notification;
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    throw error; // Re-throw for caller to handle
  }
};

