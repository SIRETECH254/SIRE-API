import express from 'express';
import {
    createService,
    getAllServices,
    getActiveServices,
    getService,
    updateService,
    deleteService,
    toggleServiceStatus,
    uploadServiceIcon
} from '../controllers/serviceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { uploadServiceIcon as uploadIconMiddleware } from '../config/cloudinary';

const router = express.Router();

/**
 * @route   GET /api/services/active
 * @desc    Get all active services
 * @access  Public
 */
router.get('/active', getActiveServices);

/**
 * @route   POST /api/services
 * @desc    Create new service
 * @access  Private (Admin)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), createService);

/**
 * @route   GET /api/services
 * @desc    Get all services with filtering and pagination
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager', 'staff']), getAllServices);

/**
 * @route   GET /api/services/:serviceId
 * @desc    Get single service
 * @access  Public
 */
router.get('/:serviceId', getService);

/**
 * @route   PUT /api/services/:serviceId
 * @desc    Update service
 * @access  Private (Admin)
 */
router.put('/:serviceId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), updateService);

/**
 * @route   DELETE /api/services/:serviceId
 * @desc    Delete service
 * @access  Private (Super Admin only)
 */
router.delete('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), deleteService);

/**
 * @route   PATCH /api/services/:serviceId/toggle-status
 * @desc    Toggle service active/inactive status
 * @access  Private (Admin)
 */
router.patch('/:serviceId/toggle-status', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), toggleServiceStatus);

/**
 * @route   POST /api/services/:serviceId/icon
 * @desc    Upload service icon
 * @access  Private (Admin)
 */
router.post('/:serviceId/icon', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), uploadIconMiddleware.single('icon'), uploadServiceIcon);

export default router;

