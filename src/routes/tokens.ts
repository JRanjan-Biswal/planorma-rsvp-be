import express, { Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import { Token } from '../models/Token';
import { Event } from '../models/Event';
import { RSVP } from '../models/RSVP';
import { EmailTemplate } from '../models/EmailTemplate';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { sendEmail, isEmailServiceConfigured } from '../services/emailService';

const router = express.Router();

const tokenSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  name: z.string().optional(),
});

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Get all tokens for an event with RSVP status (with pagination, search, and filter)
router.get(
  '/:eventId',
  authenticate,
  requireAdmin,
  apiRateLimiter,
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

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || '';
      const statusFilter = req.query.status as string;
      const skip = (page - 1) * limit;

      // Build search query
      const searchQuery: any = { eventId: req.params.eventId };
      if (search) {
        searchQuery.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ];
      }

      // Get all tokens first (we need to filter by status after getting RSVPs)
      let allTokens = await Token.find(searchQuery)
        .sort({ createdAt: -1 })
        .lean();

      // Get RSVP status for each token by matching email
      const emails = allTokens.map((t) => t.email);
      
      // Find users by emails
      const User = require('../models/User').User;
      const users = await User.find({ email: { $in: emails } }).lean();
      const emailToUserIdMap = new Map(
        users.map((u: any) => [u.email, u._id.toString()])
      );

      // Get RSVPs for these users and this event
      const userIds = users.map((u: any) => u._id);
      const rsvps = await RSVP.find({
        eventId: req.params.eventId,
        userId: { $in: userIds },
      }).lean();

      const userIdToRsvpMap = new Map(
        rsvps.map((r) => [r.userId.toString(), { status: r.status, companions: r.companions || 0 }])
      );

      // Also check for token-based RSVPs (guest responses)
      const tokenIds = allTokens.map((t) => t._id);
      const tokenRsvps = await RSVP.find({
        tokenId: { $in: tokenIds },
        eventId: req.params.eventId,
      }).lean();

      const tokenIdToRsvpMap = new Map(
        tokenRsvps.map((r) => [r.tokenId?.toString(), { status: r.status, companions: r.companions || 0 }])
      );

      // Map tokens with their RSVP status
      let tokensWithStatus = allTokens.map((token) => {
        const userId = emailToUserIdMap.get(token.email);
        let rsvpStatus: string | null = null;
        let companions = 0;
        
        // Check token-based RSVP first (guest responses)
        const tokenRsvp = tokenIdToRsvpMap.get(token._id.toString());
        if (tokenRsvp) {
          rsvpStatus = tokenRsvp.status;
          companions = tokenRsvp.companions;
        } else if (userId && typeof userId === 'string') {
          // Fallback to user-based RSVP
          const userRsvp = userIdToRsvpMap.get(userId);
          if (userRsvp) {
            rsvpStatus = userRsvp.status;
            companions = userRsvp.companions;
          }
        }
        
        return {
          id: token._id.toString(),
          email: token.email,
          name: token.name,
          token: token.token,
          createdAt: token.createdAt,
          rsvpStatus,
          companions,
        };
      });

      // Apply status filter
      if (statusFilter) {
        if (statusFilter === 'pending') {
          tokensWithStatus = tokensWithStatus.filter(t => !t.rsvpStatus);
        } else {
          tokensWithStatus = tokensWithStatus.filter(t => t.rsvpStatus === statusFilter);
        }
      }

      // Get total count after filtering
      const totalTokens = tokensWithStatus.length;

      // Apply pagination
      const paginatedTokens = tokensWithStatus.slice(skip, skip + limit);

      res.json({
        tokens: paginatedTokens,
        pagination: {
          page,
          limit,
          total: totalTokens,
          totalPages: Math.ceil(totalTokens / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create token for event and send invitation email
router.post(
  '/:eventId',
  authenticate,
  requireAdmin,
  apiRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const validated = tokenSchema.parse(req.body);

      // Verify event exists and belongs to user
      const event = await Event.findOne({
        _id: req.params.eventId,
        createdBy: req.user!._id,
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const token = generateToken();

      const tokenDoc = await Token.create({
        eventId: req.params.eventId,
        email: validated.email,
        name: validated.name,
        token,
      });

      // Send invitation email if email service is configured
      if (isEmailServiceConfigured()) {
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/event/${req.params.eventId}/${token}`;
        const eventDate = new Date(event.date);

        // Try to get custom template (event-specific or default)
        let template = await EmailTemplate.findOne({
          userId: req.user!._id,
          eventId: req.params.eventId,
        }).lean();

        if (!template) {
          template = await EmailTemplate.findOne({
            userId: req.user!._id,
            isDefault: true,
          }).lean();
        }

        // Use template or defaults
        const primaryColor = template?.primaryColor || '#4F46E5';
        const secondaryColor = template?.secondaryColor || '#ffffff';
        const textColor = template?.textColor || '#374151';
        const eventDetailsBackgroundColor = template?.eventDetailsBackgroundColor || '#f3f4f6';
        const fontFamily = template?.fontFamily || 'Arial, sans-serif';
        const headerText = template?.headerText || "You're Invited!";
        const footerText = template?.footerText || 'We look forward to seeing you!';
        const buttonText = template?.buttonText || 'RSVP Now';
        const buttonRadius = template?.buttonRadius || '8';
        const showEmojis = template?.showEmojis !== undefined ? template?.showEmojis : true;
        const descriptionText = template?.descriptionText || '';
        const hostName = template?.hostName || '';
        const logoUrl = template?.logoUrl || '';

        const htmlContent = `
          <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; padding: 20px; background-color: ${secondaryColor};">
            <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: ${primaryColor}; margin-bottom: 20px; text-align: center;">${headerText}</h1>
              
              <div style="background-color: ${eventDetailsBackgroundColor}; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                <h2 style="color: ${primaryColor}; margin-bottom: 15px; text-align: center;">${event.title}</h2>
                
                <div style="color: ${textColor};">
                  <p style="margin: 8px 0;"><strong>${showEmojis ? '📅 ' : ''}Date:</strong> ${eventDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                  <p style="margin: 8px 0;"><strong>${showEmojis ? '📍 ' : ''}Location:</strong> ${event.location}</p>
                  <p style="margin: 8px 0;"><strong>${showEmojis ? '📊 ' : ''}Capacity:</strong> ${event.capacity} people</p>
                  ${event.category ? `<p style="margin: 8px 0;"><strong>${showEmojis ? '🏷️ ' : ''}Category:</strong> ${event.category}</p>` : ''}
                </div>
                
                ${descriptionText ? `<p style="color: ${textColor}; margin-top: 15px; margin-bottom: 0;">${descriptionText}</p>` : ''}
                ${event.description ? `<p style="color: ${textColor}; margin-top: 15px; margin-bottom: 0;">${event.description}</p>` : ''}
                
                <div style="text-align: center; margin-top: 20px;">
                  <a href="${inviteLink}" 
                     style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: ${buttonRadius}px; font-weight: bold;">
                    ${buttonText}
                  </a>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: ${textColor}; font-size: 14px; margin-bottom: 8px;">${footerText}</p>
                ${hostName ? `<p style="color: ${textColor}; font-weight: 600; font-size: 14px;">— ${hostName}</p>` : ''}
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                This invitation link is unique to you. Please do not share it with others.
              </p>
            </div>
          </div>
        `;

        const textContent = `
You're Invited to ${event.title}!

Date: ${eventDate.toLocaleString()}
Location: ${event.location}
Capacity: ${event.capacity} people
${event.category ? `Category: ${event.category}` : ''}

${event.description || ''}

Click here to RSVP: ${inviteLink}

This invitation link is unique to you. Please do not share it with others.
        `;

        try {
          await sendEmail({
            to: validated.email,
            subject: `You're invited to ${event.title}`,
            html: htmlContent,
            text: textContent,
          });
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError);
          // Continue even if email fails - token is still created
        }
      }

      res.status(201).json({
        token: {
          id: (tokenDoc._id as mongoose.Types.ObjectId).toString(),
          email: tokenDoc.email,
          name: tokenDoc.name,
          token: tokenDoc.token,
          rsvpStatus: null,
        },
        emailSent: isEmailServiceConfigured(),
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

// Get event by token (public endpoint)
router.get(
  '/token/:token',
  async (req: express.Request, res: Response) => {
    try {
      const tokenDoc = await Token.findOne({ token: req.params.token })
        .populate('eventId')
        .lean();

      if (!tokenDoc) {
        return res.status(404).json({ error: 'Token not found' });
      }

      const event = tokenDoc.eventId as any;

      res.json({
        event: {
          id: event._id.toString(),
          title: event.title,
          description: event.description || '',
          date: event.date.toISOString(),
          location: event.location,
          category: event.category,
          capacity: event.capacity,
          hostName: event.hostName,
          hostMobile: event.hostMobile,
          hostEmail: event.hostEmail,
        },
        token: {
          email: tokenDoc.email,
          name: tokenDoc.name,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

