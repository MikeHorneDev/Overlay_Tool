import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/jobs/by-ref/:referenceId — Find the most recent job for a reference ID
// Must be declared BEFORE /:id so Express doesn't treat "by-ref" as an id.
router.get('/by-ref/:referenceId', async (req: Request, res: Response) => {
  const job = await prisma.job.findFirst({
    where: { referenceId: req.params.referenceId },
    orderBy: { createdAt: 'desc' },
  });

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    id: job.id,
    type: job.type,
    referenceId: job.referenceId,
    status: job.status,
    progress: job.progress,
    message: job.message,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

// GET /api/jobs/:id — Return job status
router.get('/:id', async (req: Request, res: Response) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    id: job.id,
    type: job.type,
    referenceId: job.referenceId,
    status: job.status,
    progress: job.progress,
    message: job.message,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

export default router;
