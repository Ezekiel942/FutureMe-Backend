import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'work_sessions' })
export class WorkSession extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'project_id', type: 'varchar', nullable: true })
  projectId?: string | null;

  @Column({ name: 'task_id', type: 'varchar', nullable: true })
  taskId?: string | null;

  @Column({ name: 'start_time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'varchar', nullable: true })
  endTime?: string | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'meta', type: 'simple-json', nullable: true })
  meta?: any;
}

export const createSession = async (input: Partial<WorkSession>): Promise<WorkSession> => {
  // Validate required fields
  if (!input.userId) {
    throw new Error('userId is required to create a session');
  }

  const repo = AppDataSource.getRepository(WorkSession);
  const s = repo.create(input as any);
  const saved = await repo.save(s as any);
  return saved as WorkSession;
};

export const updateSession = async (id: string, patch: Partial<WorkSession>) => {
  const repo = AppDataSource.getRepository(WorkSession);
  const existing = await repo.findOneBy({ id } as any);
  if (!existing) return null;
  Object.assign(existing, patch);
  return repo.save(existing);
};

export const findSessionById = async (id: string) => {
  const repo = AppDataSource.getRepository(WorkSession);
  return repo.findOneBy({ id } as any);
};

export const findSessionsByUser = async (userId: string) => {
  const repo = AppDataSource.getRepository(WorkSession);
  return repo.find({ where: { userId } as any });
};

export const listSessions = async () => {
  const repo = AppDataSource.getRepository(WorkSession);
  return repo.find();
};

export const resetSessions = async () => {
  const repo = AppDataSource.getRepository(WorkSession);
  await repo.clear();
};

export default WorkSession;
