// utils/mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();
const { supabase } = require("../config/database");

// Create and configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // stored in .env
    pass: process.env.EMAIL_PASS, // app password
  },
});

/**
 * Send an email and optionally log it in Supabase.
 * @param {string} fromEmail - The sender’s email address.
 * @param {string} name - The sender’s name.
 * @param {string} message - The message body.
 */
const sendEmail = async (fromEmail, name, message) => {
  const mailOptions = {
    from: fromEmail,
    to: process.env.ADMIN_EMAIL, // Admin email from .env
    subject: `Contact Us Query from ${name}`,
    html: `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; background: #f4f4f4; }
            .email-container {
              max-width: 600px; margin: 0 auto; background: #fff;
              padding: 20px; border-radius: 8px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .email-header { background: #0077b6; color: white; padding: 10px; text-align: center; border-radius: 8px 8px 0 0; }
            .message { background: #f9f9f9; padding: 10px; border-left: 4px solid #0077b6; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header"><h2>New Contact Us Message</h2></div>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${fromEmail}</p>
            <div class="message"><p>${message}</p></div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Log message in Supabase (optional)
    const { error } = await supabase.from("contact_messages").insert([
      { name, email: fromEmail, message, sent_at: new Date() },
    ]);

    if (error) {
      console.warn("Supabase logging failed:", error.message);
    }

    console.log("Email sent successfully:", info.response);
    return info.response;
  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw error;
  }
};

module.exports = { sendEmail };
