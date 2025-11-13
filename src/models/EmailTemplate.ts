import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailTemplate extends Document {
  userId: mongoose.Types.ObjectId;
  eventId?: mongoose.Types.ObjectId;
  logoUrl: string;
  hostName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  eventDetailsBackgroundColor: string;
  fontFamily: string;
  headerText: string;
  sampleEventTitle: string;
  footerText: string;
  buttonText: string;
  buttonRadius: string;
  showEmojis: boolean;
  descriptionText: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
    },
    logoUrl: {
      type: String,
      default: '',
    },
    hostName: {
      type: String,
      required: true,
      trim: true,
    },
    primaryColor: {
      type: String,
      default: '#4F46E5',
    },
    secondaryColor: {
      type: String,
      default: '#ffffff',
    },
    textColor: {
      type: String,
      default: '#374151',
    },
    eventDetailsBackgroundColor: {
      type: String,
      default: '#f3f4f6',
    },
    fontFamily: {
      type: String,
      default: 'Arial, sans-serif',
    },
    headerText: {
      type: String,
      default: "You're Invited!",
    },
    sampleEventTitle: {
      type: String,
      default: 'Join Us for an Amazing Event',
    },
    footerText: {
      type: String,
      default: 'We look forward to seeing you!',
    },
    buttonText: {
      type: String,
      default: 'RSVP Now',
    },
    buttonRadius: {
      type: String,
      default: '8',
    },
    showEmojis: {
      type: Boolean,
      default: true,
    },
    descriptionText: {
      type: String,
      default: 'Join us for an amazing event! This is a preview of how your invitation will look.',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one default template per user
EmailTemplateSchema.index({ userId: 1, isDefault: 1 }, { unique: true, sparse: true });
EmailTemplateSchema.index({ userId: 1, eventId: 1 });

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);

