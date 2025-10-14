import express from 'express';
import {
    createQuotation,
    getAllQuotations,
    getQuotation,
    updateQuotation,
    deleteQuotation,
    acceptQuotation,
    rejectQuotation,
    convertToInvoice
} from '../controllers/quotationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @openapi
 * /api/quotations:
 *   get:
 *     tags: [Quotations]
 *     summary: Get all quotations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of quotations
 *   post:
 *     tags: [Quotations]
 *     summary: Create quotation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Created
 *
 * /api/quotations/{quotationId}:
 *   get:
 *     tags: [Quotations]
 *     summary: Get single quotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Quotation
 *   put:
 *     tags: [Quotations]
 *     summary: Update quotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Updated
 *   delete:
 *     tags: [Quotations]
 *     summary: Delete quotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 *
 * /api/quotations/{quotationId}/accept:
 *   post:
 *     tags: [Quotations]
 *     summary: Accept quotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Accepted
 *
 * /api/quotations/{quotationId}/reject:
 *   post:
 *     tags: [Quotations]
 *     summary: Reject quotation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Rejected
 *
 * /api/quotations/{quotationId}/convert-to-invoice:
 *   post:
 *     tags: [Quotations]
 *     summary: Convert quotation to invoice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quotationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '201':
 *         description: Converted
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createQuotation);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllQuotations);
router.get('/:quotationId', authenticateToken, getQuotation);
router.put('/:quotationId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateQuotation);
router.delete('/:quotationId', authenticateToken, authorizeRoles(['super_admin']), deleteQuotation);
router.post('/:quotationId/accept', authenticateToken, acceptQuotation);
router.post('/:quotationId/reject', authenticateToken, rejectQuotation);
router.post('/:quotationId/convert-to-invoice', authenticateToken, authorizeRoles(['super_admin', 'finance']), convertToInvoice);

export default router;


