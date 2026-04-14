import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BaseEntity,
} from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'projects' })
@Index(['organizationId'])
@Index(['ownerId'])
@Index(['status'])
export class Project extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  ownerId?: string | null;

  @Column({
    type: 'varchar',
    default: 'planning',
  })
  status!: 'planning' | 'active' | 'on-hold' | 'completed' | 'archived';

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  targetEndDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actualEndDate?: Date | null;

  @Column({ type: 'int', default: 0 })
  budget!: number;

  @Column({ type: 'int', default: 0 })
  estimatedHours!: number;

  @Column({ type: 'int', nullable: true })
  teamSize?: number | null;

  @Column({ type: 'simple-json', nullable: true })
  teamMembers?: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: any;
}

export const createProject = async (input: Partial<Project>): Promise<Project> => {
  const repo = AppDataSource.getRepository(Project);
  const project = repo.create(input as any);
  const saved = await repo.save(project as any);
  return saved as Project;
};

export const findProjectById = async (id: string) => {
  const repo = AppDataSource.getRepository(Project);
  return repo.findOneBy({ id } as any);
};

export const findProjectsByOrganization = async (organizationId: string) => {
  const repo = AppDataSource.getRepository(Project);
  return repo.find({
    where: { organizationId } as any,
    order: { createdAt: 'DESC' } as any,
  });
};

export const findProjectsByOwner = async (ownerId: string, organizationId: string) => {
  const repo = AppDataSource.getRepository(Project);
  return repo.find({
    where: { ownerId, organizationId } as any,
    order: { createdAt: 'DESC' } as any,
  });
};

export const findProjectsByStatus = async (
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'archived',
  organizationId: string
) => {
  const repo = AppDataSource.getRepository(Project);
  return repo.find({
    where: { status, organizationId } as any,
    order: { createdAt: 'DESC' } as any,
  });
};

export const updateProject = async (id: string, patch: Partial<Project>) => {
  const repo = AppDataSource.getRepository(Project);
  const existing = await repo.findOneBy({ id } as any);
  if (!existing) return null;
  Object.assign(existing, patch);
  existing.updatedAt = new Date();
  return repo.save(existing);
};

export const deleteProject = async (id: string) => {
  const repo = AppDataSource.getRepository(Project);
  return repo.delete({ id } as any);
};

export const addTeamMember = async (projectId: string, userId: string) => {
  const repo = AppDataSource.getRepository(Project);
  const project = await repo.findOneBy({ id: projectId } as any);
  if (!project) return null;

  const members = project.teamMembers || [];
  if (!members.includes(userId)) {
    members.push(userId);
    project.teamMembers = members;
    project.teamSize = members.length;
    await repo.save(project);
  }
  return project;
};

export const removeTeamMember = async (projectId: string, userId: string) => {
  const repo = AppDataSource.getRepository(Project);
  const project = await repo.findOneBy({ id: projectId } as any);
  if (!project) return null;

  const members = project.teamMembers || [];
  const filtered = members.filter((m: string) => m !== userId);
  if (filtered.length !== members.length) {
    project.teamMembers = filtered;
    project.teamSize = filtered.length;
    await repo.save(project);
  }
  return project;
};

export const getProjectMetrics = async (projectId: string) => {
  // Get total hours from work_sessions
  const sessionResult: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds FROM work_sessions WHERE project_id = $1',
    [projectId]
  );
  const sessionSeconds = sessionResult[0]?.total_seconds || 0;
  const sessionHours = Math.round((sessionSeconds / 3600) * 100) / 100;

  // Get task counts
  const taskResult: any[] = await AppDataSource.query(
    'SELECT status, COUNT(*) as cnt FROM tasks WHERE project_id = $1 GROUP BY status',
    [projectId]
  );

  const taskCounts: Record<string, number> = {};
  taskResult.forEach((row: any) => {
    taskCounts[row.status] = row.cnt;
  });

  const totalTasks = Object.values(taskCounts).reduce((a: number, b: number) => a + b, 0);
  const completedTasks = taskCounts.completed || 0;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get task hours
  const taskHourResult: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM(estimated_hours), 0) as estimated, COALESCE(SUM(actual_hours), 0) as actual FROM tasks WHERE project_id = $1',
    [projectId]
  );

  const estimatedTaskHours = taskHourResult[0]?.estimated || 0;
  const actualTaskHours = taskHourResult[0]?.actual || 0;

  return {
    projectId,
    totalHours: sessionHours,
    taskMetrics: {
      total: totalTasks,
      completed: completedTasks,
      pending: taskCounts.pending || 0,
      inProgress: taskCounts['in-progress'] || 0,
      blocked: taskCounts.blocked || 0,
      completionPercent,
    },
    hoursMetrics: {
      estimatedTaskHours,
      actualTaskHours,
      trackingAccuracy:
        estimatedTaskHours > 0 ? Math.round((actualTaskHours / estimatedTaskHours) * 100) : 0,
    },
  };
};

export default Project;
