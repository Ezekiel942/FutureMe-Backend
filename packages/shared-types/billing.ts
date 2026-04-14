export interface Subscription {
  id: string;
  organizationId: string;
  plan: string;
  status: 'active' | 'past_due' | 'cancelled' | string;
  startedAt: string;
  endedAt?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}
