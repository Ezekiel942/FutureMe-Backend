import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  BaseEntity,
} from 'typeorm';

/**
 * WorkforceModel
 *
 * Stores learned workforce patterns and metrics for the digital twin.
 * This model learns from historical data to improve simulation accuracy.
 */
@Entity({ name: 'workforce_models' })
@Index(['tenantId'], { unique: true })
export class WorkforceModel extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  tenantId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  averageProductivity!: number; // average hours per day

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  averageTaskDuration!: number; // average hours per task

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  teamUtilization!: number; // team utilization percentage (0-100)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  burnoutIndex!: number; // burnout index (0-100)

  @UpdateDateColumn()
  lastUpdated!: Date;
}