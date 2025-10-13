import express from 'express';
import {
    getUserProfile,
    updateUserProfile,
    changePassword,
    getNotificationPreferences,
    updateNotificationPreferences,
    getAllUsers,
    getUserById,
    updateUserStatus,
    setUserAdmin,
    getUserRoles,
    deleteUser,
    adminCreateCustomer
} from '../controllers/userController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update own profile
 * @access  Private
 */
router.put('/profile', authenticateToken, updateUserProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change password
 * @access  Private
 */
router.put('/change-password', authenticateToken, changePassword);

/**
 * @route   GET /api/users/notifications
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/notifications', authenticateToken, getNotificationPreferences);

/**
 * @route   PUT /api/users/notifications
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/notifications', authenticateToken, updateNotificationPreferences);

/**
 * @route   POST /api/users/admin-create
 * @desc    Admin create customer
 * @access  Private (Admin only)
 */
router.post('/admin-create', authenticateToken, authorizeRoles(['super_admin', 'finance']), adminCreateCustomer);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllUsers);

/**
 * @route   GET /api/users/:userId
 * @desc    Get single user (admin)
 * @access  Private (Admin only)
 */
router.get('/:userId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getUserById);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Update user status (admin)
 * @access  Private (Admin only)
 */
router.put('/:userId/status', authenticateToken, authorizeRoles(['super_admin']), updateUserStatus);

/**
 * @route   PUT /api/users/:userId/admin
 * @desc    Set user admin status (admin)
 * @access  Private (Super Admin only)
 */
router.put('/:userId/admin', authenticateToken, requireAdmin, setUserAdmin);

/**
 * @route   GET /api/users/:userId/roles
 * @desc    Get user roles (admin)
 * @access  Private (Admin only)
 */
router.get('/:userId/roles', authenticateToken, authorizeRoles(['super_admin', 'finance']), getUserRoles);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user (admin)
 * @access  Private (Super Admin only)
 */
router.delete('/:userId', authenticateToken, requireAdmin, deleteUser);

export default router;
