const { supabase } = require("../config/database");

exports.processPayment = async (req, res) => {
  try {
    const { email, cardNumber, amount } = req.body;
    console.log("📥 Received payment request:", { email, cardNumber, amount });

    if (!email || !cardNumber || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 1️⃣ Fetch user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    console.log("👤 User data:", userData);
    if (userError) {
      console.error("User fetch error:", userError);
      return res.status(500).json({ message: "Error fetching user", error: userError.message });
    }

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Prevent duplicate subscriptions
    if (userData.isSubscribed) {
      console.log("⚠️ User already subscribed.");
      return res.status(200).json({
        message: "Already subscribed",
        failed: true,
      });
    }

    // 3️⃣ Insert payment
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .insert([
        {
          userId: userData._id,
          email: userData.email,
          cardLastFourDigits: cardNumber.slice(-4),
          amount,
          paymentStatus: "completed",
          paymentDate: new Date().toISOString(),
        },
      ])
      .select("*");

    console.log("💳 Payment insert result:", paymentData, paymentError);

    if (paymentError) {
      console.error("Payment insert error:", paymentError);
      throw paymentError;
    }

    // 4️⃣ Update subscription
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ isSubscribed: true })
      .eq("_id", userData._id)
      .select("*");

    console.log("🧾 User update result:", updatedUser, updateError);

    if (updateError) {
      console.error("User update error:", updateError);
      throw updateError;
    }

    return res.status(200).json({
      message: "Payment processed successfully",
      subscriptionStatus: true,
      payment: paymentData,
    });
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    return res.status(500).json({
      message: "Payment processing failed",
      error: error.message,
    });
  }
};
