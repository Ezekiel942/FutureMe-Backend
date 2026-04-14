import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';
import { AppDataSource } from '@config/database';

@Entity({ name: 'organizations' })
export class Organization extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const createOrganization = async (name: string, id?: string): Promise<Organization> => {
  const repo = AppDataSource.getRepository(Organization);
  const org = repo.create({ name } as any);
  const saved = await repo.save(org as any);
  return saved as Organization;
};

export const findOrganizationById = async (id: string) => {
  const repo = AppDataSource.getRepository(Organization);
  return repo.findOneBy({ id });
};

export const listOrganizations = async () => {
  const repo = AppDataSource.getRepository(Organization);
  return repo.find();
};

export const resetOrganizations = async () => {
  const repo = AppDataSource.getRepository(Organization);
  await repo.clear();
};

export default Organization;
