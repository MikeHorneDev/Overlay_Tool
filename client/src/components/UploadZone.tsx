import { useCallback, useRef, useState } from 'react';
import { uploadDrawingSet, type Job } from '../api/client';
import JobStatus from './JobStatus';

interface Props {
  projectId: string;
  onUploadComplete: () => void;
}

export default function UploadZone({ projectId, onUploadComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setError(null);
    } else {
      setError('Only PDF files are accepted');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a PDF file'); return; }
    if (!label.trim()) { setError('Please enter a label'); return; }

    setUploading(true);
    setError(null);

    try {
      const { job: newJob } = await uploadDrawingSet(
        projectId,
        file,
        label,
        setUploadPct
      );
      setJob(newJob);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(message);
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setLabel('');
    setUploading(false);
    setUploadPct(0);
    setJob(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // If a job exists and is complete, let parent know
  const handleJobComplete = () => {
    onUploadComplete();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
        Upload Drawing Set
      </h3>

      {!job ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Set Label
            </label>
            <input
              type="text"
              placeholder="e.g. Bid Set, Addendum 2, Construction Documents"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={uploading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
              isDragging
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            } ${uploading ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <svg
              className="mb-3 h-10 w-10 text-gray-400"
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
            {file ? (
              <p className="text-sm font-medium text-gray-700">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600">
                  Drop PDF here or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-400">PDF up to 500 MB</p>
              </>
            )}
          </div>

          {/* Upload progress (during HTTP transfer) */}
          {uploading && uploadPct < 100 && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>Uploading…</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-brand-500 transition-all duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload Drawing Set'}
          </button>
        </form>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {file?.name} uploaded
            </span>
          </div>

          <JobStatus jobId={job.id} onComplete={handleJobComplete} />

          <button
            onClick={reset}
            className="mt-4 text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Upload another set
          </button>
        </div>
      )}
    </div>
  );
}
