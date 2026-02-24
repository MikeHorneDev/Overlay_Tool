import prisma from '../lib/prisma';
import { processPdf } from '../services/pdf.service';

let isProcessing = false;

async function processPdfJob(jobId: string, drawingSetId: string): Promise<void> {
  const result = await processPdf(drawingSetId, async (current, total, message) => {
    const progress = total > 0 ? Math.round((current / total) * 100) : 0;
    await prisma.job.update({
      where: { id: jobId },
      data: { progress, message },
    });
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'complete',
      progress: 100,
      message: `Processed ${result.pagesProcessed} pages — ${result.pagesWithSheetNumbers} sheet numbers found`,
    },
  });
}

async function processNextJob(): Promise<void> {
  if (isProcessing) return;

  const job = await prisma.job.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });

  if (!job) return;

  isProcessing = true;

  try {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'processing', message: 'Starting PDF processing…' },
    });

    if (job.type === 'pdf_process') {
      await processPdfJob(job.id, job.referenceId);
    } else {
      // Unknown job type — mark complete so the queue doesn't stall
      console.warn(`[JobWorker] Unknown job type: ${job.type}`);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'failed', error: `Unsupported job type: ${job.type}` },
      });
    }
  } catch (err) {
    console.error(`[JobWorker] Job ${job.id} failed:`, err);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  } finally {
    isProcessing = false;
  }
}

export function startJobWorker(): void {
  console.log('[JobWorker] Started, polling every 2s');
  setInterval(() => {
    processNextJob().catch((err) =>
      console.error('[JobWorker] Poll error:', err)
    );
  }, 2000);
}
