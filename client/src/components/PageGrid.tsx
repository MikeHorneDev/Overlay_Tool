import { useEffect, useState } from 'react';
import { getDrawingSetPages, type Page } from '../api/client';

interface Props {
  drawingSetId: string;
  /** Trigger a re-fetch when this increments (e.g. after job completes) */
  refreshKey?: number;
}

export default function PageGrid({ drawingSetId, refreshKey = 0 }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDrawingSetPages(drawingSetId)
      .then(setPages)
      .catch(() => setError('Failed to load pages'))
      .finally(() => setLoading(false));
  }, [drawingSetId, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="py-4 text-center text-sm text-red-500">{error}</p>;
  }

  if (pages.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">No pages yet.</p>
    );
  }

  const withSheetNumbers = pages.filter((p) => p.sheetNumber !== null).length;

  return (
    <div>
      {/* Stats bar */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{pages.length}</span>{' '}
          {pages.length === 1 ? 'page' : 'pages'}
        </p>
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{withSheetNumbers}</span>{' '}
          of {pages.length} sheet numbers found
        </p>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {pages.map((page) => (
          <PageThumbnail key={page.id} page={page} />
        ))}
      </div>
    </div>
  );
}

function PageThumbnail({ page }: { page: Page }) {
  const [imgError, setImgError] = useState(false);
  // imagePath is stored relative to server CWD, e.g. "uploads/proj/set/pages/page-0.png"
  // The Vite dev proxy forwards /uploads → :3001, so prefix with /
  const src = `/${page.imagePath}`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
        {imgError ? (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-8 w-8 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        ) : (
          <img
            src={src}
            alt={page.sheetNumber ?? `Page ${page.pageIndex + 1}`}
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}

        {/* Page index badge */}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-xs font-medium text-white">
          {page.pageIndex + 1}
        </span>
      </div>

      {/* Sheet number label */}
      <div className="px-2 py-1.5">
        {page.sheetNumber ? (
          <p className="truncate text-center text-xs font-semibold text-gray-800">
            {page.sheetNumber}
          </p>
        ) : (
          <p className="text-center text-xs text-gray-400 italic">No sheet #</p>
        )}
      </div>
    </div>
  );
}
