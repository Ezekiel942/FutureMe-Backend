export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'admin' | string;
  organizationId?: string | null;
  createdAt: string;
}
