import express from 'express';
import cors from 'cors';
import path from 'path';
import projectsRouter from './routes/projects';
import jobsRouter from './routes/jobs';
import drawingSetsRouter from './routes/drawingSets';
import { startJobWorker } from './workers/jobWorker';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Routes ────────────────────────────────────
app.use('/api/projects', projectsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/drawing-sets', drawingSetsRouter);

// ── Health check ──────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  startJobWorker();
});

export default app;
