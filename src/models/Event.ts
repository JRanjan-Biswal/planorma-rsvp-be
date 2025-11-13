import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  description: string;
  date: Date;
  location: string;
  category: string;
  capacity: number;
  hostName: string;
  hostMobile: string;
  hostEmail: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    hostName: {
      type: String,
      required: [true, 'Host name is required'],
      trim: true,
      maxlength: [100, 'Host name cannot exceed 100 characters'],
    },
    hostMobile: {
      type: String,
      required: [true, 'Host mobile number is required'],
      trim: true,
      maxlength: [20, 'Host mobile number cannot exceed 20 characters'],
    },
    hostEmail: {
      type: String,
      required: [true, 'Host email is required'],
      trim: true,
      lowercase: true,
      maxlength: [100, 'Host email cannot exceed 100 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
EventSchema.index({ createdBy: 1, createdAt: -1 });
EventSchema.index({ date: 1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);

