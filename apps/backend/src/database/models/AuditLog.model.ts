import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '../../config/database';

@Entity({ name: 'audit_logs' })
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  actorId?: string | null;

  @Column()
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  resourceType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  resourceId?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  meta?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const createAudit = async (input: Partial<AuditLog>): Promise<AuditLog> => {
  const repo = AppDataSource.getRepository(AuditLog);
  const a = repo.create(input as any);
  const saved = await repo.save(a as any);
  return saved as AuditLog;
};

export const listAudits = async () => {
  const repo = AppDataSource.getRepository(AuditLog);
  return repo.find();
};

export const resetAudits = async () => {
  const repo = AppDataSource.getRepository(AuditLog);
  await repo.clear();
};

export default AuditLog;
