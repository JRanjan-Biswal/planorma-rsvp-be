import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmail, verifyEmailConnection, isEmailServiceConfigured } from '../services/emailService';
import { z } from 'zod';

const router = express.Router();

// Validation schema for email request
const sendEmailSchema = z.object({
  to: z.string().email('Invalid email format'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  replyTo: z.string().email('Invalid reply-to email format').optional(),
});

/**
 * POST /api/email/send
 * Send an email (authenticated users only)
 */
router.post('/send', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validationResult = sendEmailSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
      return;
    }

    const { to, subject, message, replyTo } = validationResult.data;

    // Check if email service is configured
    if (!isEmailServiceConfigured()) {
      res.status(500).json({
        success: false,
        error: 'Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.',
      });
      return;
    }

    // Get authenticated user info
    const userEmail = req.user?.email || '';
    const userName = userEmail ? userEmail.split('@')[0] : 'User';

    // Create HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
          ${subject}
        </h2>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <p style="margin: 10px 0;"><strong>From:</strong> ${userName} (${userEmail})</p>
          ${replyTo ? `<p style="margin: 10px 0;"><strong>Reply To:</strong> ${replyTo}</p>` : ''}
          <p style="margin: 10px 0;"><strong>Message:</strong></p>
          <p style="margin: 10px 0; padding: 10px; background-color: white; border-left: 3px solid #4F46E5; border-radius: 4px;">
            ${message.replace(/\n/g, '<br>')}
          </p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This email was sent from the Planorama RSVP application.</p>
          <p>Sent at: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    // Create plain text version
    const textContent = `
${subject}

From: ${userName} (${userEmail})
${replyTo ? `Reply To: ${replyTo}` : ''}

Message:
${message}

---
This email was sent from the Planorama RSVP application.
Sent at: ${new Date().toLocaleString()}
    `;

    // Send email
    const result = await sendEmail({
      to,
      subject,
      html: htmlContent,
      text: textContent,
      replyTo: replyTo || userEmail,
    });

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    
    // Provide more detailed error messages
    let errorMessage = 'Failed to send email';
    let errorDetails = error.message;
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check your Gmail credentials in the .env file.';
      errorDetails = 'Invalid Gmail username or App Password';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Cannot connect to Gmail SMTP server. Please check your internet connection.';
      errorDetails = error.message;
    } else if (error.response) {
      errorMessage = `Gmail error: ${error.response}`;
      errorDetails = error.message;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      errorCode: error.code,
    });
  }
});

/**
 * GET /api/email/verify
 * Verify email service configuration (authenticated users only)
 */
router.get('/verify', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!isEmailServiceConfigured()) {
      res.status(500).json({
        success: false,
        configured: false,
        message: 'Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.',
      });
      return;
    }

    const isConnected = await verifyEmailConnection();

    if (isConnected) {
      res.status(200).json({
        success: true,
        configured: true,
        message: 'Email service is properly configured and connected',
      });
    } else {
      res.status(500).json({
        success: false,
        configured: true,
        message: 'Email service is configured but connection failed. Please check your credentials.',
      });
    }
  } catch (error: any) {
    console.error('Error verifying email connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email connection',
      details: error.message,
    });
  }
});

/**
 * GET /api/email/status
 * Check email service status (authenticated users only)
 */
router.get('/status', authenticate, (req: AuthRequest, res: Response) => {
  const configured = isEmailServiceConfigured();
  
  res.status(200).json({
    success: true,
    configured,
    gmailUser: configured ? process.env.GMAIL_USER : null,
    message: configured 
      ? 'Email service is configured' 
      : 'Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.',
  });
});

export default router;

