import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  BaseEntity,
  Index,
} from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'password_resets' })
@Index(['userId', 'token'])
export class PasswordReset extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  token!: string;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const createPasswordReset = async (
  userId: string,
  token: string,
  expiresAt: Date
): Promise<PasswordReset> => {
  const repo = AppDataSource.getRepository(PasswordReset);
  const item = repo.create({ userId, token, expiresAt } as Partial<PasswordReset>);
  return await repo.save(item);
};

export const findPasswordReset = async (token: string) => {
  const repo = AppDataSource.getRepository(PasswordReset);
  return repo.findOne({ where: { token, used: false } });
};

export const markPasswordResetUsed = async (token: string) => {
  const repo = AppDataSource.getRepository(PasswordReset);
  await repo.update({ token }, { used: true });
};

export default PasswordReset;
