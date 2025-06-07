const multer = require("multer");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

dotenv.config();
require("../db");
const User = require("../models/User");
const Booking = require("../models/Booking");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("📡 API is live!");
});

// 🔐 Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid Token" });
  }
};

// ✅ Register
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: "User registered", userId: user._id });
  } catch (err) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// ✅ Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// 📁 File Upload Setup
const storage = multer.diskStorage({
  destination: path.join("/tmp"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ Submit Booking Form
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

      // Save booking to DB if user is logged in
      if (data.userId && mongoose.Types.ObjectId.isValid(data.userId)) {
        await Booking.create({
          userId: data.userId,
          formData: {
            date: data.date,
            time: data.time,
            shootingDays: data.shootingDays,
            preSetupDays: data.preSetupDays,
            dismantalDays: data.dismantalDays,
            additionalNote: data.additionalNote,
            productionName: data.productionName,
            personName: data.personName,
            phoneNumber: data.phoneNumber,
            emailAddress: data.emailAddress,
            gst: data.gst,
            govId: data.govId,
          },
        });
      }

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

      // Delete files after sending
      Object.values(files)
        .flat()
        .forEach((file) => fs.unlink(file.path, () => {}));

      res.status(200).json({ message: "Form submitted successfully!" });
    } catch (err) {
      console.error("Submission error:", err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
);

// ✅ Get My Bookings
app.get("/my-bookings", authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate("userId", "name email"); // only get name and email

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});


// ✅ Get Booking by ID
app.get("/booking/:id", authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}


// ✅ Required for Vercel
module.exports = app;
