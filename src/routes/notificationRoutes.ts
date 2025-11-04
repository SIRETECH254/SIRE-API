import express from 'express';
import {
    sendNotification,
    getUserNotifications,
    getNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,
    getUnreadNotifications,
    getNotificationsByCategory,
    sendInvoiceReminder,
    sendPaymentConfirmation,
    sendProjectUpdate,
    sendBulkNotification
} from '../controllers/notificationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of notifications
 *   post:
 *     tags: [Notifications]
 *     summary: Send notification
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Notification sent
 *
 * /api/notifications/{notificationId}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get single notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Notification
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 *
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Marked read
 *
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: All marked read
 */
// Notification Management Routes
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), sendNotification);
router.get('/', authenticateToken, getUserNotifications);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.get('/unread', authenticateToken, getUnreadNotifications);

// Notification Actions
router.get('/:notificationId', authenticateToken, getNotification);
router.patch('/:notificationId/read', authenticateToken, markAsRead);
router.delete('/:notificationId', authenticateToken, deleteNotification);
router.patch('/read-all', authenticateToken, markAllAsRead);

// Specific Notification Types
router.post('/invoice-reminder', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendInvoiceReminder);
router.post('/payment-confirmation', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendPaymentConfirmation);
router.post('/project-update', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), sendProjectUpdate);
router.post('/bulk', authenticateToken, authorizeRoles(['super_admin']), sendBulkNotification);

// Query Routes
router.get('/category/:category', authenticateToken, getNotificationsByCategory);

export default router;


