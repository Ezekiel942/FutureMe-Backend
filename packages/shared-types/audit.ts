export interface Audit {
  id: string;
  actorId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: any;
  createdAt: string;
}
