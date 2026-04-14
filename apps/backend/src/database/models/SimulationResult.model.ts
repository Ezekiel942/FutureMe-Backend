import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BaseEntity,
} from 'typeorm';
import { CompanySimulation } from './CompanySimulation.model';

/**
 * SimulationResult
 *
 * Stores the predicted outcomes of a digital twin simulation.
 * Each result shows how a scenario would impact productivity, completion time, and costs.
 */
@Entity({ name: 'simulation_results' })
export class SimulationResult extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  simulationId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  predictedProductivityChange!: number; // percentage change (-50.00 to 50.00)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  predictedCompletionChange!: number; // percentage change (-50.00 to 50.00)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  predictedCostChange!: number; // percentage change (-50.00 to 50.00)

  @CreateDateColumn()
  generatedAt!: Date;

  // Relations
  @ManyToOne(() => CompanySimulation, simulation => simulation.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'simulationId' })
  simulation!: CompanySimulation;
}