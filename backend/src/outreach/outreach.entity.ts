import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum OutreachType {
  CONNECTION = 'connection',
  MESSAGE = 'message',
}

export enum OutreachStatus {
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REPLIED = 'replied',
  NO_RESPONSE = 'no_response',
}

@Entity('outreach')
export class Outreach {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'enum', enum: OutreachType })
  type: OutreachType;

  @Column({ type: 'enum', enum: OutreachStatus, default: OutreachStatus.SENT })
  status: OutreachStatus;

  @Column()
  personName: string;

  @Column({ nullable: true })
  personTitle: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  profileUrn: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ nullable: true })
  relatedOpportunity: string;

  @CreateDateColumn()
  sentAt: Date;
}
