import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getProject,
  getJob,
  type ProjectDetail,
  type DrawingSet,
  type Job,
} from '../api/client';
import UploadZone from '../components/UploadZone';
import PageGrid from '../components/PageGrid';

// ── Project page ───────────────────────────────────────────────────────────────

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setProject(await getProject(id));
    } catch {
      setError('Project not found or server is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <p className="text-sm text-red-600">{error ?? 'Project not found'}</p>
        <Link to="/" className="mt-4 text-sm text-brand-600 hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link to="/" className="hover:text-gray-600">
              Projects
            </Link>
            <span>/</span>
            <span className="font-medium text-gray-600">{project.name}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-900">{project.name}</h1>
          {project.externalProjectId && (
            <p className="text-xs text-gray-400">ID: {project.externalProjectId}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Drawing Sets */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
              Drawing Sets ({project.drawingSets.length})
            </h2>

            {project.drawingSets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
                <p className="text-sm text-gray-500">No drawing sets yet</p>
                <p className="mt-1 text-xs text-gray-400">
                  Upload a PDF to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {project.drawingSets.map((set: DrawingSet) => (
                  <DrawingSetCard key={set.id} drawingSet={set} onRefresh={load} />
                ))}
              </div>
            )}
          </section>

          {/* Upload zone */}
          <section>
            <UploadZone projectId={project.id} onUploadComplete={load} />
          </section>
        </div>
      </main>
    </div>
  );
}

// ── DrawingSetCard ─────────────────────────────────────────────────────────────

interface DrawingSetCardProps {
  drawingSet: DrawingSet;
  onRefresh: () => void;
}

function DrawingSetCard({ drawingSet, onRefresh }: DrawingSetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const pageCount = drawingSet._count?.pages ?? 0;
  const hasPages = pageCount > 0;

  function handleJobComplete() {
    // Re-fetch project so the page count in the card header updates,
    // then expand and trigger a page grid reload.
    onRefresh();
    setExpanded(true);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-start justify-between px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{drawingSet.label}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {pageCount} page{pageCount !== 1 ? 's' : ''} ·{' '}
            Uploaded {new Date(drawingSet.createdAt).toLocaleDateString()}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-gray-300">
            {drawingSet.originalFile}
          </p>
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            PDF
          </span>
          {hasPages && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              {expanded ? 'Hide pages' : 'View pages'}
            </button>
          )}
        </div>
      </div>

      {/* Job progress — shown while pages are still being processed */}
      {!hasPages && (
        <div className="border-t border-gray-100 px-5 pb-4 pt-3">
          <InlineJobStatus
            drawingSetId={drawingSet.id}
            onComplete={handleJobComplete}
          />
        </div>
      )}

      {/* Page grid — collapsible */}
      {expanded && hasPages && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          <PageGrid drawingSetId={drawingSet.id} refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
}

// ── InlineJobStatus ────────────────────────────────────────────────────────────

interface InlineJobStatusProps {
  drawingSetId: string;
  onComplete: () => void;
}

function InlineJobStatus({ drawingSetId, onComplete }: InlineJobStatusProps) {
  const [job, setJob] = useState<Job | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep the callback ref stable so the interval doesn't need to restart
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Find the job for this drawing set via the by-ref endpoint
    let jobId: string | null = null;

    async function fetchJobByRef() {
      try {
        const res = await fetch(`/api/jobs/by-ref/${drawingSetId}`);
        if (!res.ok) return;
        const data = (await res.json()) as Job;
        jobId = data.id;
        setJob(data);
        startPolling();
      } catch {
        // Job may not exist yet; silently ignore
      }
    }

    function startPolling() {
      if (intervalRef.current) return; // already polling
      intervalRef.current = setInterval(async () => {
        if (!jobId) return;
        try {
          const data = await getJob(jobId);
          setJob(data);
          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            if (data.status === 'complete') onCompleteRef.current();
          }
        } catch {
          // ignore transient network errors
        }
      }, 2000);
    }

    fetchJobByRef();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [drawingSetId]);

  if (!job) return null;

  const isTerminal = job.status === 'complete' || job.status === 'failed';

  const barColor =
    job.status === 'complete'
      ? 'bg-green-500'
      : job.status === 'failed'
        ? 'bg-red-500'
        : 'bg-brand-500';

  const statusLabel =
    job.status === 'complete'
      ? 'Complete'
      : job.status === 'failed'
        ? 'Failed'
        : job.status === 'processing'
          ? `${job.progress}%`
          : 'Queued';

  const statusColor =
    job.status === 'complete'
      ? 'text-green-600'
      : job.status === 'failed'
        ? 'text-red-600'
        : 'text-brand-600';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {job.message ?? 'Waiting to process…'}
        </span>
        <span className={`text-xs font-semibold uppercase ${statusColor}`}>
          {isTerminal ? statusLabel : statusLabel}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>
      {job.error && (
        <p className="mt-1.5 text-xs text-red-600">Error: {job.error}</p>
      )}
    </div>
  );
}
