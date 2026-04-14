import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'insights' })
export class Insight extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column()
  type!: string;

  @Column()
  message!: string;

  @Column({ nullable: true })
  severity?: string;

  @Column({ type: 'simple-json', nullable: true })
  data?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const createInsight = async (input: Partial<Insight>): Promise<Insight> => {
  const repo = AppDataSource.getRepository(Insight);
  const i = repo.create(input as any);
  const saved = await repo.save(i as any);
  return saved as Insight;
};

export const findInsightById = async (id: string) => {
  const repo = AppDataSource.getRepository(Insight);
  return repo.findOneBy({ id } as any);
};

export const findInsightsByUser = async (userId: string) => {
  const repo = AppDataSource.getRepository(Insight);
  return repo.find({ where: { userId } as any });
};

export const findInsightsByOrganization = async (organizationId: string) => {
  const repo = AppDataSource.getRepository(Insight);
  return repo.find({ where: { organizationId } as any });
};

export const listInsights = async () => {
  const repo = AppDataSource.getRepository(Insight);
  return repo.find();
};

export const resetInsights = async () => {
  const repo = AppDataSource.getRepository(Insight);
  await repo.clear();
};

export default Insight;
