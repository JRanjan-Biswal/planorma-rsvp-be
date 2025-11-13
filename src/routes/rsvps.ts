import express, { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { RSVP } from '../models/RSVP';
import { Event } from '../models/Event';
import { Token } from '../models/Token';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { rsvpRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

const rsvpSchema = z.object({
  status: z.enum(['going', 'maybe', 'not-going']),
});

const tokenRsvpSchema = z.object({
  status: z.enum(['going', 'not-going']),
  companions: z.number().min(0).max(5).default(0),
  guestName: z.string().optional(),
  dietaryPreference: z.enum(['nonveg', 'veg', 'vegan']).optional(),
  companionDietaryPreference: z.enum(['nonveg', 'veg', 'vegan']).optional(),
});

// Get RSVP for an event
router.get(
  '/:eventId',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify event exists and belongs to user
      const event = await Event.findOne({
        _id: req.params.eventId,
        createdBy: req.user!._id,
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const rsvp = await RSVP.findOne({
        eventId: req.params.eventId,
        userId: req.user!._id,
      }).lean();

      res.json({
        rsvp: rsvp
          ? {
              id: rsvp._id.toString(),
              eventId: rsvp.eventId.toString(),
              userId: rsvp.userId.toString(),
              status: rsvp.status,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create or update RSVP
router.post(
  '/:eventId',
  authenticate,
  requireAdmin,
  rsvpRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const validated = rsvpSchema.parse(req.body);

      // Verify event exists and belongs to user
      const event = await Event.findOne({
        _id: req.params.eventId,
        createdBy: req.user!._id,
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Upsert RSVP
      const rsvp = await RSVP.findOneAndUpdate(
        {
          eventId: req.params.eventId,
          userId: req.user!._id,
        },
        {
          eventId: req.params.eventId,
          userId: req.user!._id,
          status: validated.status,
        },
        {
          upsert: true,
          new: true,
        }
      ).lean();

      res.json({
        success: true,
        rsvp: {
          id: rsvp._id.toString(),
          eventId: rsvp.eventId.toString(),
          userId: rsvp.userId.toString(),
          status: rsvp.status,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all RSVPs for an event (admin only)
router.get(
  '/event/:eventId/all',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify event exists and belongs to user
      const event = await Event.findOne({
        _id: req.params.eventId,
        createdBy: req.user!._id,
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const rsvps = await RSVP.find({ eventId: req.params.eventId })
        .populate('userId', 'email')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        rsvps: rsvps.map((rsvp) => ({
          id: rsvp._id.toString(),
          eventId: rsvp.eventId.toString(),
          userId: rsvp.userId.toString(),
          status: rsvp.status,
          createdAt: rsvp.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Submit RSVP via token (public endpoint)
router.post(
  '/token/:token',
  rsvpRateLimiter,
  async (req: express.Request, res: Response) => {
    try {
      const validated = tokenRsvpSchema.parse(req.body);

      // Find token
      const tokenDoc = await Token.findOne({ token: req.params.token }).lean();

      if (!tokenDoc) {
        return res.status(404).json({ error: 'Invalid or expired invitation token' });
      }

      // Check if event exists
      const event = await Event.findById(tokenDoc.eventId).lean();

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if already responded
      const existingRsvp = await RSVP.findOne({
        tokenId: tokenDoc._id,
        eventId: tokenDoc.eventId,
      });

      if (existingRsvp) {
        return res.status(400).json({
          error: 'You have already responded to this invitation',
          rsvp: {
            status: existingRsvp.status,
            companions: existingRsvp.companions,
            respondedAt: existingRsvp.createdAt,
          },
        });
      }

      // Calculate total attendees for this RSVP (1 + companions)
      const totalAttendees = validated.status === 'going' ? 1 + validated.companions : 0;

      // Check capacity if going
      if (validated.status === 'going') {
        // Get current RSVP count including companions
        const rsvps = await RSVP.find({
          eventId: tokenDoc.eventId,
          status: 'going',
        }).lean();

        const currentAttendees = rsvps.reduce((sum, rsvp) => {
          return sum + 1 + (rsvp.companions || 0);
        }, 0);

        if (currentAttendees + totalAttendees > event.capacity) {
          return res.status(400).json({
            error: `Event is full. Only ${event.capacity - currentAttendees} ${
              event.capacity - currentAttendees === 1 ? 'spot' : 'spots'
            } remaining.`,
            availableSpots: event.capacity - currentAttendees,
          });
        }
      }

      // Create RSVP
      // NOTE: Do NOT include userId field for token-based RSVPs
      // The sparse index will fail if multiple RSVPs have userId: null
      const rsvpData: any = {
        eventId: tokenDoc.eventId,
        tokenId: tokenDoc._id,
        status: validated.status,
        companions: validated.companions,
        guestName: validated.guestName || tokenDoc.name,
        guestEmail: tokenDoc.email,
      };

      // Only include dietary preferences if they are specified
      if (validated.dietaryPreference) {
        rsvpData.dietaryPreference = validated.dietaryPreference;
      }
      if (validated.companionDietaryPreference) {
        rsvpData.companionDietaryPreference = validated.companionDietaryPreference;
      }

      const rsvp = await RSVP.create(rsvpData);

      // Update Token's name if guest provided a name
      // This ensures the admin panel shows the updated name
      if (validated.guestName && validated.guestName.trim()) {
        await Token.findByIdAndUpdate(
          tokenDoc._id,
          { name: validated.guestName.trim() },
          { new: true }
        );
      }

      res.status(201).json({
        success: true,
        message: validated.status === 'going'
          ? `RSVP confirmed! You ${validated.companions > 0 ? `and ${validated.companions} companion${validated.companions > 1 ? 's' : ''}` : 'have'} been registered.`
          : 'Thank you for your response.',
        rsvp: {
          id: (rsvp._id as mongoose.Types.ObjectId).toString(),
          status: rsvp.status,
          companions: rsvp.companions,
          totalAttendees,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation error:', error.errors);
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      console.error('Token RSVP error:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Check RSVP status via token (public endpoint)
router.get(
  '/token/:token/status',
  async (req: express.Request, res: Response) => {
    try {
      // Find token
      const tokenDoc = await Token.findOne({ token: req.params.token }).lean();

      if (!tokenDoc) {
        return res.status(404).json({ error: 'Invalid or expired invitation token' });
      }

      // Check if already responded
      const rsvp = await RSVP.findOne({
        tokenId: tokenDoc._id,
        eventId: tokenDoc.eventId,
      }).lean();

      if (rsvp) {
        return res.json({
          hasResponded: true,
          rsvp: {
            status: rsvp.status,
            companions: rsvp.companions,
            totalAttendees: rsvp.status === 'going' ? 1 + (rsvp.companions || 0) : 0,
            respondedAt: rsvp.createdAt,
            dietaryPreference: rsvp.dietaryPreference,
            companionDietaryPreference: rsvp.companionDietaryPreference,
          },
        });
      }

      res.json({
        hasResponded: false,
      });
    } catch (error) {
      console.error('Check RSVP status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get dietary preference statistics for an event (admin only)
router.get(
  '/event/:eventId/dietary-stats',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify event exists and belongs to user
      const event = await Event.findOne({
        _id: req.params.eventId,
        createdBy: req.user!._id,
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get all going RSVPs for this event
      const rsvps = await RSVP.find({
        eventId: req.params.eventId,
        status: 'going',
      }).lean();

      const stats = {
        nonveg: 0,
        veg: 0,
        vegan: 0,
        notSpecified: 0,
      };

      rsvps.forEach((rsvp) => {
        // Count user's dietary preference
        if (rsvp.dietaryPreference === 'nonveg') stats.nonveg++;
        else if (rsvp.dietaryPreference === 'veg') stats.veg++;
        else if (rsvp.dietaryPreference === 'vegan') stats.vegan++;
        else stats.notSpecified++;

        // Count companion's dietary preference if they have a companion
        if (rsvp.companions > 0) {
          if (rsvp.companionDietaryPreference === 'nonveg') stats.nonveg++;
          else if (rsvp.companionDietaryPreference === 'veg') stats.veg++;
          else if (rsvp.companionDietaryPreference === 'vegan') stats.vegan++;
          else stats.notSpecified++;
        }
      });

      res.json(stats);
    } catch (error) {
      console.error('Get dietary stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Admin endpoint to clean up orphaned RSVPs (for debugging)
router.delete(
  '/cleanup-orphaned',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      // Delete RSVPs with null userId but with tokenId (orphaned token RSVPs)
      const result = await RSVP.deleteMany({
        userId: null,
      });

      res.json({
        success: true,
        message: `Deleted ${result.deletedCount} orphaned RSVP(s)`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

