import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('tracker_entries')
export class TrackerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  company: string;

  @Column({ nullable: true })
  role: string;

  @Column({ nullable: true })
  url: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  score: number;

  @Column({ default: 'Evaluated' })
  status: string;

  @Column({ default: false })
  hasPdf: boolean;

  @Column({ type: 'text', nullable: true })
  reportContent: string;

  @Column({ nullable: true })
  reportFilename: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
