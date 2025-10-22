import express from 'express';
import {
    createPayment,
    getAllPayments,
    getPayment,
    updatePayment,
    deletePayment,
    getClientPayments,
    getInvoicePayments,
    initiatePayment,
    mpesaWebhook,
    paystackWebhook,
    queryMpesaStatus,
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
 *     responses:
 *       '200':
 *         description: List of payments
 *   post:
 *     tags: [Payments]
 *     summary: Create payment
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Created
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
 *         description: Payment
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
 *     responses:
 *       '200':
 *         description: Updated
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
 *         description: Deleted
 */
// Basic payment routes
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createPayment);
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
router.get('/:paymentId/mpesa-status', authenticateToken, queryMpesaStatus);
router.get('/mpesa-status/:checkoutRequestId', authenticateToken, queryMpesaByCheckoutId);

export default router;


