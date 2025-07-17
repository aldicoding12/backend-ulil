// services/emailService.js
import nodemailer from "nodemailer";

class EmailService {
  constructor() {
    // Perbaikan: gunakan createTransport (bukan createTransporter)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Tambahan konfigurasi untuk mengatasi masalah SSL
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Log konfigurasi (tanpa password)
    console.log("📧 Email Service initialized with:");
    console.log("- Host:", process.env.SMTP_HOST || "smtp.gmail.com");
    console.log("- Port:", process.env.SMTP_PORT || 587);
    console.log("- User:", process.env.SMTP_USER || "NOT_SET");
    console.log("- Pass:", process.env.SMTP_PASS ? "***SET***" : "NOT_SET");
  }

  // Verify connection configuration
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log("✅ Email service connection verified successfully");
      return true;
    } catch (error) {
      console.error("❌ Email service verification failed:");
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);

      // Berikan petunjuk troubleshooting berdasarkan error
      if (error.code === "EAUTH") {
        console.error(
          "💡 Troubleshooting: Check username/password or use App Password for Gmail"
        );
      } else if (error.code === "ECONNECTION") {
        console.error("💡 Troubleshooting: Check SMTP host and port settings");
      } else if (error.code === "ETIMEDOUT") {
        console.error(
          "💡 Troubleshooting: Check internet connection and firewall settings"
        );
      }

      return false;
    }
  }

  // Send reply email to user
  async sendReplyEmail({
    recipientEmail,
    recipientName,
    originalSubject,
    originalMessage,
    replyMessage,
  }) {
    try {
      console.log(`📤 Sending reply email to: ${recipientEmail}`);

      const mailOptions = {
        from: {
          name: process.env.ORGANIZATION_NAME || "Admin Tim",
          address: process.env.SMTP_USER,
        },
        to: recipientEmail,
        subject: `Re: ${originalSubject}`,
        html: this.generateReplyEmailTemplate({
          recipientName,
          originalSubject,
          originalMessage,
          replyMessage,
        }),
        text: this.generatePlainTextReply({
          recipientName,
          originalMessage,
          replyMessage,
        }),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("✅ Reply email sent successfully");
      console.log("Message ID:", info.messageId);
      console.log("Response:", info.response);

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      console.error("❌ Failed to send reply email:");
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      console.error("Recipient:", recipientEmail);

      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  // Generate HTML email template
  generateReplyEmailTemplate({
    recipientName,
    originalSubject,
    originalMessage,
    replyMessage,
  }) {
    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Balasan dari ${
          process.env.ORGANIZATION_NAME || "Tim Admin"
        }</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #059669, #10b981);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 30px 20px;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 20px;
          }
          .original-message {
            background-color: #f8f9fa;
            border-left: 4px solid #e5e7eb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .original-message h4 {
            margin: 0 0 10px 0;
            color: #6b7280;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .original-message p {
            margin: 5px 0;
            color: #4b5563;
          }
          .reply-message {
            background-color: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .reply-message h4 {
            margin: 0 0 15px 0;
            color: #059669;
            font-size: 16px;
          }
          .reply-text {
            white-space: pre-wrap;
            line-height: 1.7;
            color: #374151;
          }
          .footer {
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
            color: #6b7280;
            font-size: 14px;
          }
          .note {
            margin-top: 30px;
            padding: 20px;
            background-color: #fef3c7;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
          }
          .note p {
            margin: 0;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 Balasan dari Tim Admin</h1>
          </div>
          
          <div class="content">
            <div class="greeting">
              <p>Assalamu'alaikum <strong>${recipientName}</strong>,</p>
              <p>Terima kasih telah menghubungi kami. Berikut adalah balasan untuk pesan Anda:</p>
            </div>

            <div class="original-message">
              <h4>📨 Pesan Asli Anda:</h4>
              <p><strong>Subjek:</strong> ${originalSubject}</p>
              <p><strong>Pesan:</strong></p>
              <p style="white-space: pre-wrap; margin-top: 10px;">${originalMessage}</p>
            </div>

            <div class="reply-message">
              <h4>✨ Balasan dari Tim Admin:</h4>
              <div class="reply-text">${replyMessage}</div>
            </div>

            <div class="note">
              <p>
                <strong>📌 Catatan:</strong> Jika Anda memiliki pertanyaan lebih lanjut, 
                silakan balas email ini atau hubungi kami melalui website.
              </p>
            </div>
          </div>

          <div class="footer">
            <p><strong>${
              process.env.ORGANIZATION_NAME || "Organisasi Kami"
            }</strong></p>
            <p>Email: ${process.env.SMTP_USER}</p>
            <p>Website: ${process.env.WEBSITE_URL || "https://example.com"}</p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
              Email ini dikirim secara otomatis. Silakan balas email ini jika ada pertanyaan.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate plain text version
  generatePlainTextReply({ recipientName, originalMessage, replyMessage }) {
    return `
Assalamu'alaikum ${recipientName},

Terima kasih telah menghubungi kami. Berikut adalah balasan untuk pesan Anda:

PESAN ASLI ANDA:
${originalMessage}

BALASAN DARI TIM ADMIN:
${replyMessage}

---
${process.env.ORGANIZATION_NAME || "Tim Admin"}
Email: ${process.env.SMTP_USER}

Catatan: Jika Anda memiliki pertanyaan lebih lanjut, silakan balas email ini.
    `;
  }

  // Send notification email to admin when new contact submitted
  async sendNotificationToAdmin({ contactData }) {
    try {
      console.log("📬 Sending admin notification...");

      const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((email) =>
        email.trim()
      ) || [process.env.SMTP_USER];

      const mailOptions = {
        from: {
          name: "System Notification",
          address: process.env.SMTP_USER,
        },
        to: adminEmails,
        subject: `🔔 Pesan Baru: ${contactData.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">📧 Pesan Baru Diterima</h2>
            </div>
            <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
              <p><strong>Dari:</strong> ${contactData.name}</p>
              <p><strong>Email:</strong> ${contactData.email}</p>
              <p><strong>Subjek:</strong> ${contactData.subject}</p>
              <p><strong>Kategori:</strong> ${contactData.category}</p>
              <p><strong>Prioritas:</strong> ${contactData.priority}</p>
              <p><strong>Waktu:</strong> ${new Date(
                contactData.createdAt
              ).toLocaleString("id-ID")}</p>
              
              <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 6px;">
                <h4 style="margin: 0 0 10px 0;">Pesan:</h4>
                <p style="white-space: pre-wrap; margin: 0;">${
                  contactData.message
                }</p>
              </div>
              
              <div style="margin-top: 20px; text-align: center;">
                <a href="${process.env.ADMIN_DASHBOARD_URL || "#"}" 
                   style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Lihat di Dashboard
                </a>
              </div>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log("✅ Admin notification sent to:", adminEmails.join(", "));
    } catch (error) {
      console.error("❌ Failed to send admin notification:", error.message);
      // Don't throw error for notification failure
    }
  }

  // Test function untuk development
  async sendTestEmail(testEmail = "test@example.com") {
    try {
      console.log(`📧 Sending test email to: ${testEmail}`);

      const mailOptions = {
        from: {
          name: process.env.ORGANIZATION_NAME || "Test Admin",
          address: process.env.SMTP_USER,
        },
        to: testEmail,
        subject: "🧪 Test Email - Email Service Working!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px; text-align: center;">
              <h2 style="margin: 0;">✅ Email Service Test</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p>Selamat! Email service Anda berfungsi dengan baik.</p>
              <p><strong>Waktu:</strong> ${new Date().toLocaleString(
                "id-ID"
              )}</p>
              <p><strong>Server:</strong> ${process.env.SMTP_HOST}</p>
              <p><strong>From:</strong> ${process.env.SMTP_USER}</p>
            </div>
          </div>
        `,
        text: `
Email Service Test

Selamat! Email service Anda berfungsi dengan baik.
Waktu: ${new Date().toLocaleString("id-ID")}
Server: ${process.env.SMTP_HOST}
From: ${process.env.SMTP_USER}
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("✅ Test email sent successfully:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Test email failed:", error.message);
      throw error;
    }
  }
}

// Create and export instance
const emailService = new EmailService();
export default emailService;
