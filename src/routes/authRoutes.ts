import express from 'express';
import {
    register,
    verifyOTP,
    resendOTP,
    login,
    logout,
    forgotPassword,
    resetPassword,
    refreshToken,
    getMe
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register new user with OTP verification
 *     responses:
 *       '201':
 *         description: User registered
 *       '400':
 *         description: Validation error
 *
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify OTP and activate account
 *     responses:
 *       '200':
 *         description: Email verified
 *       '400':
 *         description: Invalid or expired OTP
 *
 * /api/auth/resend-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend OTP for verification
 *     responses:
 *       '200':
 *         description: OTP resent
 *
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login (email/phone + password)
 *     responses:
 *       '200':
 *         description: Login successful
 *       '401':
 *         description: Invalid credentials
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Logged out successfully
 *
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     responses:
 *       '200':
 *         description: Reset instructions sent
 *
 * /api/auth/reset-password/{token}:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Password reset successfully
 *       '400':
 *         description: Invalid or expired token
 *
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     responses:
 *       '200':
 *         description: Token refreshed
 *       '403':
 *         description: Invalid refresh token
 *
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current user profile
 *       '401':
 *         description: Unauthorized
 */
/**
 * @route   POST /api/auth/register
 * @desc    Register new user with OTP verification
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and activate account
 * @access  Public
 */
router.post('/verify-otp', verifyOTP);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP for verification
 * @access  Public
 */
router.post('/resend-otp', resendOTP);

/**
 * @route   POST /api/auth/login
 * @desc    User login (email/phone + password)
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', resetPassword);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, getMe);

export default router;
