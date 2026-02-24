import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Types ─────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  externalProjectId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { drawingSets: number };
}

export interface DrawingSet {
  id: string;
  projectId: string;
  label: string;
  originalFile: string;
  createdAt: string;
  _count?: { pages: number };
}

export interface ProjectDetail extends Project {
  drawingSets: DrawingSet[];
}

export interface Page {
  id: string;
  pageIndex: number;
  sheetNumber: string | null;
  sheetNumberSource: string | null;
  imagePath: string;
  width: number | null;
  height: number | null;
}

export interface Job {
  id: string;
  type: string;
  referenceId: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  progress: number;
  message: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Projects ──────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const res = await api.get<Project[]>('/projects');
  return res.data;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await api.get<ProjectDetail>(`/projects/${id}`);
  return res.data;
}

export async function createProject(
  name: string,
  externalProjectId?: string
): Promise<Project> {
  const res = await api.post<Project>('/projects', { name, externalProjectId });
  return res.data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

// ── Drawing Sets ──────────────────────────────

export async function uploadDrawingSet(
  projectId: string,
  file: File,
  label: string,
  onProgress?: (pct: number) => void
): Promise<{ drawingSet: DrawingSet; job: Job }> {
  const form = new FormData();
  form.append('file', file);
  form.append('label', label);

  const res = await api.post<{ drawingSet: DrawingSet; job: Job }>(
    `/projects/${projectId}/drawing-sets`,
    form,
    {
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }
  );
  return res.data;
}

// ── Drawing Sets ─────────────────────────────

export async function getDrawingSetPages(drawingSetId: string): Promise<Page[]> {
  const res = await api.get<Page[]>(`/drawing-sets/${drawingSetId}/pages`);
  return res.data;
}

// ── Jobs ──────────────────────────────────────

export async function getJob(id: string): Promise<Job> {
  const res = await api.get<Job>(`/jobs/${id}`);
  return res.data;
}
