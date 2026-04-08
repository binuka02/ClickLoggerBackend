// api/index.js
const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ------------------ Test Route ------------------
app.get("/", (req, res) => {
  console.log("✅ / endpoint called"); // This will appear in runtime logs
  res.json({
    status: "Backend is working!",
    message: "This is a test route",
    time: new Date().toISOString(),
  });
});

// Wrap Express for Vercel v2
module.exports = (req, res) => app(req, res);
