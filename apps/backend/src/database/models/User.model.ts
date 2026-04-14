import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  BaseEntity,
} from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'users' })
@Index(['email'], { unique: true })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ default: 'user' })
  role!: string;

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}

export const createUser = async (payload: Partial<User>): Promise<User> => {
  const repo = AppDataSource.getRepository(User);
  const user = repo.create(payload as any);
  const saved = await repo.save(user as any);
  return saved as User;
};

export const findByEmail = async (email: string) => {
  const repo = AppDataSource.getRepository(User);
  // Exclude soft-deleted users by default (deleted_at IS NULL)
  return repo.findOne({ where: { email, deletedAt: null } as any });
};

export const findById = async (id: string) => {
  const repo = AppDataSource.getRepository(User);
  // Exclude soft-deleted users by default (deleted_at IS NULL)
  return repo.findOne({ where: { id, deletedAt: null } as any });
};

export const findByIdIncludeDeleted = async (id: string) => {
  const repo = AppDataSource.getRepository(User);
  return repo.findOneBy({ id });
};

export const softDeleteUser = async (id: string) => {
  const repo = AppDataSource.getRepository(User);
  await repo.update({ id }, { deletedAt: new Date() } as any);
};

export const restoreUser = async (id: string) => {
  const repo = AppDataSource.getRepository(User);
  await repo.update({ id }, { deletedAt: null } as any);
};

export const resetStore = async () => {
  const repo = AppDataSource.getRepository(User);
  await repo.clear();
};

export default User;
