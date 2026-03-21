const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized successfully\n');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.log('Please add your serviceAccountKey.json file to run analysis');
  process.exit(1);
}

const db = admin.firestore();

// Helper function to calculate standard deviation
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// Query 1: Mean Tap Duration for Android vs PC Users
async function compareDevicePerformance() {
  console.log('=== QUERY 1: Android vs PC Tap Duration Analysis ===\n');
  
  const androidSnapshot = await db.collection('tap_logs')
    .where('deviceType', '==', 'android')
    .get();
  
  const pcSnapshot = await db.collection('tap_logs')
    .where('deviceType', '==', 'pc')
    .get();
  
  let androidDurations = [];
  androidSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.duration > 0) {
      androidDurations.push(data.duration);
    }
  });
  
  let pcDurations = [];
  pcSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.duration > 0) {
      pcDurations.push(data.duration);
    }
  });
  
  const androidMean = androidDurations.length > 0 
    ? androidDurations.reduce((sum, d) => sum + d, 0) / androidDurations.length 
    : 0;
  
  const pcMean = pcDurations.length > 0 
    ? pcDurations.reduce((sum, d) => sum + d, 0) / pcDurations.length 
    : 0;
  
  console.log(`📱 Android Users:`);
  console.log(`   Total taps: ${androidDurations.length}`);
  console.log(`   Mean duration: ${androidMean.toFixed(2)} ms`);
  console.log(`   Std deviation: ${calculateStdDev(androidDurations).toFixed(2)} ms`);
  console.log(`   Min: ${androidDurations.length > 0 ? Math.min(...androidDurations).toFixed(2) : 0} ms`);
  console.log(`   Max: ${androidDurations.length > 0 ? Math.max(...androidDurations).toFixed(2) : 0} ms`);
  
  console.log(`\n💻 PC Users:`);
  console.log(`   Total taps: ${pcDurations.length}`);
  console.log(`   Mean duration: ${pcMean.toFixed(2)} ms`);
  console.log(`   Std deviation: ${calculateStdDev(pcDurations).toFixed(2)} ms`);
  console.log(`   Min: ${pcDurations.length > 0 ? Math.min(...pcDurations).toFixed(2) : 0} ms`);
  console.log(`   Max: ${pcDurations.length > 0 ? Math.max(...pcDurations).toFixed(2) : 0} ms`);
  
  if (androidDurations.length > 0 && pcDurations.length > 0) {
    const difference = Math.abs(androidMean - pcMean);
    const percentDiff = Math.abs(((pcMean - androidMean) / androidMean) * 100);
    console.log(`\n📊 Analysis:`);
    console.log(`   Absolute difference: ${difference.toFixed(2)} ms`);
    console.log(`   PC is ${pcMean > androidMean ? 'slower' : 'faster'} by ${percentDiff.toFixed(1)}%`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Query 2: Compare Feedback vs No-Feedback Interface
async function compareInterfaceTypes() {
  console.log('=== QUERY 2: Feedback vs No-Feedback Interface Analysis ===\n');
  
  const feedbackSnapshot = await db.collection('tap_logs')
    .where('interface', '==', 'feedbackshown')
    .get();
  
  const noFeedbackSnapshot = await db.collection('tap_logs')
    .where('interface', '==', 'nofeedback')
    .get();
  
  let feedbackDurations = [];
  feedbackSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.duration > 0) {
      feedbackDurations.push(data.duration);
    }
  });
  
  let noFeedbackDurations = [];
  noFeedbackSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.duration > 0) {
      noFeedbackDurations.push(data.duration);
    }
  });
  
  const feedbackMean = feedbackDurations.length > 0 
    ? feedbackDurations.reduce((sum, d) => sum + d, 0) / feedbackDurations.length 
    : 0;
  
  const noFeedbackMean = noFeedbackDurations.length > 0 
    ? noFeedbackDurations.reduce((sum, d) => sum + d, 0) / noFeedbackDurations.length 
    : 0;
  
  console.log(`✅ Feedback Shown Interface:`);
  console.log(`   Total taps: ${feedbackDurations.length}`);
  console.log(`   Mean duration: ${feedbackMean.toFixed(2)} ms`);
  console.log(`   Std deviation: ${calculateStdDev(feedbackDurations).toFixed(2)} ms`);
  console.log(`   Min: ${feedbackDurations.length > 0 ? Math.min(...feedbackDurations).toFixed(2) : 0} ms`);
  console.log(`   Max: ${feedbackDurations.length > 0 ? Math.max(...feedbackDurations).toFixed(2) : 0} ms`);
  
  console.log(`\n❌ No Feedback Interface:`);
  console.log(`   Total taps: ${noFeedbackDurations.length}`);
  console.log(`   Mean duration: ${noFeedbackMean.toFixed(2)} ms`);
  console.log(`   Std deviation: ${calculateStdDev(noFeedbackDurations).toFixed(2)} ms`);
  console.log(`   Min: ${noFeedbackDurations.length > 0 ? Math.min(...noFeedbackDurations).toFixed(2) : 0} ms`);
  console.log(`   Max: ${noFeedbackDurations.length > 0 ? Math.max(...noFeedbackDurations).toFixed(2) : 0} ms`);
  
  if (feedbackDurations.length > 0 && noFeedbackDurations.length > 0) {
    const difference = Math.abs(feedbackMean - noFeedbackMean);
    const percentDiff = Math.abs(((feedbackMean - noFeedbackMean) / noFeedbackMean) * 100);
    console.log(`\n📊 Analysis:`);
    console.log(`   Absolute difference: ${difference.toFixed(2)} ms`);
    console.log(`   Feedback interface is ${feedbackMean > noFeedbackMean ? 'slower' : 'faster'} by ${percentDiff.toFixed(1)}%`);
    console.log(`\n💡 Insight: ${feedbackMean < noFeedbackMean ? 'Showing feedback appears to help users tap faster!' : 'Feedback does not appear to improve tap speed.'}`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Query 3: User Completion Analysis
async function analyzeUserCompletion() {
  console.log('=== QUERY 3: User Completion Analysis ===\n');
  
  const sessionsSnapshot = await db.collection('tap_sessions').get();
  
  let totalSessions = 0;
  const sessionsByBase = {};
  
  sessionsSnapshot.forEach(doc => {
    const data = doc.data();
    totalSessions++;
    
    // Extract base session ID (first part before potential suffix)
    // This groups sessions from the same "user" (simplified approach)
    const sessionId = data.sessionId.toString();
    const baseId = sessionId.substring(0, Math.max(sessionId.length - 4, 10));
    
    if (!sessionsByBase[baseId]) {
      sessionsByBase[baseId] = {
        sessions: [],
        hasFirstInterface: false,
        hasSecondInterface: false
      };
    }
    
    sessionsByBase[baseId].sessions.push(data);
    
    // Check which interfaces were used
    if (data.interfaceVariations) {
      if (data.interfaceVariations.includes('feedbackshown') || 
          data.interfaceVariations.includes('nofeedback')) {
        if (!sessionsByBase[baseId].hasFirstInterface) {
          sessionsByBase[baseId].hasFirstInterface = true;
        } else {
          sessionsByBase[baseId].hasSecondInterface = true;
        }
      }
    }
  });
  
  let completedBoth = 0;
  let completedFirst = 0;
  let totalUsers = Object.keys(sessionsByBase).length;
  
  for (const baseId in sessionsByBase) {
    const userData = sessionsByBase[baseId];
    if (userData.sessions.length >= 2 && userData.hasSecondInterface) {
      completedBoth++;
    } else if (userData.sessions.length === 1) {
      completedFirst++;
    }
  }
  
  console.log(`👥 Total unique users (sessions): ${totalUsers}`);
  console.log(`✅ Users who completed BOTH variations: ${completedBoth}`);
  console.log(`⚠️  Users who only completed FIRST variation: ${completedFirst}`);
  console.log(`❌ Users who dropped off: ${totalUsers - completedBoth - completedFirst}`);
  
  if (totalUsers > 0) {
    console.log(`\n📊 Completion Metrics:`);
    console.log(`   Completion rate: ${((completedBoth / totalUsers) * 100).toFixed(1)}%`);
    console.log(`   Drop-off rate: ${(((totalUsers - completedBoth) / totalUsers) * 100).toFixed(1)}%`);
    console.log(`   Sessions per user: ${(totalSessions / totalUsers).toFixed(2)}`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Bonus Query: Learning Effect Analysis
async function analyzeLearningEffect() {
  console.log('=== BONUS: Learning Effect Analysis ===\n');
  console.log('Analyzing if users get faster as they progress through taps...\n');
  
  const tapsSnapshot = await db.collection('tap_logs')
    .orderBy('sessionId')
    .orderBy('tapSequenceNumber')
    .get();
  
  const sessionData = {};
  
  tapsSnapshot.forEach(doc => {
    const data = doc.data();
    if (!sessionData[data.sessionId]) {
      sessionData[data.sessionId] = [];
    }
    sessionData[data.sessionId].push(data);
  });
  
  let firstTenDurations = [];
  let lastTenDurations = [];
  let completeSessions = 0;
  
  for (const sessionId in sessionData) {
    const taps = sessionData[sessionId].sort((a, b) => a.tapSequenceNumber - b.tapSequenceNumber);
    
    if (taps.length >= 40) {
      completeSessions++;
      const first10 = taps.slice(0, 10).map(t => t.duration).filter(d => d > 0);
      const last10 = taps.slice(-10).map(t => t.duration).filter(d => d > 0);
      
      firstTenDurations.push(...first10);
      lastTenDurations.push(...last10);
    }
  }
  
  if (firstTenDurations.length > 0 && lastTenDurations.length > 0) {
    const firstTenMean = firstTenDurations.reduce((sum, d) => sum + d, 0) / firstTenDurations.length;
    const lastTenMean = lastTenDurations.reduce((sum, d) => sum + d, 0) / lastTenDurations.length;
    
    console.log(`🎯 First 10 taps (across ${completeSessions} complete sessions):`);
    console.log(`   Mean duration: ${firstTenMean.toFixed(2)} ms`);
    console.log(`   Sample size: ${firstTenDurations.length} taps`);
    
    console.log(`\n🏁 Last 10 taps:`);
    console.log(`   Mean duration: ${lastTenMean.toFixed(2)} ms`);
    console.log(`   Sample size: ${lastTenDurations.length} taps`);
    
    const improvement = ((firstTenMean - lastTenMean) / firstTenMean) * 100;
    console.log(`\n📊 Learning Effect:`);
    console.log(`   ${firstTenMean > lastTenMean ? '✅ Users got FASTER' : '⚠️  Users got SLOWER'}`);
    console.log(`   Change: ${Math.abs(improvement).toFixed(1)}% ${improvement > 0 ? 'improvement' : 'decline'}`);
    console.log(`   Absolute difference: ${Math.abs(firstTenMean - lastTenMean).toFixed(2)} ms`);
  } else {
    console.log('⚠️  Not enough data for learning effect analysis');
    console.log('   Need at least one complete session (40+ taps)');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Main function to run all analyses
async function runAllAnalyses() {
  console.log('\n' + '='.repeat(60));
  console.log('   TAP LOGGER DATA ANALYSIS');
  console.log('='.repeat(60) + '\n');
  
  try {
    await compareDevicePerformance();
    await compareInterfaceTypes();
    await analyzeUserCompletion();
    await analyzeLearningEffect();
    
    console.log('✅ Analysis Complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running analysis:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the analyses
runAllAnalyses();
