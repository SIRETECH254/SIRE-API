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

const router = express.Router();

/**
 * @openapi
 * /api/clients/register:
 *   post:
 *     tags: [Clients]
 *     summary: Register new client with OTP verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               company:
 *                 type: string
 *                 example: "Acme Corp"
 *               address:
 *                 type: string
 *                 example: "123 Main St"
 *               city:
 *                 type: string
 *                 example: "Nairobi"
 *               country:
 *                 type: string
 *                 example: "Kenya"
 *     responses:
 *       '201':
 *         description: Client registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Client registered successfully. Please verify your email with the OTP sent."
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     emailVerified:
 *                       type: boolean
 *       '400':
 *         description: Validation error
 *
 * /api/clients/verify-otp:
 *   post:
 *     tags: [Clients]
 *     summary: Verify OTP and activate client account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       '200':
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Email verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     client:
 *                       type: object
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       '400':
 *         description: Invalid or expired OTP
 *
 * /api/clients/resend-otp:
 *   post:
 *     tags: [Clients]
 *     summary: Resend OTP for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *     responses:
 *       '200':
 *         description: OTP resent successfully
 *
 * /api/clients/login:
 *   post:
 *     tags: [Clients]
 *     summary: Client login (email/phone + password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     client:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         emailVerified:
 *                           type: boolean
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       '401':
 *         description: Invalid credentials
 *       '403':
 *         description: Account not verified or inactive
 *
 * /api/clients/forgot-password:
 *   post:
 *     tags: [Clients]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *     responses:
 *       '200':
 *         description: Reset instructions sent
 *
 * /api/clients/reset-password/{token}:
 *   post:
 *     tags: [Clients]
 *     summary: Reset password with token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "newpassword123"
 *     responses:
 *       '200':
 *         description: Password reset successfully
 *       '400':
 *         description: Invalid or expired token
 *
 * /api/clients/profile:
 *   get:
 *     tags: [Clients]
 *     summary: Get client profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Client profile
 *       '401':
 *         description: Unauthorized
 *   put:
 *     tags: [Clients]
 *     summary: Update client profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               company:
 *                 type: string
 *                 example: "Acme Corp"
 *               address:
 *                 type: string
 *                 example: "123 Main St"
 *               city:
 *                 type: string
 *                 example: "Nairobi"
 *               country:
 *                 type: string
 *                 example: "Kenya"
 *     responses:
 *       '200':
 *         description: Profile updated successfully
 *       '401':
 *         description: Unauthorized
 *
 * /api/clients/change-password:
 *   put:
 *     tags: [Clients]
 *     summary: Change client password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "oldpassword123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "newpassword123"
 *     responses:
 *       '200':
 *         description: Password changed successfully
 *       '400':
 *         description: Current password is incorrect
 *       '401':
 *         description: Unauthorized
 *
 * /api/clients/dashboard:
 *   get:
 *     tags: [Clients]
 *     summary: Get client dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Client dashboard data
 *       '401':
 *         description: Unauthorized
 *
 * /api/clients:
 *   get:
 *     tags: [Clients]
 *     summary: Get all clients (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       '200':
 *         description: List of clients
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *
 * /api/clients/{clientId}:
 *   get:
 *     tags: [Clients]
 *     summary: Get single client
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client details
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 *   put:
 *     tags: [Clients]
 *     summary: Update client (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Client updated successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Client not found
 *   delete:
 *     tags: [Clients]
 *     summary: Delete client (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client deleted successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Client not found
 *
 * /api/clients/{clientId}/status:
 *   patch:
 *     tags: [Clients]
 *     summary: Update client status (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       '200':
 *         description: Client status updated successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Client not found
 *
 * /api/clients/{clientId}/stats:
 *   get:
 *     tags: [Clients]
 *     summary: Get client statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client statistics
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 *
 * /api/clients/{clientId}/projects:
 *   get:
 *     tags: [Clients]
 *     summary: Get client projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client projects
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 *
 * /api/clients/{clientId}/invoices:
 *   get:
 *     tags: [Clients]
 *     summary: Get client invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client invoices
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 *
 * /api/clients/{clientId}/payments:
 *   get:
 *     tags: [Clients]
 *     summary: Get client payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client payments
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 *
 * /api/clients/{clientId}/quotations:
 *   get:
 *     tags: [Clients]
 *     summary: Get client quotations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Client quotations
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 */

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
router.put('/profile', authenticateToken, updateClientProfile);

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
router.put('/:clientId', authenticateToken, requireOwnershipOrAdmin('clientId'), updateClient);

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

