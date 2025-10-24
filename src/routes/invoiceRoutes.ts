import express from 'express';
import {
    createInvoice,
    getAllInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    markAsOverdue,
    cancelInvoice
} from '../controllers/invoiceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /api/invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: Get all invoices (filtered, paginated)
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
 *           enum: [draft, sent, paid, partially_paid, overdue, cancelled]
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       '200':
 *         description: List of invoices
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
 *                     $ref: '#/components/schemas/Invoice'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationParams'
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *   post:
 *     tags: [Invoices]
 *     summary: Create invoice
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client
 *               - projectTitle
 *               - items
 *               - dueDate
 *             properties:
 *               client:
 *                 type: string
 *                 description: Client ID
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               quotation:
 *                 type: string
 *                 description: Quotation ID (optional)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               projectTitle:
 *                 type: string
 *                 example: "Website Development"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - description
 *                     - quantity
 *                     - unitPrice
 *                   properties:
 *                     description:
 *                       type: string
 *                       example: "Frontend Development"
 *                     quantity:
 *                       type: number
 *                       example: 1
 *                     unitPrice:
 *                       type: number
 *                       example: 50000
 *                     total:
 *                       type: number
 *                       example: 50000
 *               subtotal:
 *                 type: number
 *                 example: 50000
 *               tax:
 *                 type: number
 *                 example: 7500
 *               discount:
 *                 type: number
 *                 example: 0
 *               totalAmount:
 *                 type: number
 *                 example: 57500
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-02-01"
 *               notes:
 *                 type: string
 *                 example: "Payment terms: 30 days"
 *     responses:
 *       '201':
 *         description: Invoice created successfully
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
 *                   example: "Invoice created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *
 * /api/invoices/stats:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Invoice statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalInvoices:
 *                       type: number
 *                     totalAmount:
 *                       type: number
 *                     paidAmount:
 *                       type: number
 *                     pendingAmount:
 *                       type: number
 *                     overdueAmount:
 *                       type: number
 *                     statusBreakdown:
 *                       type: object
 *       '401':
 *         description: Unauthorized
 *
 * /api/invoices/overdue:
 *   get:
 *     tags: [Invoices]
 *     summary: Get overdue invoices
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
 *     responses:
 *       '200':
 *         description: Overdue invoices
 *       '401':
 *         description: Unauthorized
 *
 * /api/invoices/client/{clientId}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get client invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
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
 *           enum: [draft, sent, paid, partially_paid, overdue, cancelled]
 *     responses:
 *       '200':
 *         description: Client invoices
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Client not found
 *
 * /api/invoices/{invoiceId}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get single invoice
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
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Invoice not found
 *   put:
 *     tags: [Invoices]
 *     summary: Update invoice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
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
 *               projectTitle:
 *                 type: string
 *                 example: "Updated Project Title"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     total:
 *                       type: number
 *               subtotal:
 *                 type: number
 *               tax:
 *                 type: number
 *               discount:
 *                 type: number
 *               totalAmount:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Invoice updated successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Invoice not found
 *   delete:
 *     tags: [Invoices]
 *     summary: Delete invoice
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
 *         description: Invoice deleted successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Invoice not found
 *
 * /api/invoices/{invoiceId}/mark-paid:
 *   patch:
 *     tags: [Invoices]
 *     summary: Mark invoice as paid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paidAmount:
 *                 type: number
 *                 description: Amount paid (if partial payment)
 *                 example: 50000
 *               paymentMethod:
 *                 type: string
 *                 enum: [mpesa, bank_transfer, stripe, paypal, cash]
 *                 example: "mpesa"
 *               transactionId:
 *                 type: string
 *                 example: "TXN123456789"
 *               notes:
 *                 type: string
 *                 example: "Payment received via M-Pesa"
 *     responses:
 *       '200':
 *         description: Invoice marked as paid successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Invoice not found
 *
 * /api/invoices/{invoiceId}/mark-overdue:
 *   patch:
 *     tags: [Invoices]
 *     summary: Mark invoice as overdue
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
 *         description: Invoice marked as overdue successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Invoice not found
 *
 * /api/invoices/{invoiceId}/cancel:
 *   patch:
 *     tags: [Invoices]
 *     summary: Cancel invoice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Client requested cancellation"
 *     responses:
 *       '200':
 *         description: Invoice cancelled successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Invoice not found
 *
 * /api/invoices/{invoiceId}/pdf:
 *   get:
 *     tags: [Invoices]
 *     summary: Generate invoice PDF
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
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Invoice not found
 *
 * /api/invoices/{invoiceId}/send:
 *   post:
 *     tags: [Invoices]
 *     summary: Send invoice via email
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Please find attached your invoice"
 *               cc:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["manager@company.com"]
 *     responses:
 *       '200':
 *         description: Invoice sent successfully
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Invoice not found
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createInvoice);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllInvoices);
router.get('/:invoiceId', authenticateToken, getInvoice);
router.put('/:invoiceId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateInvoice);
router.delete('/:invoiceId', authenticateToken, authorizeRoles(['super_admin']), deleteInvoice);
router.patch('/:invoiceId/mark-paid', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsPaid);
router.patch('/:invoiceId/mark-overdue', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsOverdue);
router.patch('/:invoiceId/cancel', authenticateToken, authorizeRoles(['super_admin', 'finance']), cancelInvoice);

export default router;


