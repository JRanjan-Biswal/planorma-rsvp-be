import nodemailer, { Transporter } from 'nodemailer';

// Create reusable transporter object using the default SMTP transport
export const createTransporter = (): Transporter => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
    },
  });
};

// Check if Gmail credentials are configured
export const isEmailServiceConfigured = (): boolean => {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

// Send email function
export const sendEmail = async (options: SendEmailOptions): Promise<{ messageId: string }> => {
  if (!isEmailServiceConfigured()) {
    throw new Error('Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
  }

  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  };

  const info = await transporter.sendMail(mailOptions);
  
  console.log('Email sent successfully:', info.messageId);
  
  return { messageId: info.messageId };
};

// Verify SMTP connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  if (!isEmailServiceConfigured()) {
    return false;
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email connection verification failed:', error);
    return false;
  }
};

