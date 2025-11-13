// Fix RSVP indexes to support multiple token-based RSVPs
const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planorama-rsvp';

async function fixIndexes() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB');

    const db = mongoose.connection.db;
    const rsvpsCollection = db.collection('rsvps');

    // Drop all existing indexes except _id
    const indexes = await rsvpsCollection.indexes();
    console.log('\nExisting indexes:', indexes.map(i => i.name));

    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await rsvpsCollection.dropIndex(index.name);
          console.log(`✓ Dropped index: ${index.name}`);
        } catch (err) {
          console.log(`  Index ${index.name} already dropped or doesn't exist`);
        }
      }
    }

    // Create new proper indexes
    // 1. Unique index for user-based RSVPs (where userId exists)
    await rsvpsCollection.createIndex(
      { eventId: 1, userId: 1 },
      { 
        unique: true,
        partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } }
      }
    );
    console.log('✓ Created index: eventId_1_userId_1 (for user RSVPs)');

    // 2. Unique index for token-based RSVPs (where tokenId exists)
    await rsvpsCollection.createIndex(
      { eventId: 1, tokenId: 1 },
      { 
        unique: true,
        partialFilterExpression: { tokenId: { $exists: true, $type: 'objectId' } }
      }
    );
    console.log('✓ Created index: eventId_1_tokenId_1 (for token RSVPs)');

    // 3. Regular index for querying by eventId and status
    await rsvpsCollection.createIndex({ eventId: 1, status: 1 });
    console.log('✓ Created index: eventId_1_status_1');

    console.log('\n✅ Indexes fixed successfully!');
    console.log('\nNow you can run: node seed-invited-users.js YOUR_EVENT_ID');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes();

