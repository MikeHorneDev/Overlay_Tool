import prisma from '../lib/prisma';

let isProcessing = false;

async function simulateProcessing(jobId: string): Promise<void> {
  const steps = 10;
  const stepDuration = 500; // 5 seconds total

  for (let i = 1; i <= steps; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, stepDuration));

    const progress = Math.round((i / steps) * 100);
    const message =
      i < steps
        ? `Processing... ${progress}%`
        : 'Processing complete';

    await prisma.job.update({
      where: { id: jobId },
      data: { progress, message },
    });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'complete',
      progress: 100,
      message: 'PDF processed successfully',
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
      data: { status: 'processing', message: 'Starting processing...' },
    });

    await simulateProcessing(job.id);
  } catch (err) {
    console.error(`[JobWorker] Error processing job ${job.id}:`, err);
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
