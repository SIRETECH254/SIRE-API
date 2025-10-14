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

router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createQuotation);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllQuotations);
router.get('/:quotationId', authenticateToken, getQuotation);
router.put('/:quotationId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateQuotation);
router.delete('/:quotationId', authenticateToken, authorizeRoles(['super_admin']), deleteQuotation);
router.post('/:quotationId/accept', authenticateToken, acceptQuotation);
router.post('/:quotationId/reject', authenticateToken, rejectQuotation);
router.post('/:quotationId/convert-to-invoice', authenticateToken, authorizeRoles(['super_admin', 'finance']), convertToInvoice);

export default router;


