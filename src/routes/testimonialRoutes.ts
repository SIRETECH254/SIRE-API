import express from 'express';
import {
    createTestimonial,
    getAllTestimonials,
    getPublishedTestimonials,
    getMyTestimonials,
    getTestimonial,
    updateTestimonial,
    deleteTestimonial,
    approveTestimonial,
    publishTestimonial,
    unpublishTestimonial
} from '../controllers/testimonialController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/testimonials
 * @desc    Create testimonial (client)
 * @access  Private (Client)
 */
router.post('/', authenticateToken, createTestimonial);

/**
 * @route   GET /api/testimonials/published
 * @desc    Get published testimonials (public)
 * @access  Public
 */
router.get('/published', getPublishedTestimonials);

/**
 * @route   GET /api/testimonials/my
 * @desc    Get client's own testimonials
 * @access  Private (Client)
 */
router.get('/my', authenticateToken, getMyTestimonials);

/**
 * @route   GET /api/testimonials
 * @desc    Get all testimonials (admin)
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), getAllTestimonials);

/**
 * @route   POST /api/testimonials/:id/approve
 * @desc    Approve testimonial (admin)
 * @access  Private (Admin only)
 */
router.post('/:id/approve', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), approveTestimonial);

/**
 * @route   POST /api/testimonials/:id/publish
 * @desc    Publish testimonial (admin)
 * @access  Private (Admin only)
 */
router.post('/:id/publish', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), publishTestimonial);

/**
 * @route   POST /api/testimonials/:id/unpublish
 * @desc    Unpublish testimonial (admin)
 * @access  Private (Admin only)
 */
router.post('/:id/unpublish', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), unpublishTestimonial);

/**
 * @route   GET /api/testimonials/:id
 * @desc    Get single testimonial
 * @access  Private (Client owner or Admin)
 */
router.get('/:id', authenticateToken, getTestimonial);

/**
 * @route   PUT /api/testimonials/:id
 * @desc    Update testimonial
 * @access  Private (Client owner or Admin)
 */
router.put('/:id', authenticateToken, updateTestimonial);

/**
 * @route   DELETE /api/testimonials/:id
 * @desc    Delete testimonial
 * @access  Private (Client owner or Admin)
 */
router.delete('/:id', authenticateToken, deleteTestimonial);

export default router;

