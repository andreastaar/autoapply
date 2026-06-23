import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Opportunity } from '../opportunities/opportunity.entity';

export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  INTERVIEW = 'interview',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WAITLISTED = 'waitlisted',
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.applications)
  user: User;

  @ManyToOne(() => Opportunity, { eager: true })
  opportunity: Opportunity;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  appliedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
