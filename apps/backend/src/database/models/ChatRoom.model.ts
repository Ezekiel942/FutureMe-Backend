import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { ChatMessage } from './ChatMessage.model';

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { array: true })
  @Index('idx_chat_rooms_participants')
  participants!: string[];

  @Column('uuid', { nullable: true })
  lastMessageId?: string;

  @Column('text', { nullable: true })
  lastMessage?: string;

  @Column('timestamp', { nullable: true })
  lastMessageAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => ChatMessage, (message) => message.room)
  messages!: ChatMessage[];
}