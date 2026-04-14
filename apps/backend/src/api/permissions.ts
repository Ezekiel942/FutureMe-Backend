/**
 * Permission definitions and role→permission mapping.
 * This file is an additive extension — it does not change existing roles
 * or authentication middleware. Controllers and routes may opt-in to
 * requirePermission(...) without modifying JWT payloads.
 */
export enum Permission {
  // Session permissions
  SessionCreate = 'session:create',
  SessionRead = 'session:read',
  SessionEnd = 'session:end',

  // User permissions
  UserRead = 'user:read',
  UserDelete = 'user:delete',
  UserManage = 'user:manage',

  // Project permissions
  ProjectRead = 'project:read',
  ProjectCreate = 'project:create',
  ProjectManage = 'project:manage',

  // Billing permissions
  BillingRead = 'billing:read',
  BillingManage = 'billing:manage',

  // Audit permissions
  AuditRead = 'audit:read',
  AdminAudit = 'admin:audit',

  // Team permissions
  TeamManage = 'team:manage',
}

export type Role =
  | 'admin'
  | 'manager'
  | 'user'
  | 'project_lead'
  | 'financial_auditor'
  | 'external_consultant';

// Map roles to allowed permissions. Admin receives all permissions.
export const RolePermissions: Record<Role, Permission[]> = {
  admin: [
    // Sessions
    Permission.SessionCreate,
    Permission.SessionRead,
    Permission.SessionEnd,
    // Users
    Permission.UserRead,
    Permission.UserDelete,
    Permission.UserManage,
    // Projects
    Permission.ProjectRead,
    Permission.ProjectCreate,
    Permission.ProjectManage,
    // Billing
    Permission.BillingRead,
    Permission.BillingManage,
    // Audit & Admin
    Permission.AuditRead,
    Permission.AdminAudit,
    // Team
    Permission.TeamManage,
  ],
  manager: [
    Permission.SessionCreate,
    Permission.SessionRead,
    Permission.SessionEnd,
    Permission.UserRead,
    Permission.UserManage,
    Permission.ProjectRead,
    Permission.AuditRead,
    Permission.TeamManage,
  ],
  user: [Permission.SessionCreate, Permission.SessionRead],
  project_lead: [
    Permission.SessionCreate,
    Permission.SessionRead,
    Permission.SessionEnd,
    Permission.UserRead,
    Permission.ProjectRead,
    Permission.ProjectManage,
    Permission.AuditRead,
    Permission.TeamManage,
  ],
  financial_auditor: [Permission.BillingRead, Permission.AuditRead, Permission.UserRead],
  external_consultant: [Permission.SessionRead, Permission.ProjectRead, Permission.AuditRead],
};

export default { Permission, RolePermissions };
