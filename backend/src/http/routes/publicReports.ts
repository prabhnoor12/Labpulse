import { Router } from 'express';
import { getPublicReport } from '../../application/reports/reportService';
import { asyncHandler } from '../middleware/async';

const router = Router();

router.get('/:token', asyncHandler(async (request, response) => {
  const token = request.params.token;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    response.status(404).json({ error: 'Report not found.' });
    return;
  }

  const report = await getPublicReport(token);
  if (!report) {
    response.status(404).json({ error: 'Report not found or link expired.' });
    return;
  }
  response.setHeader('X-Robots-Tag', 'noindex, noarchive');
  response.json({ report });
}));

export default router;
