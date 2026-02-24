import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/drawing-sets/:id/pages — return all pages for a drawing set
router.get('/:id/pages', async (req: Request, res: Response) => {
  const drawingSet = await prisma.drawingSet.findUnique({
    where: { id: req.params.id },
  });

  if (!drawingSet) {
    res.status(404).json({ error: 'Drawing set not found' });
    return;
  }

  const pages = await prisma.page.findMany({
    where: { drawingSetId: req.params.id },
    orderBy: { pageIndex: 'asc' },
    select: {
      id: true,
      pageIndex: true,
      sheetNumber: true,
      sheetNumberSource: true,
      imagePath: true,
      width: true,
      height: true,
    },
  });

  res.json(pages);
});

export default router;
