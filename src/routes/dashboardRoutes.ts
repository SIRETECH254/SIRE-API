import express from 'express';
import {
    getAdminDashboard,
    getClientDashboard,
    getRevenueStats,
    getProjectStats,
    getClientActivityStats,
    getServiceDemandStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/admin', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAdminDashboard);

/**
 * @route   GET /api/dashboard/client
 * @desc    Get client dashboard statistics
 * @access  Private (Client)
 */
router.get('/client', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/dashboard/revenue
 * @desc    Get revenue analytics
 * @access  Private (Admin only - super_admin, finance)
 */
router.get('/revenue', authenticateToken, authorizeRoles(['super_admin', 'finance']), getRevenueStats);

/**
 * @route   GET /api/dashboard/projects
 * @desc    Get project statistics
 * @access  Private (Admin only)
 */
router.get('/projects', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getProjectStats);

/**
 * @route   GET /api/dashboard/client-activity
 * @desc    Get client activity statistics
 * @access  Private (Admin only)
 */
router.get('/client-activity', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getClientActivityStats);

/**
 * @route   GET /api/dashboard/service-demand
 * @desc    Get service demand analytics
 * @access  Private (Admin only)
 */
router.get('/service-demand', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getServiceDemandStats);

export default router;

