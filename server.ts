import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/submit", async (req, res) => {
    const { fullName, email, phone, projectType, description } = req.body;

    console.log("New submission received:", req.body);

    // 1. Send Telegram Notification
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const timestamp = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

    if (telegramToken && chatId) {
      const message = `
🔔 طلب جديد من طويقفاي:
📅 التاريخ: ${timestamp}
👤 الاسم: ${fullName}
📧 البريد: ${email}
📱 الجوال: ${phone}
🛠 النوع: ${projectType || "غير محدد"}
📝 الوصف: ${description}
      `.trim();

      try {
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          chat_id: chatId,
          text: message,
        });
        console.log("Telegram notification sent");
      } catch (error) {
        console.error("Error sending Telegram notification:", error);
      }
    } else {
      console.warn("Telegram credentials missing. Skipping notification.");
    }

    // 2. Update Google Sheets
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (sheetId && clientEmail && privateKey) {
      try {
        const serviceAccountAuth = new JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Append to the first sheet

        await sheet.addRow({
          "تاريخ الطلب": timestamp,
          "الاسم الكامل": fullName,
          "البريد الإلكتروني": email,
          "رقم الجوال": phone,
          "نوع المشروع": projectType || "",
          "الوصف": description,
        });
        console.log("Google Sheets updated");
      } catch (error) {
        console.error("Error updating Google Sheets:", error);
      }
    } else {
      console.warn("Google Sheets credentials missing. Skipping sheet update.");
    }

    res.status(200).json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
