import express, { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { EmailTemplate } from '../models/EmailTemplate';
import { Event } from '../models/Event';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

const templateSchema = z.object({
  eventId: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  hostName: z.string().min(1, 'Host name is required').max(100),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  eventDetailsBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  fontFamily: z.string().min(1),
  headerText: z.string().max(200),
  sampleEventTitle: z.string().max(200).optional(),
  footerText: z.string().max(500),
  buttonText: z.string().max(100).optional(),
  buttonRadius: z.string().optional(),
  showEmojis: z.boolean().optional(),
  descriptionText: z.string().max(1000).optional(),
  isDefault: z.boolean().optional(),
});

// Get template for event or default
router.get(
  '/',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventId } = req.query;

      let template;

      // Try to get event-specific template
      if (eventId) {
        template = await EmailTemplate.findOne({
          userId: req.user!._id,
          eventId: eventId as string,
        }).lean();
      }

      // Fallback to default template
      if (!template) {
        template = await EmailTemplate.findOne({
          userId: req.user!._id,
          isDefault: true,
        }).lean();
      }

      // If no template exists, return default values
      if (!template) {
        return res.json({
          template: {
            logoUrl: '',
            hostName: '',
            primaryColor: '#4F46E5',
            secondaryColor: '#ffffff',
            textColor: '#374151',
            eventDetailsBackgroundColor: '#f3f4f6',
            fontFamily: 'Arial, sans-serif',
            headerText: "You're Invited!",
            sampleEventTitle: 'Join Us for an Amazing Event',
            footerText: 'We look forward to seeing you!',
            buttonText: 'RSVP Now',
            buttonRadius: '8',
            showEmojis: true,
            descriptionText: 'Join us for an amazing event! This is a preview of how your invitation will look.',
            isDefault: false,
          },
        });
      }

      res.json({
        template: {
          id: template._id.toString(),
          logoUrl: template.logoUrl,
          hostName: template.hostName,
          primaryColor: template.primaryColor,
          secondaryColor: template.secondaryColor,
          textColor: template.textColor,
          eventDetailsBackgroundColor: template.eventDetailsBackgroundColor,
          fontFamily: template.fontFamily,
          headerText: template.headerText,
          sampleEventTitle: template.sampleEventTitle,
          footerText: template.footerText,
          buttonText: template.buttonText,
          buttonRadius: template.buttonRadius,
          showEmojis: template.showEmojis,
          descriptionText: template.descriptionText,
          isDefault: template.isDefault,
          eventId: template.eventId?.toString(),
        },
      });
    } catch (error) {
      console.error('Get template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create or update template
router.post(
  '/',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const validated = templateSchema.parse(req.body);

      // Verify event exists if eventId provided
      if (validated.eventId) {
        const event = await Event.findOne({
          _id: validated.eventId,
          createdBy: req.user!._id,
        });

        if (!event) {
          return res.status(404).json({ error: 'Event not found' });
        }
      }

      // If setting as default, unset other defaults
      if (validated.isDefault) {
        await EmailTemplate.updateMany(
          { userId: req.user!._id, isDefault: true },
          { $set: { isDefault: false } }
        );
      }

      // Find and update or create new
      const filter: any = { userId: req.user!._id };
      if (validated.eventId) {
        filter.eventId = validated.eventId;
      } else if (validated.isDefault) {
        filter.isDefault = true;
      }

      const template = await EmailTemplate.findOneAndUpdate(
        filter,
        {
          userId: req.user!._id,
          eventId: validated.eventId || undefined,
          logoUrl: validated.logoUrl || '',
          hostName: validated.hostName,
          primaryColor: validated.primaryColor,
          secondaryColor: validated.secondaryColor,
          textColor: validated.textColor || '#374151',
          eventDetailsBackgroundColor: validated.eventDetailsBackgroundColor || '#f3f4f6',
          fontFamily: validated.fontFamily,
          headerText: validated.headerText,
          sampleEventTitle: validated.sampleEventTitle || 'Join Us for an Amazing Event',
          footerText: validated.footerText,
          buttonText: validated.buttonText || 'RSVP Now',
          buttonRadius: validated.buttonRadius || '8',
          showEmojis: validated.showEmojis !== undefined ? validated.showEmojis : true,
          descriptionText: validated.descriptionText || 'Join us for an amazing event! This is a preview of how your invitation will look.',
          isDefault: validated.isDefault || false,
        },
        {
          upsert: true,
          new: true,
        }
      ).lean();

      res.json({
        success: true,
        template: {
          id: (template._id as mongoose.Types.ObjectId).toString(),
          logoUrl: template.logoUrl,
          hostName: template.hostName,
          primaryColor: template.primaryColor,
          secondaryColor: template.secondaryColor,
          textColor: template.textColor,
          eventDetailsBackgroundColor: template.eventDetailsBackgroundColor,
          fontFamily: template.fontFamily,
          headerText: template.headerText,
          sampleEventTitle: template.sampleEventTitle,
          footerText: template.footerText,
          buttonText: template.buttonText,
          buttonRadius: template.buttonRadius,
          showEmojis: template.showEmojis,
          descriptionText: template.descriptionText,
          isDefault: template.isDefault,
          eventId: template.eventId?.toString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }
      console.error('Save template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Upload logo endpoint (placeholder - in real app, use cloud storage like S3)
router.post(
  '/upload-logo',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      // In a real implementation, you would:
      // 1. Use multer or similar to handle file upload
      // 2. Upload to S3/Cloudinary/etc
      // 3. Return the URL
      
      // For now, we'll just accept base64 data URL
      const { logoData } = req.body;

      if (!logoData || !logoData.startsWith('data:image')) {
        return res.status(400).json({ error: 'Invalid image data' });
      }

      // In production, upload to cloud storage and return URL
      // For now, we'll just return the data URL (not recommended for production)
      res.json({
        success: true,
        logoUrl: logoData,
      });
    } catch (error) {
      console.error('Upload logo error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

