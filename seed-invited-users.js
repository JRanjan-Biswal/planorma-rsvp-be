// Script to seed 20 sample invited users
// Usage: node seed-invited-users.js <eventId>

const mongoose = require('mongoose');
require('dotenv').config();
const crypto = require('crypto');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planorama-rsvp';

// Sample data
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary', 'William', 'Patricia', 'Richard', 'Jennifer', 'Thomas', 'Linda', 'Charles', 'Elizabeth', 'Daniel', 'Susan'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const dietaryPreferences = ['nonveg', 'veg', 'vegan', null, null]; // null for some to simulate not specified
const rsvpStatuses = ['going', 'not-going', null]; // null for pending

async function seedInvitedUsers(eventId) {
  try {
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB');

    const db = mongoose.connection.db;
    const tokensCollection = db.collection('tokens');
    const rsvpsCollection = db.collection('rsvps');
    const eventsCollection = db.collection('events');

    // Verify event exists
    const event = await eventsCollection.findOne({ _id: new mongoose.Types.ObjectId(eventId) });
    if (!event) {
      console.error('❌ Event not found with ID:', eventId);
      process.exit(1);
    }
    console.log('✓ Found event:', event.title);

    // Generate 20 sample users
    const tokens = [];
    const rsvps = [];

    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 0 ? i : ''}@example.com`;
      const token = crypto.randomBytes(32).toString('hex');

      const tokenDoc = {
        _id: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(eventId),
        email: email,
        name: name,
        token: token,
        createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random date within last 2 weeks
        updatedAt: new Date(),
      };

      tokens.push(tokenDoc);

      // 60% chance of having an RSVP
      if (Math.random() < 0.6) {
        const status = rsvpStatuses[Math.floor(Math.random() * (rsvpStatuses.length - 1))]; // Exclude null from rsvpStatuses
        if (status) {
          const hasCompanion = status === 'going' ? Math.random() < 0.3 : false; // 30% chance of companion if going
          const companions = hasCompanion ? 1 : 0;
          
          const dietary = dietaryPreferences[Math.floor(Math.random() * dietaryPreferences.length)];
          const companionDietary = hasCompanion ? dietaryPreferences[Math.floor(Math.random() * dietaryPreferences.length)] : null;

          const rsvpDoc = {
            _id: new mongoose.Types.ObjectId(),
            eventId: new mongoose.Types.ObjectId(eventId),
            tokenId: tokenDoc._id,
            status: status,
            companions: companions,
            guestName: name,
            guestEmail: email,
            createdAt: new Date(tokenDoc.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Within a week after invite
            updatedAt: new Date(),
          };

          // Only add dietary preferences if they exist
          if (dietary) {
            rsvpDoc.dietaryPreference = dietary;
          }
          if (companionDietary) {
            rsvpDoc.companionDietaryPreference = companionDietary;
          }

          rsvps.push(rsvpDoc);
        }
      }
    }

    // Insert tokens
    const tokenResult = await tokensCollection.insertMany(tokens);
    console.log(`✓ Inserted ${tokenResult.insertedCount} invitation tokens`);

    // Insert RSVPs
    if (rsvps.length > 0) {
      const rsvpResult = await rsvpsCollection.insertMany(rsvps);
      console.log(`✓ Inserted ${rsvpResult.insertedCount} RSVPs`);
      
      const goingCount = rsvps.filter(r => r.status === 'going').length;
      const notGoingCount = rsvps.filter(r => r.status === 'not-going').length;
      const pendingCount = tokens.length - rsvps.length;
      
      console.log('\n📊 RSVP Statistics:');
      console.log(`   Going: ${goingCount}`);
      console.log(`   Not Going: ${notGoingCount}`);
      console.log(`   Pending: ${pendingCount}`);
      
      const nonvegCount = rsvps.filter(r => r.dietaryPreference === 'nonveg').length + rsvps.filter(r => r.companionDietaryPreference === 'nonveg').length;
      const vegCount = rsvps.filter(r => r.dietaryPreference === 'veg').length + rsvps.filter(r => r.companionDietaryPreference === 'veg').length;
      const veganCount = rsvps.filter(r => r.dietaryPreference === 'vegan').length + rsvps.filter(r => r.companionDietaryPreference === 'vegan').length;
      
      console.log('\n🍽️  Dietary Preferences:');
      console.log(`   Non-Vegetarian: ${nonvegCount}`);
      console.log(`   Vegetarian: ${vegCount}`);
      console.log(`   Vegan: ${veganCount}`);
    }

    console.log('\n✅ Successfully seeded 20 invited users!');
    console.log(`\nYou can view them at: http://localhost:3000/event/${eventId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

// Get eventId from command line
const eventId = process.argv[2];

if (!eventId) {
  console.error('❌ Please provide an eventId as argument');
  console.log('Usage: node seed-invited-users.js <eventId>');
  console.log('\nTo find your eventId:');
  console.log('1. Go to http://localhost:3000');
  console.log('2. Click on an event');
  console.log('3. Copy the ID from the URL: /event/YOUR_EVENT_ID');
  process.exit(1);
}

// Validate eventId format
if (!mongoose.Types.ObjectId.isValid(eventId)) {
  console.error('❌ Invalid eventId format');
  process.exit(1);
}

seedInvitedUsers(eventId);

