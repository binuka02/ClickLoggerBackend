// api/index.js
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin
let db;
try {
  console.log("Initializing Firebase...");
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccountJson = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT,
      "base64",
    ).toString("utf-8");
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    db = admin.firestore();
    console.log("Firebase initialized successfully");
  } else {
    console.error("FIREBASE_SERVICE_ACCOUNT environment variable not set!");
  }
} catch (err) {
  console.error("Firebase initialization error:", err);
}

// ------------------ Routes ------------------

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "Tap Logger API is running",
    endpoints: {
      saveTaps: "POST /saveTaps",
      stats: "GET /stats/:sessionId",
    },
  });
});

// Save taps
app.post("/saveTaps", async (req, res) => {
  try {
    if (!db)
      return res.status(500).json({ error: "Firestore not initialized" });

    const { id, var: deviceType, taps } = req.body;
    if (!id || !deviceType || !taps) {
      return res
        .status(400)
        .json({ error: "Missing required fields: id, var, taps" });
    }

    // Parse taps array
    let tapArray = [];
    try {
      const tapsString = taps.replace(/^\[|\]$/g, "");
      if (tapsString.trim() !== "") {
        const tapStrings = tapsString.split("},{").map((tap, index, array) => {
          if (index === 0 && array.length > 1) return tap + "}";
          if (index === array.length - 1 && array.length > 1) return "{" + tap;
          if (array.length === 1) return tap;
          return "{" + tap + "}";
        });
        tapArray = tapStrings.map(JSON.parse);
      }
    } catch (parseError) {
      return res
        .status(400)
        .json({ error: "Invalid taps format", details: parseError.message });
    }

    const batch = db.batch();
    const sessionRef = db.collection("tap_sessions").doc(id);
    batch.set(
      sessionRef,
      {
        sessionId: id,
        deviceType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalTaps: tapArray.length,
        interfaceVariations: [...new Set(tapArray.map((t) => t.interface))],
        completed: tapArray.length > 0,
      },
      { merge: true },
    );

    for (const tap of tapArray) {
      const tapRef = db.collection("tap_logs").doc();
      const tapId = `${id}_${tap.tapSequenceNumber || 0}_${tap.startTimestamp || Date.now()}`;
      batch.set(tapRef, {
        tapId,
        sessionId: id,
        deviceType,
        tapSequenceNumber: tap.tapSequenceNumber || 0,
        startDateTime: tap.startTimestamp
          ? new Date(tap.startTimestamp).toISOString()
          : null,
        endDateTime: tap.endTimestamp
          ? new Date(tap.endTimestamp).toISOString()
          : null,
        duration: (tap.endTimestamp || 0) - (tap.startTimestamp || 0),
        interface: tap.interface || "unknown",
        interfaceSequence: tap.interfaceSequence || 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`Saved ${tapArray.length} taps for session ${id}`);

    res.json({
      success: true,
      message: "Data saved successfully",
      sessionId: id,
      tapsCount: tapArray.length,
    });
  } catch (error) {
    console.error("Error in /saveTaps:", error);
    res
      .status(500)
      .json({ error: "Failed to save data", details: error.message });
  }
});

// Stats endpoint
app.get("/stats/:sessionId", async (req, res) => {
  try {
    if (!db)
      return res.status(500).json({ error: "Firestore not initialized" });

    const { sessionId } = req.params;
    const sessionDoc = await db.collection("tap_sessions").doc(sessionId).get();
    if (!sessionDoc.exists)
      return res.status(404).json({ error: "Session not found" });

    const tapsSnapshot = await db
      .collection("tap_logs")
      .where("sessionId", "==", sessionId)
      .get();
    const taps = tapsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      session: { id: sessionDoc.id, ...sessionDoc.data() },
      taps,
      count: taps.length,
    });
  } catch (error) {
    console.error("Error in /stats:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch stats", details: error.message });
  }
});

// Wrap Express for Vercel v2
module.exports = (req, res) => app(req, res);
