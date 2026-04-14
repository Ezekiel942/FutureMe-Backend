export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  assignedTo?: string | null;
  organizationId?: string | null;
  priority: number;
  dueDate?: string | null;
  estimatedHours?: number | null;
  actualHours: number;
  createdAt: string;
  updatedAt: string;
}
