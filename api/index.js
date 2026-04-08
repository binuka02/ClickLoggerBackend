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

// Initialize Firebase Admin SDK
let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("Using Firebase credentials from environment variable");
    try {
      const serviceAccountJson = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT,
        "base64",
      ).toString("utf-8");
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", err);
      throw new Error(
        "Invalid FIREBASE_SERVICE_ACCOUNT value. Must be base64 of serviceAccount JSON.",
      );
    }
  } else {
    console.log(
      "FIREBASE_SERVICE_ACCOUNT not set, using local serviceAccountKey.json (local dev only)",
    );
    serviceAccount = require("../serviceAccountKey.json");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
  // Do NOT throw here; allow the serverless function to start and show error on first request
}

const db = admin.firestore();

// ------------------ Routes ------------------

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "Tap Logger API is running",
    endpoints: {
      saveTaps: "POST /saveTaps",
      stats: "GET /stats/:sessionId",
      health: "GET /",
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
      return res.status(400).json({
        error:
          "Missing required fields: id, var (device type), and taps are required",
      });
    }

    // Parse taps array safely
    let tapArray;
    try {
      const tapsString = taps.replace(/^\[|\]$/g, "");
      if (!tapsString.trim()) tapArray = [];
      else {
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

    // Prepare batch
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

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }

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

// Export for Vercel
module.exports = app;
