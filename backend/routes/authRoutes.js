// routes/authRoutes.js
const express = require("express");
const { googleAuth } = require("../controllers/authController");

const router = express.Router();

// POST route for Google login
router.post("/google", googleAuth);

module.exports = router;
