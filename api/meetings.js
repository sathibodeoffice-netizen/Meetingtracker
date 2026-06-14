const { MongoClient } = require('mongodb');

// Vercel environment variable
const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!uri) {
  console.warn('Please add your MONGODB_URI environment variable in Vercel.');
} else {
  client = new MongoClient(uri, {});
  clientPromise = client.connect();
}

module.exports = async function handler(req, res) {
  // CORS Headers for safety
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!uri) {
    return res.status(500).json({ error: 'Database connection string not configured.' });
  }

  try {
    const dbClient = await clientPromise;
    const db = dbClient.db('meetingTrackerDB'); 
    const collection = db.collection('meetings'); 

    if (req.method === 'GET') {
      // Fetch all meetings
      const meetings = await collection.find({}).toArray();
      // Remove MongoDB's internal _id before sending to frontend
      const cleanedMeetings = meetings.map(m => {
        const { _id, ...rest } = m;
        return rest;
      });
      return res.status(200).json(cleanedMeetings);
      
    } else if (req.method === 'POST') {
      // The frontend sends the entire array of meetings on save
      const meetingsData = req.body; 
      
      if (!Array.isArray(meetingsData)) {
        return res.status(400).json({ error: 'Expected an array of meetings' });
      }

      // To mirror localStorage behavior exactly, we clear the collection and insert the new state
      await collection.deleteMany({});
      
      if (meetingsData.length > 0) {
        await collection.insertMany(meetingsData);
      }

      return res.status(200).json({ success: true, message: 'Saved successfully' });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
