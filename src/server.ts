// This file is for local development
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import app from './index';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database and start server
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

