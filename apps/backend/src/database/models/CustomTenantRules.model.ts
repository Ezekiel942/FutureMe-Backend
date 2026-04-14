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

/**
 * CustomTenantRules
 *
 * Allows organizations to customize session validation rules.
 * If no rule exists for an organization, system defaults apply.
 *
 * Default values (used if no custom rule):
 * - minSessionLength: 300 seconds (5 minutes)
 * - maxDailyHours: 8 hours
 * - idleTimeout: 30 minutes
 * - overtimeThreshold: 8 hours
 */
@Entity({ name: 'custom_tenant_rules' })
@Index(['organizationId'], { unique: true })
export class CustomTenantRules extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  organizationId!: string;

  @Column({
    type: 'int',
    default: 300,
    comment: 'Minimum session length in seconds (default: 300 = 5 min)',
  })
  minSessionLength!: number;

  @Column({
    type: 'int',
    default: 8,
    comment: 'Maximum daily hours allowed (default: 8)',
  })
  maxDailyHours!: number;

  @Column({
    type: 'int',
    default: 30,
    comment: 'Idle timeout in minutes before auto-end (default: 30)',
  })
  idleTimeout!: number;

  @Column({
    type: 'int',
    default: 8,
    comment: 'Overtime threshold in hours (default: 8)',
  })
  overtimeThreshold!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/**
 * Get custom rules for an organization.
 * Returns null if no custom rules exist (use system defaults).
 */
export const getRulesByOrganization = async (
  organizationId: string
): Promise<CustomTenantRules | null> => {
  const repo = AppDataSource.getRepository(CustomTenantRules);
  return repo.findOneBy({ organizationId });
};

/**
 * Create or update custom rules for an organization.
 */
export const upsertRules = async (
  organizationId: string,
  updates: Partial<CustomTenantRules>
): Promise<CustomTenantRules> => {
  const repo = AppDataSource.getRepository(CustomTenantRules);
  const existing: CustomTenantRules | null = await repo.findOneBy({ organizationId });

  if (existing) {
    Object.assign(existing, updates as any);
    return repo.save(existing);
  }

  const toCreate = repo.create({ organizationId, ...(updates as any) } as any);
  const saved = await repo.save(toCreate as any);
  return saved as CustomTenantRules;
};

/**
 * Get effective rules for an organization.
 * Returns custom rules if exist, otherwise system defaults.
 */
export const getEffectiveRules = async (
  organizationId: string
): Promise<{
  minSessionLength: number;
  maxDailyHours: number;
  idleTimeout: number;
  overtimeThreshold: number;
}> => {
  const customRules = await getRulesByOrganization(organizationId);

  if (customRules) {
    return {
      minSessionLength: customRules.minSessionLength,
      maxDailyHours: customRules.maxDailyHours,
      idleTimeout: customRules.idleTimeout,
      overtimeThreshold: customRules.overtimeThreshold,
    };
  }

  // System defaults (if no custom rules)
  return {
    minSessionLength: 300, // 5 minutes
    maxDailyHours: 8,
    idleTimeout: 30, // 30 minutes
    overtimeThreshold: 8, // 8 hours
  };
};

/**
 * Delete custom rules (reverts to system defaults).
 */
export const deleteRules = async (organizationId: string): Promise<boolean> => {
  const repo = AppDataSource.getRepository(CustomTenantRules);
  const result = await repo.delete({ organizationId });
  return (result.affected ?? 0) > 0;
};

export default CustomTenantRules;
