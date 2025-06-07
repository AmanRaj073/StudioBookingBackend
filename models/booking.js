const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  formData: Object,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Booking", bookingSchema);
