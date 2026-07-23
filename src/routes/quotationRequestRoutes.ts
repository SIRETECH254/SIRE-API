import express from 'express';
import {
    submitQuotationRequest,
    getAllQuotationRequests,
    getQuotationRequest,
    updateRequestStatus,
    convertToProject,
    deleteQuotationRequest
} from '../controllers/quotationRequestController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/quotation-requests
 * @desc    Submit a public Request for Quotation
 * @access  Public
 */
router.post('/', submitQuotationRequest);

/**
 * @route   GET /api/quotation-requests
 * @desc    Get all quotation requests with filters and pagination
 * @access  Private (Admin)
 */
router.get(
    '/',
    authenticateToken,
    authorizeRoles(['super_admin', 'finance', 'project_manager']),
    getAllQuotationRequests
);

// Sub-routes before dynamic :requestId to avoid Express ordering conflicts
/**
 * @route   PATCH /api/quotation-requests/:requestId/status
 * @desc    Update quotation request status (reviewed / rejected)
 * @access  Private (Admin)
 */
router.patch(
    '/:requestId/status',
    authenticateToken,
    authorizeRoles(['super_admin', 'finance', 'project_manager']),
    updateRequestStatus
);

/**
 * @route   POST /api/quotation-requests/:requestId/convert
 * @desc    Convert quotation request to a Project
 * @access  Private (super_admin, project_manager)
 */
router.post(
    '/:requestId/convert',
    authenticateToken,
    authorizeRoles(['super_admin', 'project_manager']),
    convertToProject
);

/**
 * @route   GET /api/quotation-requests/:requestId
 * @desc    Get single quotation request
 * @access  Private (Admin)
 */
router.get(
    '/:requestId',
    authenticateToken,
    authorizeRoles(['super_admin', 'finance', 'project_manager']),
    getQuotationRequest
);

/**
 * @route   DELETE /api/quotation-requests/:requestId
 * @desc    Delete quotation request
 * @access  Private (super_admin only)
 */
router.delete(
    '/:requestId',
    authenticateToken,
    authorizeRoles(['super_admin']),
    deleteQuotationRequest
);

export default router;
