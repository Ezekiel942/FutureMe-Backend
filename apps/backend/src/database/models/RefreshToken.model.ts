import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  Index,
} from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'refresh_tokens' })
@Index(['userId', 'token'])
@Index(['token'], { unique: true })
export class RefreshToken extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  token!: string;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export const createRefreshToken = async (
  userId: string,
  token: string,
  expiresAt: Date
): Promise<RefreshToken> => {
  const repo = AppDataSource.getRepository(RefreshToken);
  const refreshToken = repo.create({ userId, token, expiresAt });
  return repo.save(refreshToken);
};

export const findRefreshToken = async (token: string): Promise<RefreshToken | null> => {
  const repo = AppDataSource.getRepository(RefreshToken);
  return repo.findOneBy({ token, revoked: false });
};

export const findRefreshTokensByUserId = async (userId: string) => {
  const repo = AppDataSource.getRepository(RefreshToken);
  return repo.findBy({ userId, revoked: false });
};

export const revokeRefreshToken = async (token: string): Promise<boolean> => {
  const repo = AppDataSource.getRepository(RefreshToken);
  const result = await repo.update({ token }, { revoked: true });
  return result.affected ? result.affected > 0 : false;
};

export const revokeUserRefreshTokens = async (userId: string): Promise<void> => {
  const repo = AppDataSource.getRepository(RefreshToken);
  await repo.update({ userId }, { revoked: true });
};

export const cleanupExpiredTokens = async (): Promise<number> => {
  const repo = AppDataSource.getRepository(RefreshToken);
  const result = await repo.delete({ expiresAt: { $lt: new Date() } } as any);
  return result.affected || 0;
};

export default RefreshToken;
