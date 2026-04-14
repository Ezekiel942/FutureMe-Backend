import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'subscriptions' })
export class Subscription extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @Column()
  plan!: string;

  @Column({ default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  endedAt?: string | null;
}

export const createSubscription = async (input: Partial<Subscription>): Promise<Subscription> => {
  const repo = AppDataSource.getRepository(Subscription);
  const s = repo.create(input as any);
  const saved = await repo.save(s as any);
  return saved as Subscription;
};

export const findSubscriptionById = async (id: string) => {
  const repo = AppDataSource.getRepository(Subscription);
  return repo.findOneBy({ id } as any);
};

export const listSubscriptionsByOrg = async (organizationId: string) => {
  const repo = AppDataSource.getRepository(Subscription);
  return repo.find({ where: { organizationId } as any });
};

export const resetSubscriptions = async () => {
  const repo = AppDataSource.getRepository(Subscription);
  await repo.clear();
};

export default Subscription;
