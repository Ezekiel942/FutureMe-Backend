import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BaseEntity,
} from 'typeorm';

/**
 * SkillGraph
 *
 * Tracks user skills and proficiency levels for workforce intelligence.
 * Used for task assignment optimization and team capability analysis.
 */
@Entity({ name: 'skill_graph' })
@Index(['userId'])
@Index(['organizationId'])
@Index(['skill'])
@Index(['userId', 'skill'], { unique: true })
export class SkillGraph extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  skill!: string;

  @Column({ type: 'int' })
  proficiency!: number; // 1-5 scale

  @Column({ type: 'int', default: 0 })
  projectCount!: number;

  @UpdateDateColumn()
  lastUpdated!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}