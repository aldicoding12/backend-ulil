import mongoose from "mongoose";

const incomeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  method: {
    type: String,
    default: "cash",
  },
  note: {
    type: String,
    default: "",
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const Income = mongoose.model("Income", incomeSchema);
export default Income;
