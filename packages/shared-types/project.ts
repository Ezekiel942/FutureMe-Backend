export interface Project {
  id: string;
  name: string;
  description?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'archived';
  startDate?: string | null;
  targetEndDate?: string | null;
  actualEndDate?: string | null;
  budget: number;
  estimatedHours: number;
  teamSize?: number | null;
  teamMembers?: string[] | null;
  createdAt: string;
  updatedAt: string;
}
