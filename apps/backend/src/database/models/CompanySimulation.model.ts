import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  BaseEntity,
  OneToMany,
} from 'typeorm';
import { SimulationResult } from './SimulationResult.model';

/**
 * CompanySimulation
 *
 * Stores digital twin simulation scenarios for workforce optimization.
 * Each simulation represents a "what-if" scenario like hiring new engineers
 * or changing work policies.
 */
@Entity({ name: 'company_simulations' })
@Index(['tenantId'])
@Index(['scenarioType'])
export class CompanySimulation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  tenantId!: string;

  @Column({ type: 'varchar' })
  scenarioType!: string;

  @Column({ type: 'jsonb' })
  parametersJson!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  // Relations
  @OneToMany(() => SimulationResult, (result) => result.simulation)
  results!: SimulationResult[];
}
