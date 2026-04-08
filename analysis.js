const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require("./firebase.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("Firebase Admin initialized successfully\n");
} catch (error) {
  console.error("Error initializing Firebase Admin:", error.message);
  console.log("Please add your firebase.json file to run analysis");
  process.exit(1);
}

const db = admin.firestore();

// Helper function to calculate standard deviation
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// Query 1: Mean Tap Duration for Android vs PC Users
async function compareDevicePerformance() {
  console.log("=== QUERY 1: Android vs PC Tap Duration Analysis ===\n");

  const androidSnapshot = await db
    .collection("tap_logs")
    .where("deviceType", "==", "android")
    .get();

  const pcSnapshot = await db
    .collection("tap_logs")
    .where("deviceType", "==", "pc")
    .get();

  let androidDurations = [];
  androidSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.duration > 0) {
      androidDurations.push(data.duration);
    }
  });

  let pcDurations = [];
  pcSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.duration > 0) {
      pcDurations.push(data.duration);
    }
  });

  const androidMean =
    androidDurations.length > 0
      ? androidDurations.reduce((sum, d) => sum + d, 0) /
        androidDurations.length
      : 0;

  const pcMean =
    pcDurations.length > 0
      ? pcDurations.reduce((sum, d) => sum + d, 0) / pcDurations.length
      : 0;

  console.log(` Android Users:`);
  console.log(`   Total taps: ${androidDurations.length}`);
  console.log(`   Mean duration: ${androidMean.toFixed(2)} ms`);
  console.log(
    `   Std deviation: ${calculateStdDev(androidDurations).toFixed(2)} ms`,
  );
  console.log(
    `   Min: ${androidDurations.length > 0 ? Math.min(...androidDurations).toFixed(2) : 0} ms`,
  );
  console.log(
    `   Max: ${androidDurations.length > 0 ? Math.max(...androidDurations).toFixed(2) : 0} ms`,
  );

  console.log(`\n  PC Users:`);
  console.log(`   Total taps: ${pcDurations.length}`);
  console.log(`   Mean duration: ${pcMean.toFixed(2)} ms`);
  console.log(
    `   Std deviation: ${calculateStdDev(pcDurations).toFixed(2)} ms`,
  );
  console.log(
    `   Min: ${pcDurations.length > 0 ? Math.min(...pcDurations).toFixed(2) : 0} ms`,
  );
  console.log(
    `   Max: ${pcDurations.length > 0 ? Math.max(...pcDurations).toFixed(2) : 0} ms`,
  );

  if (androidDurations.length > 0 && pcDurations.length > 0) {
    const difference = Math.abs(androidMean - pcMean);
    const percentDiff = Math.abs(((pcMean - androidMean) / androidMean) * 100);
    console.log(`\n Analysis:`);
    console.log(`   Absolute difference: ${difference.toFixed(2)} ms`);
    console.log(
      `   PC is ${pcMean > androidMean ? "slower" : "faster"} by ${percentDiff.toFixed(1)}%`,
    );
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

// Query 2: Compare Feedback vs No-Feedback Interface
async function compareInterfaceTypes() {
  console.log("=== QUERY 2: Feedback vs No-Feedback Interface Analysis ===\n");

  const feedbackSnapshot = await db
    .collection("tap_logs")
    .where("interface", "==", "feedbackshown")
    .get();

  const noFeedbackSnapshot = await db
    .collection("tap_logs")
    .where("interface", "==", "nofeedback")
    .get();

  let feedbackDurations = [];
  feedbackSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.duration > 0) {
      feedbackDurations.push(data.duration);
    }
  });

  let noFeedbackDurations = [];
  noFeedbackSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.duration > 0) {
      noFeedbackDurations.push(data.duration);
    }
  });

  const feedbackMean =
    feedbackDurations.length > 0
      ? feedbackDurations.reduce((sum, d) => sum + d, 0) /
        feedbackDurations.length
      : 0;

  const noFeedbackMean =
    noFeedbackDurations.length > 0
      ? noFeedbackDurations.reduce((sum, d) => sum + d, 0) /
        noFeedbackDurations.length
      : 0;

  console.log(` Feedback Shown Interface:`);
  console.log(`   Total taps: ${feedbackDurations.length}`);
  console.log(`   Mean duration: ${feedbackMean.toFixed(2)} ms`);
  console.log(
    `   Std deviation: ${calculateStdDev(feedbackDurations).toFixed(2)} ms`,
  );
  console.log(
    `   Min: ${feedbackDurations.length > 0 ? Math.min(...feedbackDurations).toFixed(2) : 0} ms`,
  );
  console.log(
    `   Max: ${feedbackDurations.length > 0 ? Math.max(...feedbackDurations).toFixed(2) : 0} ms`,
  );

  console.log(`\n No Feedback Interface:`);
  console.log(`   Total taps: ${noFeedbackDurations.length}`);
  console.log(`   Mean duration: ${noFeedbackMean.toFixed(2)} ms`);
  console.log(
    `   Std deviation: ${calculateStdDev(noFeedbackDurations).toFixed(2)} ms`,
  );
  console.log(
    `   Min: ${noFeedbackDurations.length > 0 ? Math.min(...noFeedbackDurations).toFixed(2) : 0} ms`,
  );
  console.log(
    `   Max: ${noFeedbackDurations.length > 0 ? Math.max(...noFeedbackDurations).toFixed(2) : 0} ms`,
  );

  if (feedbackDurations.length > 0 && noFeedbackDurations.length > 0) {
    const difference = Math.abs(feedbackMean - noFeedbackMean);
    const percentDiff = Math.abs(
      ((feedbackMean - noFeedbackMean) / noFeedbackMean) * 100,
    );
    console.log(`\n Analysis:`);
    console.log(`   Absolute difference: ${difference.toFixed(2)} ms`);
    console.log(
      `   Feedback interface is ${feedbackMean > noFeedbackMean ? "slower" : "faster"} by ${percentDiff.toFixed(1)}%`,
    );
    console.log(
      `\n Insight: ${feedbackMean < noFeedbackMean ? "Showing feedback appears to help users tap faster!" : "Feedback does not appear to improve tap speed."}`,
    );
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

// Query 3: User Completion Analysis
async function analyzeUserCompletion() {
  console.log("=== QUERY 3: User Completion Analysis ===\n");

  // Get all sessions
  const sessionsSnapshot = await db.collection("tap_sessions").get();

  // Group sessions by sessionId and count total taps
  const sessionData = {};

  sessionsSnapshot.forEach((doc) => {
    const data = doc.data();
    const sessionId = data.sessionId;

    if (!sessionData[sessionId]) {
      sessionData[sessionId] = {
        totalTaps: 0,
        deviceType: data.deviceType,
        sessions: [],
      };
    }

    sessionData[sessionId].totalTaps += data.totalTaps || 0;
    sessionData[sessionId].sessions.push(data);
  });

  let completedBoth = 0; // 100 clicks (2 rounds completed)
  let droppedAfterFirst = 0; // 50 clicks (1 round only)
  let other = 0; // Partial/incomplete

  for (const sessionId in sessionData) {
    const session = sessionData[sessionId];

    if (session.totalTaps >= 100) {
      completedBoth++; // User completed both rounds
    } else if (session.totalTaps >= 40 && session.totalTaps < 100) {
      droppedAfterFirst++; // User completed ~1 round but dropped off
    } else {
      other++; // Incomplete/abandoned early
    }
  }

  const totalUsers = Object.keys(sessionData).length;

  console.log(` Total unique users (sessions): ${totalUsers}`);
  console.log(` Users who completed BOTH rounds (100 taps): ${completedBoth}`);
  console.log(
    ` Users who dropped off after FIRST round (~50 taps): ${droppedAfterFirst}`,
  );
  console.log(` Users who abandoned early (<40 taps): ${other}`);

  if (totalUsers > 0) {
    console.log(`\n Completion Metrics:`);
    console.log(
      `   Full completion rate: ${((completedBoth / totalUsers) * 100).toFixed(1)}%`,
    );
    console.log(
      `   Drop-off after first round: ${((droppedAfterFirst / totalUsers) * 100).toFixed(1)}%`,
    );
    console.log(
      `   Early abandonment: ${((other / totalUsers) * 100).toFixed(1)}%`,
    );
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

// Main function to run all analyses
async function runAllAnalyses() {
  console.log("\n" + "=".repeat(60));
  console.log("   TAP LOGGER DATA ANALYSIS");
  console.log("=".repeat(60) + "\n");

  try {
    await compareDevicePerformance();
    await compareInterfaceTypes();
    await analyzeUserCompletion();

    console.log(" Analysis Complete!\n");
    process.exit(0);
  } catch (error) {
    console.error(" Error running analysis:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllAnalyses();
