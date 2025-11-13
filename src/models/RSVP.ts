import mongoose, { Schema, Document } from 'mongoose';

export interface IRSVP extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenId?: mongoose.Types.ObjectId; // For guest RSVPs via token
  status: 'going' | 'maybe' | 'not-going';
  companions: number; // Number of additional people (0 = just the user, 1 = user + 1 companion)
  guestName?: string; // For token-based RSVPs
  guestEmail?: string; // For token-based RSVPs
  dietaryPreference?: 'nonveg' | 'veg' | 'vegan'; // User's dietary preference
  companionDietaryPreference?: 'nonveg' | 'veg' | 'vegan'; // Companion's dietary preference
  createdAt: Date;
  updatedAt: Date;
}

const RSVPSchema = new Schema<IRSVP>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Not required for token-based RSVPs
    },
    tokenId: {
      type: Schema.Types.ObjectId,
      ref: 'Token',
      required: false,
    },
    status: {
      type: String,
      enum: ['going', 'maybe', 'not-going'],
      required: true,
    },
    companions: {
      type: Number,
      default: 0,
      min: 0,
    },
    guestName: {
      type: String,
      trim: true,
    },
    guestEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    dietaryPreference: {
      type: String,
      enum: ['nonveg', 'veg', 'vegan'],
      required: false,
    },
    companionDietaryPreference: {
      type: String,
      enum: ['nonveg', 'veg', 'vegan'],
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one RSVP per user per event OR one RSVP per token per event
// Using partial filter expressions to avoid null userId/tokenId conflicts
RSVPSchema.index(
  { eventId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } }
  }
);
RSVPSchema.index(
  { eventId: 1, tokenId: 1 },
  {
    unique: true,
    partialFilterExpression: { tokenId: { $exists: true, $type: 'objectId' } }
  }
);
RSVPSchema.index({ eventId: 1, status: 1 });

export const RSVP = mongoose.model<IRSVP>('RSVP', RSVPSchema);

