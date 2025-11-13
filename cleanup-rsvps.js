// Run this script to clean up orphaned RSVPs with null userId
// Usage: node cleanup-rsvps.js

const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planorama-rsvp';

async function cleanup() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const rsvpsCollection = db.collection('rsvps');

    // Find and delete RSVPs with null userId and tokenId
    const result = await rsvpsCollection.deleteMany({
      userId: null,
      tokenId: { $exists: true }
    });

    console.log(`Deleted ${result.deletedCount} orphaned RSVP(s) with null userId`);

    // Drop the problematic index and recreate it
    try {
      await rsvpsCollection.dropIndex('eventId_1_userId_1');
      console.log('Dropped eventId_1_userId_1 index');
    } catch (err) {
      console.log('Index might not exist or already dropped');
    }

    // Recreate the sparse index properly
    await rsvpsCollection.createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, sparse: true }
    );
    console.log('Recreated sparse index on eventId_1_userId_1');

    console.log('✓ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanup();
