const { MongoClient } = require('mongodb');

// Vercel environment variable
const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!uri) {
  console.warn('Please add your MONGODB_URI environment variable in Vercel.');
} else {
  try {
    client = new MongoClient(uri, {});
    clientPromise = client.connect();
  } catch (error) {
    console.error('Invalid MONGODB_URI:', error);
    clientPromise = Promise.reject(error);
  }
}

module.exports = async function handler(req, res) {
  // CORS Headers for safety
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    return res.status(500).json({ error: 'ডাটাবেজ কানেকশন স্ট্রিংটি সঠিক নয়। অনুগ্রহ করে সঠিক MONGODB_URI ব্যবহার করুন।' });
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
        return res.status(400).json({ error: 'মিটিং সমূহের একটি অ্যারে প্রত্যাশিত' });
      }

      const existing = await collection.find({}).toArray();

      // Refuse to wipe a non-empty collection unless the client explicitly says so
      // (e.g. the user deleted the very last meeting). Protects against a page that
      // failed to load and is about to save an empty list over real data.
      if (meetingsData.length === 0 && existing.length > 0 && req.query.allowEmpty !== '1') {
        return res.status(409).json({ error: 'খালি তালিকা দিয়ে বিদ্যমান তথ্য মুছে ফেলা হয়নি।' });
      }

      // Keep a snapshot of the previous state before overwriting (last 30 kept)
      if (existing.length > 0) {
        const snapshots = db.collection('meetings_snapshots');
        await snapshots.insertOne({
          savedAt: new Date(),
          meetings: existing.map(({ _id, ...rest }) => rest)
        });
        const old = await snapshots.find({}, { projection: { _id: 1 } })
          .sort({ savedAt: -1 }).skip(30).toArray();
        if (old.length) await snapshots.deleteMany({ _id: { $in: old.map(o => o._id) } });
      }

      // Replace the collection with the new state
      await collection.deleteMany({});
      if (meetingsData.length > 0) {
        await collection.insertMany(meetingsData.map(({ _id, ...rest }) => rest));
      }

      return res.status(200).json({ success: true, message: 'Saved successfully' });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: 'অভ্যন্তরীণ সার্ভার ত্রুটি', details: error.message || error.toString() });
  }
}
