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

router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createInvoice);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllInvoices);
router.get('/:invoiceId', authenticateToken, getInvoice);
router.put('/:invoiceId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updateInvoice);
router.delete('/:invoiceId', authenticateToken, authorizeRoles(['super_admin']), deleteInvoice);
router.patch('/:invoiceId/mark-paid', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsPaid);
router.patch('/:invoiceId/mark-overdue', authenticateToken, authorizeRoles(['super_admin', 'finance']), markAsOverdue);
router.patch('/:invoiceId/cancel', authenticateToken, authorizeRoles(['super_admin', 'finance']), cancelInvoice);

export default router;


