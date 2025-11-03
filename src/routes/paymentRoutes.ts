import express from 'express';
import {
    createPaymentAdmin,
    getAllPayments,
    getPayment,
    updatePayment,
    deletePayment,
    getClientPayments,
    getInvoicePayments,
    initiatePayment,
    mpesaWebhook,
    paystackWebhook,
    queryMpesaByCheckoutId
} from '../controllers/paymentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [mpesa, paystack]
 *     responses:
 *       '200':
 *         description: List of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationParams'
 *   post:
 *     tags: [Payments]
 *     summary: Create payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoice
 *               - client
 *               - amount
 *               - paymentMethod
 *             properties:
 *               invoice:
 *                 type: string
 *                 description: Invoice ID
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               client:
 *                 type: string
 *                 description: Client ID
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *                 example: 1000
 *               paymentMethod:
 *                 type: string
 *                 enum: [mpesa, paystack]
 *                 example: "mpesa"
 *               transactionId:
 *                 type: string
 *                 description: External transaction ID
 *               reference:
 *                 type: string
 *                 description: Payment reference
 *               notes:
 *                 type: string
 *                 description: Payment notes
 *     responses:
 *       '201':
 *         description: Payment created successfully
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
 *                   example: "Payment created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *
 * /api/payments/initiate:
 *   post:
 *     tags: [Payments]
 *     summary: Initiate payment (M-Pesa/Paystack)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *               - method
 *               - amount
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 description: Invoice ID
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               method:
 *                 type: string
 *                 enum: [mpesa, paystack]
 *                 example: "mpesa"
 *               amount:
 *                 type: number
 *                 example: 1000
 *               phone:
 *                 type: string
 *                 description: Phone number (for M-Pesa)
 *                 example: "+254712345678"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email (for Paystack)
 *                 example: "client@example.com"
 *     responses:
 *       '200':
 *         description: Payment initiated successfully
 *
 * /api/payments/client/{clientId}:
 *   get:
 *     tags: [Payments]
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
 *
 * /api/payments/invoice/{invoiceId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payments for invoice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Invoice payments
 *
 * /api/payments/{paymentId}:
 *   get:
 *     tags: [Payments]
 *     summary: Get single payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment details
 *   put:
 *     tags: [Payments]
 *     summary: Update payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
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
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [pending, completed, failed]
 *               transactionId:
 *                 type: string
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Payment updated successfully
 *   delete:
 *     tags: [Payments]
 *     summary: Delete payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Payment deleted successfully
 *
 * /api/payments/webhooks/mpesa:
 *   post:
 *     tags: [Payments]
 *     summary: M-Pesa webhook
 *     description: Webhook endpoint for M-Pesa payment notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '200':
 *         description: Webhook processed successfully
 *
 * /api/payments/webhooks/paystack:
 *   post:
 *     tags: [Payments]
 *     summary: Paystack webhook
 *     description: Webhook endpoint for Paystack payment notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '200':
 *         description: Webhook processed successfully
 */
// Basic payment routes
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createPaymentAdmin);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), getAllPayments);
router.get('/client/:clientId', authenticateToken, getClientPayments);
router.get('/invoice/:invoiceId', authenticateToken, getInvoicePayments);
router.get('/:paymentId', authenticateToken, getPayment);
router.put('/:paymentId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updatePayment);
router.delete('/:paymentId', authenticateToken, authorizeRoles(['super_admin']), deletePayment);

// Payment gateway routes
router.post('/initiate', authenticateToken, initiatePayment);

// Webhook routes (public - no authentication required)
router.post('/webhooks/mpesa', mpesaWebhook);
router.post('/webhooks/paystack', paystackWebhook);

// M-Pesa status query routes
router.get('/mpesa-status/:checkoutRequestId', authenticateToken, queryMpesaByCheckoutId);

export default router;


