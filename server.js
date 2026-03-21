const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
// NOTE: You need to download your Firebase service account key JSON file
// from Firebase Console -> Project Settings -> Service Accounts
// and save it as 'serviceAccountKey.json' in the same directory
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.log('Please add your serviceAccountKey.json file to use Firebase');
}

const db = admin.firestore();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Tap Logger API is running',
    endpoints: {
      saveTaps: 'POST /saveTaps',
      health: 'GET /'
    }
  });
});

// Main endpoint to save tap data
app.post('/saveTaps', async (req, res) => {
  try {
    const { id, var: deviceType, taps } = req.body;
    
    // Validate required fields
    if (!id || !deviceType || !taps) {
      return res.status(400).json({ 
        error: 'Missing required fields: id, var (device type), and taps are required' 
      });
    }

    // Parse taps array
    let tapArray;
    try {
      // The taps come as a string like "[{...},{...}]"
      // Remove the outer brackets if they exist and split by "},{"
      const tapsString = taps.replace(/^\[|\]$/g, '');
      
      if (tapsString.trim() === '') {
        tapArray = [];
      } else {
        // Split by "},{" and then parse each JSON object
        const tapStrings = tapsString.split('},{').map((tap, index, array) => {
          // Add back the braces that were removed during split
          if (index === 0 && array.length > 1) return tap + '}';
          if (index === array.length - 1 && array.length > 1) return '{' + tap;
          if (array.length === 1) return tap;
          return '{' + tap + '}';
        });
        
        tapArray = tapStrings.map(tapStr => JSON.parse(tapStr));
      }
    } catch (parseError) {
      console.error('Error parsing taps:', parseError);
      return res.status(400).json({ 
        error: 'Invalid taps data format',
        details: parseError.message 
      });
    }

    // Create session document
    const sessionRef = db.collection('tap_sessions').doc(id);
    const sessionData = {
      sessionId: id,
      deviceType: deviceType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      totalTaps: tapArray.length,
      interfaceVariations: [...new Set(tapArray.map(t => t.interface))],
      completed: tapArray.length > 0
    };

    // Use batch write for better performance and atomicity
    const batch = db.batch();
    
    // Set session document
    batch.set(sessionRef, sessionData, { merge: true });

    // Add individual tap records
    for (const tap of tapArray) {
      const tapRef = db.collection('tap_logs').doc();
      
      const tapData = {
        sessionId: id,
        deviceType: deviceType,
        tapSequenceNumber: tap.tapSequenceNumber || 0,
        startTimestamp: tap.startTimestamp || 0,
        endTimestamp: tap.endTimestamp || 0,
        duration: (tap.endTimestamp || 0) - (tap.startTimestamp || 0),
        interface: tap.interface || 'unknown',
        interfaceSequence: tap.interfaceSequence || 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      batch.set(tapRef, tapData);
    }

    // Commit the batch
    await batch.commit();

    console.log(`Saved ${tapArray.length} taps for session ${id}`);
    
    res.json({ 
      success: true,
      message: 'Data saved successfully',
      sessionId: id,
      tapsCount: tapArray.length
    });

  } catch (error) {
    console.error('Error saving tap data:', error);
    res.status(500).json({ 
      error: 'Failed to save data',
      details: error.message 
    });
  }
});

// Endpoint to get session statistics
app.get('/stats/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionDoc = await db.collection('tap_sessions').doc(sessionId).get();
    
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const tapsSnapshot = await db.collection('tap_logs')
      .where('sessionId', '==', sessionId)
      .get();

    const taps = [];
    tapsSnapshot.forEach(doc => {
      taps.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      session: { id: sessionDoc.id, ...sessionDoc.data() },
      taps: taps,
      count: taps.length
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/saveTaps`);
});
