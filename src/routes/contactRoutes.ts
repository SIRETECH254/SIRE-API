import express from 'express';
import {
    submitContactMessage,
    getAllMessages,
    getMessage,
    markAsRead,
    replyToMessage,
    deleteMessage,
    archiveMessage,
    getMyMessages
} from '../controllers/contactController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/contact
 * @desc    Submit contact message
 * @access  Public
 */
router.post('/', submitContactMessage);

/**
 * @route   GET /api/contact/my-messages
 * @desc    Get my contact messages (client)
 * @access  Private (Client)
 */
router.get('/my-messages', authenticateToken, authorizeRoles(['client']), getMyMessages);

/**
 * @route   GET /api/contact
 * @desc    Get all contact messages (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllMessages);

/**
 * @route   GET /api/contact/:messageId
 * @desc    Get single contact message (admin)
 * @access  Private (Admin only)
 */
router.get('/:messageId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getMessage);

/**
 * @route   PATCH /api/contact/:messageId/read
 * @desc    Mark message as read (admin)
 * @access  Private (Admin only)
 */
router.patch('/:messageId/read', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), markAsRead);

/**
 * @route   POST /api/contact/:messageId/reply
 * @desc    Reply to message (admin)
 * @access  Private (Admin only)
 */
router.post('/:messageId/reply', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), replyToMessage);

/**
 * @route   DELETE /api/contact/:messageId
 * @desc    Delete message (admin)
 * @access  Private (Admin only)
 */
router.delete('/:messageId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), deleteMessage);

/**
 * @route   PATCH /api/contact/:messageId/archive
 * @desc    Archive message (admin)
 * @access  Private (Admin only)
 */
router.patch('/:messageId/archive', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), archiveMessage);

export default router;

