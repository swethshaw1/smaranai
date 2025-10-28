const express = require("express");
const app = express();
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { supabase, connect } = require("./config/database");

// Import routes
const courseRoutes = require("./routes/courseRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// Load environment variables
dotenv.config();
const PORT = process.env.PORT || 5000;

// Connect to Supabase
connect();

// ----------------------------
// Middleware setup
// ----------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const frontendDomain = process.env.FRONTEND_DOMAIN || "*";
app.use(
  cors({
    origin: frontendDomain,
    credentials: true,
  })
);

// ----------------------------
// Admin Access Middleware (updated for camelCase schema)
// ----------------------------
app.use("/api/admin/*", async (req, res, next) => {
  try {
    // Allow GET requests to pass
    if (req.method === "GET") return next();

    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) return next();

    // Extract googleId from body
    const { googleId } = req.body || {};
    if (!googleId) {
      return res.status(401).json({ status: 401, message: "Missing credentials" });
    }

    // ✅ Query Supabase with quoted camelCase columns
    const { data: user, error } = await supabase
      .from("users")
      .select('"isAdmin"')
      .eq('"googleId"', googleId)
      .single();

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(500).json({ status: 500, message: "Database error" });
    }

    // ✅ Check if user has admin rights
    if (user && user.isAdmin) {
      return next();
    }

    return res.status(403).json({ status: 403, message: "Not an authorized user" });
  } catch (e) {
    console.error("Auth middleware error:", e);
    return res.status(500).json({ status: 500, message: "Auth middleware error" });
  }
});

// ----------------------------
// Routes
// ----------------------------
app.use("/api", courseRoutes);          // Course-related routes
app.use("/api/users", userRoutes);      // User-related routes
app.use("/api/admin", adminRoutes);     // Admin-related routes
app.use("/api/auth", authRoutes);       // Auth-related routes
app.use("/api/payment", paymentRoutes); // Payment-related routes

// ----------------------------
// Default route
// ----------------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Supabase backend is up and running!",
  });
});

// ----------------------------
// Start the server
// ----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
