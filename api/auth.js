const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
  console.warn('Invalid or missing MONGODB_URI environment variable.');
} else {
  try {
    client = new MongoClient(uri, {});
    clientPromise = client.connect();
  } catch (err) {
    console.error('MongoDB initialization error:', err);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  if (!clientPromise) {
    return res.status(500).json({ error: 'সার্ভারে ডাটাবেজ কানেকশন কনফিগার করা নেই।' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const clientInstance = await clientPromise;
    const db = clientInstance.db('meetingtracker');
    const usersCollection = db.collection('users');

    const { action, name, designation, email, role, password } = req.body;

    if (action === 'signup') {
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'প্রয়োজনীয় তথ্য দেওয়া হয়নি' });
      }

      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'এই ইমেইল দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।' });
      }

      // Create new user
      const hashedPassword = hashPassword(password);
      const newUser = {
        name,
        designation,
        email,
        role, // 'admin' or 'agent'
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      await usersCollection.insertOne(newUser);
      return res.status(201).json({ success: true, message: 'User created successfully' });
    } 
    
    else if (action === 'create_agent') {
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'প্রয়োজনীয় তথ্য দেওয়া হয়নি' });
      }
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'এই ইমেইল দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।' });
      }
      const hashedPassword = hashPassword(password);
      const newUser = { name, designation, email, role: 'agent', password: hashedPassword, createdAt: new Date().toISOString() };
      await usersCollection.insertOne(newUser);
      return res.status(201).json({ success: true, message: 'Agent created successfully' });
    }
    else if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড আবশ্যক' });
      }

      // Hardcoded Super Admin
      if (email === 'sathibodeoffice@gmail.com' && password === '808276') {
        const token = crypto.randomBytes(32).toString('hex');
        return res.status(200).json({
          success: true,
          token,
          user: { name: 'Super Admin', email: 'sathibodeoffice@gmail.com', role: 'admin', designation: 'Admin' }
        });
      }

      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড' });
      }

      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড' });
      }

      // Generate a simple token (in production, use JWT)
      const token = crypto.randomBytes(32).toString('hex');

      return res.status(200).json({
        success: true,
        token,
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          designation: user.designation
        }
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Auth API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
