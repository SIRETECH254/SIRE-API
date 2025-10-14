import express from 'express';
import {
    sendNotification,
    getUserNotifications,
    getNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification
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
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), sendNotification);
router.get('/', authenticateToken, getUserNotifications);
router.get('/:notificationId', authenticateToken, getNotification);
router.patch('/:notificationId/read', authenticateToken, markAsRead);
router.patch('/read-all', authenticateToken, markAllAsRead);
router.delete('/:notificationId', authenticateToken, deleteNotification);

export default router;


