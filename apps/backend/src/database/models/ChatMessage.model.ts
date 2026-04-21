import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ChatRoom } from './ChatRoom.model';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
}

@Entity('chat_messages')
@Index('idx_messages_sender', ['senderId'])
@Index('idx_messages_room', ['roomId'])
@Index('idx_messages_created', ['createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  roomId!: string;

  @Column('uuid')
  senderId!: string;

  @Column('text')
  content!: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type!: MessageType;

  @Column('boolean', { default: false })
  isRead!: boolean;

  @Column('timestamp', { nullable: true })
  readAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => ChatRoom, (room) => room.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room!: ChatRoom;
}