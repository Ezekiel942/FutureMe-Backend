import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'announcement_responses' })
export class AnnouncementResponse extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  announcementId!: string;

  @Column()
  userId!: string;

  @Column()
  organizationId!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ default: false })
  isAcknowledged!: boolean;

  @Column({ type: 'text', nullable: true })
  response?: string | null;

  @Column({ default: false })
  hasResponded!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'varchar', nullable: true, name: 'read_at' })
  readAt?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'acknowledged_at' })
  acknowledgedAt?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'responded_at' })
  respondedAt?: string | null;
}

// Helper functions for database operations
export const createResponse = async (
  input: Partial<AnnouncementResponse>
): Promise<AnnouncementResponse> => {
  const repo = AppDataSource.getRepository(AnnouncementResponse);
  const r = repo.create(input as any);
  const saved = await repo.save(r as any);
  return saved as AnnouncementResponse;
};

export const findResponseById = async (id: string) => {
  const repo = AppDataSource.getRepository(AnnouncementResponse);
  return repo.findOneBy({ id } as any);
};

export const findResponsesByAnnouncement = async (announcementId: string) => {
  const repo = AppDataSource.getRepository(AnnouncementResponse);
  return repo.find({ where: { announcementId } as any });
};

export const findResponseByUserAndAnnouncement = async (userId: string, announcementId: string) => {
  const repo = AppDataSource.getRepository(AnnouncementResponse);
  return repo.findOne({ where: { userId, announcementId } as any });
};

export const updateResponse = async (id: string, patch: Partial<AnnouncementResponse>) => {
  const repo = AppDataSource.getRepository(AnnouncementResponse);
  const existing = await repo.findOneBy({ id } as any);
  if (!existing) return null;
  Object.assign(existing, patch);
  return repo.save(existing);
};

export const findResponsesByOrganization = async (
  organizationId: string,
  announcementId: string
) => {
  const repo = AppDataSource.getRepository(AnnouncementResponse);
  return repo.find({ where: { organizationId, announcementId } as any });
};

export default AnnouncementResponse;
