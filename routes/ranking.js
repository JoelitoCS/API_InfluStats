import express from 'express';
import { getRanking } from '../controller/rankingController.js';
import { protect }    from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/ranking?platform=instagram&sort=followers
// Solo usuarios autenticados pueden ver el ranking.
router.get('/', protect, getRanking);

export default router;
