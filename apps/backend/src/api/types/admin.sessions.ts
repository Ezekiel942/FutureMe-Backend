export type AdminSessionStatus = 'active' | 'paused' | 'ended';

export interface AdminSessionQuery {
  page?: number;
  limit?: number;
  status?: AdminSessionStatus;
  userId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AdminSessionRow {
  sessionId: string;
  userId: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSessionSummary {
  activeCount: number;
  pausedCount: number;
  endedCount: number;
  total: number;
}

export interface AdminSessionsResult {
  summary: AdminSessionSummary;
  sessions: AdminSessionRow[];
  page: number;
  limit: number;
  total: number;
}
