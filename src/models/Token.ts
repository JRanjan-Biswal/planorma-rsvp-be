import mongoose, { Schema, Document } from 'mongoose';

export interface IToken extends Document {
  eventId: mongoose.Types.ObjectId;
  email: string;
  name?: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema = new Schema<IToken>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

TokenSchema.index({ eventId: 1, createdAt: -1 });
TokenSchema.index({ token: 1 });

export const Token = mongoose.model<IToken>('Token', TokenSchema);

