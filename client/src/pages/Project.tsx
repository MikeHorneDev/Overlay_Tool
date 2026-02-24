import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, type ProjectDetail, type DrawingSet } from '../api/client';
import UploadZone from '../components/UploadZone';

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

  useEffect(() => { load(); }, [load]);

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
        <Link to="/" className="mt-4 text-sm text-brand-600 hover:underline">← Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Link to="/" className="hover:text-gray-600">Projects</Link>
            <span>/</span>
            <span className="text-gray-600 font-medium">{project.name}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-900">{project.name}</h1>
          {project.externalProjectId && (
            <p className="text-xs text-gray-400">ID: {project.externalProjectId}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Drawing Sets */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
              Drawing Sets ({project.drawingSets.length})
            </h2>

            {project.drawingSets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
                <p className="text-sm text-gray-500">No drawing sets yet</p>
                <p className="mt-1 text-xs text-gray-400">Upload a PDF to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {project.drawingSets.map((set: DrawingSet) => (
                  <DrawingSetCard key={set.id} drawingSet={set} />
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

function DrawingSetCard({ drawingSet }: { drawingSet: DrawingSet }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{drawingSet.label}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {drawingSet._count?.pages ?? 0} page{drawingSet._count?.pages !== 1 ? 's' : ''} ·{' '}
            Uploaded {new Date(drawingSet.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          PDF
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-gray-400 font-mono">{drawingSet.originalFile}</p>
    </div>
  );
}
