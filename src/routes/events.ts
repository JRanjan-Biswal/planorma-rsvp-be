import express, { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Event, IEvent } from '../models/Event';
import { RSVP } from '../models/RSVP';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  date: z.string().datetime('Invalid date format'),
  location: z.string().min(1, 'Location is required').max(200, 'Location too long'),
  category: z.string().min(1, 'Category is required'),
  capacity: z.number().int().min(10, 'Capacity must be at least 10'),
  allowedCompanions: z.number().int().min(0, 'Allowed companions cannot be negative').max(10, 'Allowed companions cannot exceed 10').default(0),
  hostName: z.string().min(1, 'Host name is required').max(100, 'Host name too long'),
  hostMobile: z.string().min(1, 'Host mobile number is required').max(20, 'Host mobile number too long'),
  hostEmail: z.string().email('Invalid email format').max(100, 'Host email too long'),
});

// Get all events (admin only - events created by them)
router.get(
  '/',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const events = await Event.find({ createdBy: req.user!._id })
        .sort({ createdAt: -1 })
        .lean();

      // Get RSVP counts for all events (including companions)
      const eventIds = events.map((e) => e._id);
      const rsvpCounts = await RSVP.aggregate([
        {
          $match: {
            eventId: { $in: eventIds },
            status: 'going',
          },
        },
        {
          $group: {
            _id: '$eventId',
            // Count each person + their companions (1 + companions field)
            count: { $sum: { $add: [1, { $ifNull: ['$companions', 0] }] } },
          },
        },
      ]);

      const rsvpCountMap = new Map(
        rsvpCounts.map((r) => [r._id.toString(), r.count])
      );

      const eventsWithCounts = events.map((event) => ({
        id: event._id.toString(),
        title: event.title,
        description: event.description || '',
        date: event.date.toISOString(),
        location: event.location,
        category: event.category,
        capacity: event.capacity,
        allowedCompanions: event.allowedCompanions || 0,
        hostName: event.hostName,
        hostMobile: event.hostMobile,
        hostEmail: event.hostEmail,
        rsvpCount: rsvpCountMap.get(event._id.toString()) || 0,
      }));

      res.json({ events: eventsWithCounts });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get single event (public endpoint - no auth required)
router.get(
  '/public/:id',
  apiRateLimiter,
  async (req: express.Request, res: Response) => {
    try {
      const event = await Event.findById(req.params.id).lean();

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description || '',
          date: event.date.toISOString(),
          location: event.location,
          category: event.category,
          capacity: event.capacity,
          allowedCompanions: event.allowedCompanions || 0,
          hostName: event.hostName,
          hostEmail: event.hostEmail,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get single event (admin only - with auth)
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const event = await Event.findOne({
        _id: req.params.id,
        createdBy: req.user!._id,
      }).lean();

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description || '',
          date: event.date.toISOString(),
          location: event.location,
          category: event.category,
          capacity: event.capacity,
          allowedCompanions: event.allowedCompanions || 0,
          hostName: event.hostName,
          hostMobile: event.hostMobile,
          hostEmail: event.hostEmail,
          createdBy: event.createdBy.toString(),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create event
router.post(
  '/',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const validated = eventSchema.parse(req.body);

      // Validate that the event date is not in the past
      const eventDate = new Date(validated.date);
      const now = new Date();
      if (eventDate < now) {
        return res.status(400).json({ 
          error: 'Cannot create an event for a past date. Please select a future date and time.' 
        });
      }

      const event: IEvent = await Event.create({
        ...validated,
        description: validated.description || '',
        date: eventDate,
        createdBy: req.user!._id,
      });

      res.status(201).json({
        event: {
          id: (event._id as mongoose.Types.ObjectId).toString(),
          title: event.title,
          description: event.description || '',
          date: event.date.toISOString(),
          location: event.location,
          category: event.category,
          capacity: event.capacity,
          allowedCompanions: event.allowedCompanions || 0,
          hostName: event.hostName,
          hostMobile: event.hostMobile,
          hostEmail: event.hostEmail,
          createdBy: event.createdBy.toString(),
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

// Update event
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const validated = eventSchema.parse(req.body);

      // Validate that the event date is not in the past
      const eventDate = new Date(validated.date);
      const now = new Date();
      if (eventDate < now) {
        return res.status(400).json({ 
          error: 'Cannot update event to a past date. Please select a future date and time.' 
        });
      }

      const event = await Event.findOneAndUpdate(
        {
          _id: req.params.id,
          createdBy: req.user!._id,
        },
        {
          ...validated,
          description: validated.description || '',
          date: eventDate,
        },
        {
          new: true,
        }
      ).lean();

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description || '',
          date: event.date.toISOString(),
          location: event.location,
          category: event.category,
          capacity: event.capacity,
          allowedCompanions: event.allowedCompanions || 0,
          hostName: event.hostName,
          hostMobile: event.hostMobile,
          hostEmail: event.hostEmail,
          createdBy: event.createdBy.toString(),
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

export default router;

