const { verifyGoogleToken } = require("../services/authService");
const jwt = require("jsonwebtoken");
const { supabase } = require("../config/database");

exports.googleAuth = async (req, res) => {
  const { token } = req.body;

  try {
    // 1️⃣ Verify Google token and extract payload
    const googleUser = await verifyGoogleToken(token);
    if (!googleUser)
      return res.status(401).json({ message: "Invalid Google token" });

    const googleId = googleUser.sub;
    const name = googleUser.name;
    const email = googleUser.email;
    const picture = googleUser.picture;

    if (!googleId)
      return res.status(400).json({ message: "Missing googleId in payload" });

    // 2️⃣ Check if user exists
    let { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("googleId", googleId)
      .single();

    if (userError && userError.code !== "PGRST116") throw userError;

    // 3️⃣ Create user if not found
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert([
          {
            googleId,
            name,
            email,
            picture,
            isSubscribed: false,
            isAdmin: false,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;
    }

    // 4️⃣ Re-fetch latest data
    const { data: freshUser, error: refreshError } = await supabase
      .from("users")
      .select("*")
      .eq("googleId", googleId)
      .single();

    if (refreshError) throw refreshError;
    user = freshUser;

    // 5️⃣ Generate JWT with updated fields
    const jwtToken = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        googleId: user.googleId,
        isAdmin: user.isAdmin,
        isSubscribed: user.isSubscribed,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6️⃣ Return up-to-date user info
    res.status(200).json({
      user: {
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture,
        isSubscribed: user.isSubscribed,
        isAdmin: user.isAdmin,
      },
      token: jwtToken,
    });

    console.log("✅ User logged in:", user.email, "| Admin:", user.isAdmin);
  } catch (error) {
    console.error("❌ Error in Google login:", error.message);
    res.status(400).json({ message: error.message });
  }
};
