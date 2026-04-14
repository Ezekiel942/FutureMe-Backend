export interface Session {
  id: string;
  userId: string;
  projectId?: string | null;
  startTime: string; // ISO
  endTime?: string | null; // ISO
  durationSeconds?: number | null;
  createdAt: string;
}
