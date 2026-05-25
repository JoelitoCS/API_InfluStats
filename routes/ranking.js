import express from 'express';
import { getRanking, compareProfiles } from '../controller/rankingController.js';
import { protect }    from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/ranking?platform=instagram&sort=followers
router.get('/', protect, getRanking);

// GET /api/ranking/compare?profileA=uuid&profileB=uuid
// IMPORTANTE: antes de /:id para que Express no confunda 'compare' con un id
router.get('/compare', protect, compareProfiles);

export default router;
