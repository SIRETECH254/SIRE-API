import express from 'express';
import {
    createService,
    getAllServices,
    getActiveServices,
    getService,
    updateService,
    deleteService,
    toggleServiceStatus,
    uploadServiceIcon
} from '../controllers/serviceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { uploadServiceIcon as uploadIconMiddleware } from '../config/cloudinary';

const router = express.Router();

router.get('/active', getActiveServices);
router.post('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), createService);
router.get('/', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager', 'staff']), getAllServices);
router.get('/:serviceId', getService);
router.put('/:serviceId', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), updateService);
router.delete('/:serviceId', authenticateToken, authorizeRoles(['super_admin']), deleteService);
router.patch('/:serviceId/toggle-status', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), toggleServiceStatus);
router.post('/:serviceId/icon', authenticateToken, authorizeRoles(['super_admin', 'finance', 'project_manager']), uploadIconMiddleware.single('icon'), uploadServiceIcon);

export default router;


