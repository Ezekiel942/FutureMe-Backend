import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'audit_entries' })
export class AuditEntry extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column()
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  targetId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const createAuditEntry = async (input: Partial<AuditEntry>): Promise<AuditEntry> => {
  const repo = AppDataSource.getRepository(AuditEntry);
  const e = repo.create(input as Partial<AuditEntry>);
  return repo.save(e);
};

export const listAuditEntries = async (offset = 0, limit = 50) => {
  const repo = AppDataSource.getRepository(AuditEntry);
  const [items, total] = await repo.findAndCount({
    order: { createdAt: 'DESC' },
    skip: offset,
    take: limit,
  });
  return { items, total };
};

export default AuditEntry;
