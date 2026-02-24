import { useEffect, useState, useRef } from 'react';
import { getJob, type Job } from '../api/client';

interface Props {
  jobId: string;
  onComplete?: () => void;
}

const statusLabel: Record<Job['status'], string> = {
  pending: 'Queued',
  processing: 'Processing',
  complete: 'Complete',
  failed: 'Failed',
};

const statusColor: Record<Job['status'], string> = {
  pending: 'text-gray-500',
  processing: 'text-brand-600',
  complete: 'text-green-600',
  failed: 'text-red-600',
};

const barColor: Record<Job['status'], string> = {
  pending: 'bg-gray-400',
  processing: 'bg-brand-500',
  complete: 'bg-green-500',
  failed: 'bg-red-500',
};

export default function JobStatus({ jobId, onComplete }: Props) {
  const [job, setJob] = useState<Job | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        const data = await getJob(jobId);
        setJob(data);

        if (data.status === 'complete' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (data.status === 'complete') onComplete?.();
        }
      } catch {
        // silently ignore transient errors
      }
    }

    fetchJob();
    intervalRef.current = setInterval(fetchJob, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, onComplete]);

  if (!job) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-400">Loading job status…</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">PDF Processing</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${statusColor[job.status]}`}>
          {statusLabel[job.status]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor[job.status]}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {job.message && (
        <p className="mt-2 text-xs text-gray-500">{job.message}</p>
      )}

      {job.error && (
        <p className="mt-2 text-xs text-red-600">Error: {job.error}</p>
      )}
    </div>
  );
}
