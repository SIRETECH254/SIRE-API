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

router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), sendNotification);
router.get('/', authenticateToken, getUserNotifications);
router.get('/:notificationId', authenticateToken, getNotification);
router.patch('/:notificationId/read', authenticateToken, markAsRead);
router.patch('/read-all', authenticateToken, markAllAsRead);
router.delete('/:notificationId', authenticateToken, deleteNotification);

export default router;


