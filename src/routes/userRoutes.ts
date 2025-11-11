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
import { uploadUserAvatar } from '../config/cloudinary';

const router = express.Router();

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User profile
 *   put:
 *     tags: [Users]
 *     summary: Update own profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Updated
 *
 * /api/users/change-password:
 *   put:
 *     tags: [Users]
 *     summary: Change password
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Password changed
 *
 * /api/users/notifications:
 *   get:
 *     tags: [Users]
 *     summary: Get notification preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Preferences
 *   put:
 *     tags: [Users]
 *     summary: Update notification preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Preferences updated
 *
 * /api/users/admin-create:
 *   post:
 *     tags: [Users]
 *     summary: Admin create customer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Created
 *
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of users
 *
 * /api/users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get single user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User
 *   delete:
 *     tags: [Users]
 *     summary: Delete user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 *
 * /api/users/{userId}/status:
 *   put:
 *     tags: [Users]
 *     summary: Update user status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Status updated
 *
 * /api/users/{userId}/admin:
 *   put:
 *     tags: [Users]
 *     summary: Set user admin status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Admin updated
 *
 * /api/users/{userId}/roles:
 *   get:
 *     tags: [Users]
 *     summary: Get user roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Roles
 */
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
router.put('/profile', authenticateToken, uploadUserAvatar.single('avatar'), updateUserProfile);

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
