// models/balanceModel.js
import mongoose from "mongoose";

const balanceSchema = new mongoose.Schema({
  amount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const Balance = mongoose.model("Balance", balanceSchema);
export default Balance;
