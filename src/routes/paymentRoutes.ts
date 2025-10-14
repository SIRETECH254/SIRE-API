import express from 'express';
import {
    createPayment,
    getAllPayments,
    getPayment,
    updatePayment,
    deletePayment,
    getClientPayments,
    getInvoicePayments
} from '../controllers/paymentController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), createPayment);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance']), getAllPayments);
router.get('/client/:clientId', authenticateToken, getClientPayments);
router.get('/invoice/:invoiceId', authenticateToken, getInvoicePayments);
router.get('/:paymentId', authenticateToken, getPayment);
router.put('/:paymentId', authenticateToken, authorizeRoles(['super_admin', 'finance']), updatePayment);
router.delete('/:paymentId', authenticateToken, authorizeRoles(['super_admin']), deletePayment);

export default router;


