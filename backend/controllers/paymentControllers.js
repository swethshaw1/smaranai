const { supabase } = require("../config/database");

exports.processPayment = async (req, res) => {
  try {
    const { email, cardNumber, amount } = req.body;

    if (!email || !cardNumber || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Fetch user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    if (userError) {
      console.error("User fetch error:", userError);
      return res.status(500).json({ message: "Error fetching user", error: userError.message });
    }

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent duplicate subscriptions
    if (userData.isSubscribed) {
      console.log("⚠️ User already subscribed.");
      return res.status(200).json({
        message: "Already subscribed",
        failed: true,
      });
    }

    // Insert payment
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

    if (paymentError) {
      console.error("Payment insert error:", paymentError);
      throw paymentError;
    }

    // Update subscription
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ isSubscribed: true })
      .eq("_id", userData._id)
      .select("*");

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
    console.error("Payment processing error:", error);
    return res.status(500).json({
      message: "Payment processing failed",
      error: error.message,
    });
  }
};
