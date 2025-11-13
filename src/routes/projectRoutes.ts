import express from 'express';
import {
    createProject,
    getAllProjects,
    getProjectStats,
    getProject,
    updateProject,
    deleteProject,
    assignTeamMembers,
    updateProjectStatus,
    updateProgress,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    uploadAttachment,
    deleteAttachment,
    getClientProjects,
    getAssignedProjects
} from '../controllers/projectController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { uploadProjectAttachment } from '../config/cloudinary';

const router = express.Router();

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: Get all projects with filtering and pagination
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of projects
 *   post:
 *     tags: [Projects]
 *     summary: Create new project
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Project created
 *
 * /api/projects/stats:
 *   get:
 *     tags: [Projects]
 *     summary: Get project statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Stats
 *
 * /api/projects/assigned:
 *   get:
 *     tags: [Projects]
 *     summary: Get projects assigned to current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Assigned projects
 *
 * /api/projects/client/{clientId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get client projects
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
 *         description: Projects
 *
 * /api/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get single project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Project
 *   put:
 *     tags: [Projects]
 *     summary: Update project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Updated
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 *
 * /api/projects/{projectId}/assign:
 *   post:
 *     tags: [Projects]
 *     summary: Assign team members to project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Assigned
 *
 * /api/projects/{projectId}/status:
 *   patch:
 *     tags: [Projects]
 *     summary: Update project status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Status updated
 *
 * /api/projects/{projectId}/progress:
 *   patch:
 *     tags: [Projects]
 *     summary: Update project progress
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Progress updated
 *
 * /api/projects/{projectId}/milestones:
 *   post:
 *     tags: [Projects]
 *     summary: Add project milestone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '201':
 *         description: Milestone added
 *
 * /api/projects/{projectId}/milestones/{milestoneId}:
 *   put:
 *     tags: [Projects]
 *     summary: Update milestone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Milestone updated
 *   delete:
 *     tags: [Projects]
 *     summary: Delete milestone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Milestone deleted
 *
 * /api/projects/{projectId}/attachments:
 *   post:
 *     tags: [Projects]
 *     summary: Upload project attachment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Attachment uploaded
 *
 * /api/projects/{projectId}/attachments/{attachmentId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project attachment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Attachment deleted
 */
/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private (Admin, Project Manager)
 */
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), createProject);

/**
 * @route   GET /api/projects
 * @desc    Get all projects with filtering and pagination
 * @access  Private (Admin, Project Manager)
 */
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'project_manager', 'finance']), getAllProjects);

/**
 * @route   GET /api/projects/stats
 * @desc    Get project statistics
 * @access  Private (Admin)
 */
router.get('/stats', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), getProjectStats);

/**
 * @route   GET /api/projects/assigned
 * @desc    Get projects assigned to current user
 * @access  Private
 */
router.get('/assigned', authenticateToken, getAssignedProjects);

/**
 * @route   GET /api/projects/client/:clientId
 * @desc    Get client projects
 * @access  Private (Client or Admin)
 */
router.get('/client/:clientId', authenticateToken, getClientProjects);

/**
 * @route   GET /api/projects/:projectId
 * @desc    Get single project
 * @access  Private (Admin or Assigned Team Member or Client)
 */
router.get('/:projectId', authenticateToken, getProject);

/**
 * @route   PUT /api/projects/:projectId
 * @desc    Update project
 * @access  Private (Admin or Assigned Team Member)
 */
router.put('/:projectId', authenticateToken, updateProject);

/**
 * @route   DELETE /api/projects/:projectId
 * @desc    Delete project
 * @access  Private (Super Admin only)
 */
router.delete('/:projectId', authenticateToken, authorizeRoles(['super_admin']), deleteProject);

/**
 * @route   POST /api/projects/:projectId/assign
 * @desc    Assign team members to project
 * @access  Private (Admin, Project Manager)
 */
router.post('/:projectId/assign', authenticateToken, authorizeRoles(['super_admin', 'project_manager']), assignTeamMembers);

/**
 * @route   PATCH /api/projects/:projectId/status
 * @desc    Update project status
 * @access  Private (Admin or Assigned Team Member)
 */
router.patch('/:projectId/status', authenticateToken, updateProjectStatus);

/**
 * @route   PATCH /api/projects/:projectId/progress
 * @desc    Update project progress
 * @access  Private (Admin or Assigned Team Member)
 */
router.patch('/:projectId/progress', authenticateToken, updateProgress);

/**
 * @route   POST /api/projects/:projectId/milestones
 * @desc    Add project milestone
 * @access  Private (Admin or Assigned Team Member)
 */
router.post('/:projectId/milestones', authenticateToken, addMilestone);

/**
 * @route   PUT /api/projects/:projectId/milestones/:milestoneId
 * @desc    Update milestone
 * @access  Private (Admin or Assigned Team Member)
 */
router.put('/:projectId/milestones/:milestoneId', authenticateToken, updateMilestone);

/**
 * @route   DELETE /api/projects/:projectId/milestones/:milestoneId
 * @desc    Delete milestone
 * @access  Private (Admin or Assigned Team Member)
 */
router.delete('/:projectId/milestones/:milestoneId', authenticateToken, deleteMilestone);

/**
 * @route   POST /api/projects/:projectId/attachments
 * @desc    Upload project attachments (multiple files supported, max 10)
 * @access  Private (Admin or Assigned Team Member)
 */
router.post('/:projectId/attachments', authenticateToken, uploadProjectAttachment.array('files', 10), uploadAttachment);

/**
 * @route   DELETE /api/projects/:projectId/attachments/:attachmentId
 * @desc    Delete project attachment
 * @access  Private (Admin or Uploader)
 */
router.delete('/:projectId/attachments/:attachmentId', authenticateToken, deleteAttachment);

export default router;

