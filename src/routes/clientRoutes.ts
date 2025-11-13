import express from 'express';
import {
    registerClient,
    verifyClientOTP,
    resendClientOTP,
    loginClient,
    forgotClientPassword,
    resetClientPassword,
    getClientProfile,
    updateClientProfile,
    changeClientPassword,
    getClientDashboard,
    getAllClients,
    getClient,
    updateClient,
    deleteClient,
    updateClientStatus,
    getClientStats,
    getClientProjects,
    getClientInvoices,
    getClientPayments,
    getClientQuotations
} from '../controllers/clientController';
import { authenticateToken, authorizeRoles, requireOwnershipOrAdmin } from '../middleware/auth';
import { uploadUserAvatar } from '../config/cloudinary';

const router = express.Router();

/**
 * @route   POST /api/clients/register
 * @desc    Register new client with OTP verification
 * @access  Public
 */
router.post('/register', registerClient);

/**
 * @route   POST /api/clients/verify-otp
 * @desc    Verify OTP and activate client account
 * @access  Public
 */
router.post('/verify-otp', verifyClientOTP);

/**
 * @route   POST /api/clients/resend-otp
 * @desc    Resend OTP for verification
 * @access  Public
 */
router.post('/resend-otp', resendClientOTP);

/**
 * @route   POST /api/clients/login
 * @desc    Client login (email/phone + password)
 * @access  Public
 */
router.post('/login', loginClient);

/**
 * @route   POST /api/clients/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', forgotClientPassword);

/**
 * @route   POST /api/clients/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', resetClientPassword);

/**
 * @route   GET /api/clients/profile
 * @desc    Get current client profile
 * @access  Private (Client)
 */
router.get('/profile', authenticateToken, getClientProfile);

/**
 * @route   PUT /api/clients/profile
 * @desc    Update own profile
 * @access  Private (Client)
 */
router.put('/profile', authenticateToken, uploadUserAvatar.single('avatar'), updateClientProfile);

/**
 * @route   PUT /api/clients/change-password
 * @desc    Change client password
 * @access  Private (Client)
 */
router.put('/change-password', authenticateToken, changeClientPassword);

/**
 * @route   GET /api/clients/dashboard
 * @desc    Get client dashboard with statistics
 * @access  Private (Client)
 */
router.get('/dashboard', authenticateToken, getClientDashboard);

/**
 * @route   GET /api/clients
 * @desc    Get all clients (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllClients);

/**
 * @route   GET /api/clients/:clientId
 * @desc    Get single client
 * @access  Private (Client or Admin)
 */
router.get('/:clientId', authenticateToken, requireOwnershipOrAdmin('clientId'), getClient);

/**
 * @route   PUT /api/clients/:clientId
 * @desc    Update client (admin)
 * @access  Private (Client or Admin)
 */
router.put('/:clientId', authenticateToken, requireOwnershipOrAdmin('clientId'), uploadUserAvatar.single('avatar'), updateClient);

/**
 * @route   DELETE /api/clients/:clientId
 * @desc    Delete client
 * @access  Private (Super Admin only)
 */
router.delete('/:clientId', authenticateToken, authorizeRoles(['super_admin']), deleteClient);

/**
 * @route   PUT /api/clients/:clientId/status
 * @desc    Update client status (admin)
 * @access  Private (Admin only)
 */
router.put('/:clientId/status', authenticateToken, authorizeRoles(['super_admin']), updateClientStatus);

/**
 * @route   GET /api/clients/:clientId/stats
 * @desc    Get client statistics
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/stats', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientStats);

/**
 * @route   GET /api/clients/:clientId/projects
 * @desc    Get client projects
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/projects', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientProjects);

/**
 * @route   GET /api/clients/:clientId/invoices
 * @desc    Get client invoices
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/invoices', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientInvoices);

/**
 * @route   GET /api/clients/:clientId/payments
 * @desc    Get client payments
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/payments', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientPayments);

/**
 * @route   GET /api/clients/:clientId/quotations
 * @desc    Get client quotations
 * @access  Private (Client or Admin)
 */
router.get('/:clientId/quotations', authenticateToken, requireOwnershipOrAdmin('clientId'), getClientQuotations);

export default router;

