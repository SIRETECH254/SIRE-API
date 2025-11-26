import express from 'express';
import {
    createInvoice,
    getAllInvoices,
    getInvoiceStats,
    getOverdueInvoices,
    getClientInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    markAsOverdue,
    cancelInvoice,
    generateInvoicePDFController,
    sendInvoice
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
 *     responses:
 *       '200':
 *         description: List of invoices
 *   post:
 *     tags: [Invoices]
 *     summary: Create invoice
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Created
 *
 * /api/invoices/stats:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Stats
 *
 * /api/invoices/overdue:
 *   get:
 *     tags: [Invoices]
 *     summary: Get overdue invoices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Overdue invoices
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
 *     responses:
 *       '200':
 *         description: Client invoices
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
 *         description: Invoice
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
 *     responses:
 *       '200':
 *         description: Updated
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
 *         description: Deleted
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
 *     responses:
 *       '200':
 *         description: Marked paid
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
 *         description: Marked overdue
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
 *     responses:
 *       '200':
 *         description: Cancelled
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
 *         description: PDF
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
 *     responses:
 *       '200':
 *         description: Sent
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createInvoice);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllInvoices);

// Specific routes must come before dynamic :invoiceId route
router.get('/stats', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getInvoiceStats);
router.get('/overdue', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getOverdueInvoices);
router.get('/client/:clientId', authenticateToken, getClientInvoices);

// Dynamic routes come last
router.get('/:invoiceId', authenticateToken, getInvoice);
router.put('/:invoiceId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateInvoice);
router.delete('/:invoiceId', authenticateToken, authorizeRoles(['super_admin']), deleteInvoice);
router.patch('/:invoiceId/mark-paid', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsPaid);
router.patch('/:invoiceId/mark-overdue', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsOverdue);
router.patch('/:invoiceId/cancel', authenticateToken, authorizeRoles(['super_admin', 'finance']), cancelInvoice);
router.get('/:invoiceId/pdf', authenticateToken, generateInvoicePDFController);
router.post('/:invoiceId/send', authenticateToken, authorizeRoles(['super_admin', 'finance']), sendInvoice);

export default router;


