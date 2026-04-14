import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'announcements' })
export class Announcement extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @Column()
  createdBy!: string; // User ID of manager who created

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  expiresAt?: string | null; // Optional expiration time

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

// Helper functions for database operations
export const createAnnouncement = async (input: Partial<Announcement>): Promise<Announcement> => {
  const repo = AppDataSource.getRepository(Announcement);
  const a = repo.create(input as any);
  const saved = await repo.save(a as any);
  return saved as Announcement;
};

export const findAnnouncementById = async (id: string) => {
  const repo = AppDataSource.getRepository(Announcement);
  return repo.findOneBy({ id } as any);
};

export const findAnnouncementsByOrganization = async (
  organizationId: string,
  isActive?: boolean
) => {
  const repo = AppDataSource.getRepository(Announcement);
  const query: any = { organizationId };
  if (isActive !== undefined) {
    query.isActive = isActive;
  }
  return repo.find({ where: query } as any);
};

export const updateAnnouncement = async (id: string, patch: Partial<Announcement>) => {
  const repo = AppDataSource.getRepository(Announcement);
  const existing = await repo.findOneBy({ id } as any);
  if (!existing) return null;
  Object.assign(existing, patch);
  return repo.save(existing);
};

export const deleteAnnouncement = async (id: string) => {
  const repo = AppDataSource.getRepository(Announcement);
  const existing = await repo.findOneBy({ id } as any);
  if (!existing) return false;
  await repo.remove(existing);
  return true;
};
