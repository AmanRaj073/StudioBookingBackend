const multer = require("multer");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const express = require("express");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("📡 API is live!");
});

const storage = multer.diskStorage({
  destination: path.join("/tmp"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

app.post(
  "/submit-form",
  upload.fields([
    { name: "gstFile", maxCount: 1 },
    { name: "govIdFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const data = req.body;
      const files = req.files;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `New Form Submission from ${data.personName || "Unknown"}`,
        text: `
📅 Date: ${data.date}
🕒 Time: ${data.time}
🎬 Shooting Days: ${data.shootingDays}
⚒️ Pre-setup Days: ${data.preSetupDays}
🧹 Dismantal Days: ${data.dismantalDays}
📝 Note: ${data.additionalNote}

🏷️ Production Name: ${data.productionName}
👤 Person Name: ${data.personName}
📞 Phone: ${data.phoneNumber}
📧 Email: ${data.emailAddress}
🧾 GST: ${data.gst}
🆔 Gov ID: ${data.govId}
        `,
        attachments: [
          files?.gstFile?.[0] && {
            filename: files.gstFile[0].originalname,
            path: files.gstFile[0].path,
          },
          files?.govIdFile?.[0] && {
            filename: files.govIdFile[0].originalname,
            path: files.govIdFile[0].path,
          },
        ].filter(Boolean),
      };

      await transporter.sendMail(mailOptions);

      Object.values(files)
        .flat()
        .forEach((file) => fs.unlink(file.path, () => {}));

      res.status(200).json({ message: "Form submitted successfully!" });
    } catch (err) {
      console.error("Email error:", err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
);

// ✅ Required for Vercel
module.exports = app;
