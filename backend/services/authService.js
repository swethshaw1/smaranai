// services/authService.js
const { OAuth2Client } = require("google-auth-library");
const dotenv = require("dotenv");

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies Google ID token and returns user payload.
 */
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload(); // { name, email, picture, sub }
    return payload;
  } catch (error) {
    console.error("❌ Google token verification failed:", error.message);
    throw new Error("Invalid Google token");
  }
};

module.exports = { verifyGoogleToken };
