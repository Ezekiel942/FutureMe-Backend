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

@Entity({ name: 'tasks' })
@Index(['projectId'])
@Index(['organizationId'])
@Index(['assignedTo'])
@Index(['status'])
export class Task extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  projectId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status!: 'pending' | 'in-progress' | 'completed' | 'blocked';

  @Column({ type: 'varchar', nullable: true })
  assignedTo?: string | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date | null;

  @Column({ type: 'int', nullable: true })
  estimatedHours?: number | null;

  @Column({ type: 'int', default: 0 })
  actualHours!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: any;
}

export const createTask = async (input: Partial<Task>): Promise<Task> => {
  const repo = AppDataSource.getRepository(Task);
  const task = repo.create(input as any);
  const saved = await repo.save(task as any);
  return saved as Task;
};

export const findTaskById = async (id: string) => {
  const repo = AppDataSource.getRepository(Task);
  return repo.findOneBy({ id } as any);
};

export const findTasksByProject = async (projectId: string, organizationId: string) => {
  const repo = AppDataSource.getRepository(Task);
  return repo.find({
    where: { projectId, organizationId } as any,
    order: { priority: 'DESC', createdAt: 'DESC' } as any,
  });
};

export const findTasksByAssignee = async (userId: string, organizationId: string) => {
  const repo = AppDataSource.getRepository(Task);
  return repo.find({
    where: { assignedTo: userId, organizationId } as any,
    order: { priority: 'DESC', dueDate: 'ASC' } as any,
  });
};

export const findTasksByStatus = async (
  projectId: string,
  status: 'pending' | 'in-progress' | 'completed' | 'blocked',
  organizationId: string
) => {
  const repo = AppDataSource.getRepository(Task);
  return repo.find({
    where: { projectId, status, organizationId } as any,
  });
};

export const updateTask = async (id: string, patch: Partial<Task>) => {
  const repo = AppDataSource.getRepository(Task);
  const existing = await repo.findOneBy({ id } as any);
  if (!existing) return null;
  Object.assign(existing, patch);
  existing.updatedAt = new Date();
  return repo.save(existing);
};

export const deleteTask = async (id: string) => {
  const repo = AppDataSource.getRepository(Task);
  return repo.delete({ id } as any);
};

export const listTasksByOrganization = async (organizationId: string) => {
  const repo = AppDataSource.getRepository(Task);
  return repo.find({
    where: { organizationId } as any,
    order: { createdAt: 'DESC' } as any,
  });
};

export const syncTaskHoursFromSessions = async (taskId: string) => {
  const repo = AppDataSource.getRepository(Task);
  const task = await repo.findOneBy({ id: taskId } as any);
  if (!task) return null;

  // Calculate total seconds from work_sessions
  const result: any[] = await AppDataSource.query(
    'SELECT COALESCE(SUM("duration_seconds"), 0) as total_seconds FROM work_sessions WHERE "task_id" = $1',
    [taskId]
  );

  const totalSeconds = result[0]?.total_seconds || 0;
  const totalHours = Math.round((totalSeconds / 3600) * 100) / 100; // Round to 2 decimals

  task.actualHours = totalHours;
  await repo.save(task);
  return task;
};

export const updateTaskProgress = async (taskId: string) => {
  const task = await syncTaskHoursFromSessions(taskId);
  if (!task) return null;

  // Auto-update status if completed
  if (task.estimatedHours && task.actualHours >= task.estimatedHours) {
    if (task.status !== 'completed') {
      task.status = 'completed';
      const repo = AppDataSource.getRepository(Task);
      await repo.save(task);
    }
  }

  return task;
};

export default Task;
