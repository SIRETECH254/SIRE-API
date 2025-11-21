import express from 'express';
import {
    getAllRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    getUsersByRole,
    getClients
} from '../controllers/roleController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/roles
 * @desc    Get all roles
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllRoles);

/**
 * @route   GET /api/roles/:roleId
 * @desc    Get single role
 * @access  Private (Admin)
 */
router.get('/:roleId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getRole);

/**
 * @route   POST /api/roles
 * @desc    Create role
 * @access  Private (Super Admin only)
 */
router.post('/', authenticateToken, requireAdmin, createRole);

/**
 * @route   PUT /api/roles/:roleId
 * @desc    Update role
 * @access  Private (Super Admin only)
 */
router.put('/:roleId', authenticateToken, requireAdmin, updateRole);

/**
 * @route   DELETE /api/roles/:roleId
 * @desc    Delete role
 * @access  Private (Super Admin only)
 */
router.delete('/:roleId', authenticateToken, requireAdmin, deleteRole);

/**
 * @route   GET /api/roles/:roleId/users
 * @desc    Get users with specific role
 * @access  Private (Admin)
 */
router.get('/:roleId/users', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getUsersByRole);

/**
 * @route   GET /api/roles/client/users
 * @desc    Get clients (users with client role)
 * @access  Private (Admin)
 */
router.get('/client/users', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getClients);

export default router;

