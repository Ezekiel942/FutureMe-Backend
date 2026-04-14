import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from 'typeorm';
import { AppDataSource } from '../../config/database';

export enum RiskEventType {
  RISK_DETECTED = 'risk_detected',
  ANOMALY_FLAGGED = 'anomaly_flagged',
  BURNOUT_WARNING = 'burnout_warning',
  PROJECT_AT_RISK = 'project_at_risk',
}

export enum RiskSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum RiskCategory {
  BURNOUT = 'burnout',
  SCOPE_CREEP = 'scope_creep',
  GHOSTING = 'ghosting',
  EXCESSIVE_OVERTIME = 'excessive_overtime',
  FRAGMENTATION = 'fragmentation',
  INCONSISTENCY = 'inconsistency',
  UNDERUTILIZATION = 'underutilization',
  OFF_HOURS_WORK = 'off_hours_work',
}

@Entity({ name: 'risk_events' })
export class RiskEvent extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({
    type: 'enum',
    enum: RiskEventType,
  })
  riskType!: RiskEventType;

  @Column({
    type: 'enum',
    enum: RiskCategory,
  })
  category!: RiskCategory;

  @Column({
    type: 'enum',
    enum: RiskSeverity,
  })
  severity!: RiskSeverity;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'simple-json' })
  metadata!: any;

  @CreateDateColumn({ name: 'detected_at' })
  detectedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ default: true })
  isActive!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export const createRiskEvent = async (input: Partial<RiskEvent>): Promise<RiskEvent> => {
  const repo = AppDataSource.getRepository(RiskEvent);
  const risk = repo.create(input as any);
  const saved = await repo.save(risk as any);
  return saved as RiskEvent;
};

export const findRiskEventsByUser = async (userId: string, organizationId?: string) => {
  const repo = AppDataSource.getRepository(RiskEvent);
  const query = repo
    .createQueryBuilder('risk')
    .where('risk.userId = :userId', { userId })
    .andWhere('risk.isActive = :isActive', { isActive: true });

  if (organizationId) {
    query.andWhere('risk.organizationId = :organizationId', { organizationId });
  }

  return query.orderBy('risk.detectedAt', 'DESC').getMany();
};

export const findRiskEventsByOrganization = async (organizationId: string, limit = 100) => {
  const repo = AppDataSource.getRepository(RiskEvent);
  return repo.find({
    where: { organizationId, isActive: true },
    order: { detectedAt: 'DESC' },
    take: limit,
  });
};

export const updateRiskEvent = async (id: string, updates: Partial<RiskEvent>) => {
  const repo = AppDataSource.getRepository(RiskEvent);
  await repo.update({ id }, updates);
  return repo.findOne({ where: { id } });
};

export const resolveRiskEvent = async (id: string) => {
  return updateRiskEvent(id, { isActive: false, resolvedAt: new Date() });
};

export default RiskEvent;
