const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Firebase Admin SDK Initialization
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccountJson = Buffer.from(
      serviceAccountBase64,
      "base64",
    ).toString("utf-8");
    serviceAccount = JSON.parse(serviceAccountJson);
  } else {
    serviceAccount = require("../firebase.json");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  console.log("Firebase Admin initialized");
} catch (error) {
  console.error("Firebase initialization error:", error.message);
}

const db = admin.firestore();

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "Tap Logger API running",
    endpoints: {
      saveTaps: "POST /saveTaps",
      stats: "GET /stats/:sessionId",
    },
  });
});

// Save tap session data
app.post("/saveTaps", async (req, res) => {
  try {
    const { id, var: deviceType, taps } = req.body;
    if (!id || !deviceType || !taps) {
      return res
        .status(400)
        .json({ error: "id, var (deviceType), and taps are required" });
    }

    // Parse taps array
    let tapArray;
    try {
      const tapsString = taps.replace(/^\[|\]$/g, "");
      if (tapsString.trim() === "") {
        tapArray = [];
      } else {
        const tapStrings = tapsString.split("},{").map((tap, idx, arr) => {
          if (idx === 0 && arr.length > 1) return tap + "}";
          if (idx === arr.length - 1 && arr.length > 1) return "{" + tap;
          if (arr.length === 1) return tap;
          return "{" + tap + "}";
        });
        tapArray = tapStrings.map((t) => JSON.parse(t));
      }
    } catch (parseError) {
      return res
        .status(400)
        .json({ error: "Invalid taps data", details: parseError.message });
    }

    const sessionRef = db.collection("tap_sessions").doc(id);
    const sessionData = {
      sessionId: id,
      deviceType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      totalTaps: tapArray.length,
      interfaceVariations: [...new Set(tapArray.map((t) => t.interface))],
      completed: tapArray.length > 0,
    };

    const batch = db.batch();
    batch.set(sessionRef, sessionData, { merge: true });

    for (const tap of tapArray) {
      const tapRef = db.collection("tap_logs").doc();
      const tapId = `${id}_${tap.tapSequenceNumber || 0}_${tap.startTimestamp || Date.now()}`;
      const tapData = {
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
      };
      batch.set(tapRef, tapData);
    }

    await batch.commit();
    res.json({ success: true, sessionId: id, tapsCount: tapArray.length });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to save taps", details: error.message });
  }
});

// Get session stats
app.get("/stats/:sessionId", async (req, res) => {
  try {
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
    res
      .status(500)
      .json({ error: "Failed to fetch stats", details: error.message });
  }
});

// Vercel serverless export
module.exports = app;
module.exports.config = { api: { bodyParser: false } };
