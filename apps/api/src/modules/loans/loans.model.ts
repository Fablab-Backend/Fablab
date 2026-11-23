import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
  OVERDUE = 'OVERDUE',
}

export enum EquipmentCondition {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export type LoanDocument = Loan & Document;

@Schema({ timestamps: true, collection: 'loans' })
export class Loan extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Resource', required: true })
  equipmentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  borrowerId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(LoanStatus), default: LoanStatus.ACTIVE })
  status!: LoanStatus;

  @Prop({ required: true })
  borrowedAt!: Date;

  @Prop({ required: true })
  dueAt!: Date;

  @Prop()
  returnedAt?: Date;

  @Prop({ type: String, enum: Object.values(EquipmentCondition), required: true })
  conditionAtLoan!: EquipmentCondition;

  @Prop({ type: String, enum: Object.values(EquipmentCondition) })
  conditionAtReturn?: EquipmentCondition;

  @Prop()
  notes?: string;

  @Prop()
  reminderSentAt?: Date;

  @Prop()
  overdueNotifiedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  handledBy?: Types.ObjectId;
}

export const LoanSchema = SchemaFactory.createForClass(Loan);

// Un seul prêt ACTIVE/OVERDUE par équipement : la garantie d'atomicité est cet index.
LoanSchema.index(
  { equipmentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] },
    },
  },
);
LoanSchema.index({ borrowerId: 1, createdAt: -1 });
LoanSchema.index({ status: 1, dueAt: 1 });
