import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';

const router = Router();

// ──────────────────────────────────────────────
// Multer — configured per-request after we know projectId/setId
// ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const { projectId } = req.params;
    const setId = (req as Request & { generatedSetId?: string }).generatedSetId ?? uuidv4();
    (req as Request & { generatedSetId?: string }).generatedSetId = setId;

    const dir = path.join(process.cwd(), 'uploads', projectId, setId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    cb(null, 'original.pdf');
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ──────────────────────────────────────────────
// POST /api/projects — Create a new project
// ──────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const { name, externalProjectId } = req.body as {
    name?: string;
    externalProjectId?: string;
  };

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const project = await prisma.project.create({
    data: { name: name.trim(), externalProjectId: externalProjectId ?? null },
  });

  res.status(201).json(project);
});

// ──────────────────────────────────────────────
// GET /api/projects — List all projects
// ──────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { drawingSets: true } } },
  });
  res.json(projects);
});

// ──────────────────────────────────────────────
// GET /api/projects/:id — Get project with drawing sets
// ──────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      drawingSets: {
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { pages: true } } },
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.json(project);
});

// ──────────────────────────────────────────────
// POST /api/projects/:projectId/drawing-sets — Upload PDF
// ──────────────────────────────────────────────
router.post(
  '/:projectId/drawing-sets',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { label } = req.body as { label?: string };

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!label || label.trim() === '') {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const setId = (req as Request & { generatedSetId?: string }).generatedSetId ?? uuidv4();
    const filePath = path.relative(process.cwd(), req.file.path);

    const [drawingSet, job] = await prisma.$transaction([
      prisma.drawingSet.create({
        data: {
          id: setId,
          projectId,
          label: label.trim(),
          originalFile: filePath,
        },
      }),
      prisma.job.create({
        data: {
          type: 'pdf_process',
          referenceId: setId,
          status: 'pending',
        },
      }),
    ]);

    res.status(201).json({ drawingSet, job });
  }
);

// ──────────────────────────────────────────────
// DELETE /api/projects/:id — Delete project + all data
// ──────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  await prisma.project.delete({ where: { id: req.params.id } });

  // Clean up upload directory
  const uploadDir = path.join(process.cwd(), 'uploads', req.params.id);
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }

  res.status(204).send();
});

export default router;
