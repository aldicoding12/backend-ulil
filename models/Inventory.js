import mongoose from "mongoose";
const { Schema } = mongoose;

// Subschema for borrowing/lending
const borrowingSchema = new Schema(
  {
    borrowerName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    institution: { type: String },
    borrowDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    documentUrl: { type: String, required: true }, // URL for letter/document (PDF/image)
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "returned"],
      default: "pending",
    },
    notes: { type: String },
    actualReturnDate: { type: Date }, // Track actual return date
    approvedBy: { type: String }, // Who approved the borrowing
    rejectionReason: { type: String }, // Reason for rejection if applicable
  },
  { timestamps: true }
);

// Main inventory schema
const inventorySchema = new Schema(
  {
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    condition: {
      type: String,
      enum: ["good", "damaged", "needs_repair", "out_of_order"],
      default: "good",
      required: true,
    },
    imageUrl: { type: String, required: true }, // URL for item image
    imagePublicId: { type: String, required: false }, // Cloudinary public ID
    isLendable: { type: Boolean, default: false },
    description: { type: String }, // Optional description
    borrowings: [borrowingSchema], // Array of borrowing records

    // Calculated field helpers (can be used in virtuals)
    availableQuantity: {
      type: Number,
      default: function () {
        return this.quantity;
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to calculate currently borrowed quantity
inventorySchema.virtual("borrowedQuantity").get(function () {
  if (!this.borrowings || !Array.isArray(this.borrowings)) {
    return 0;
  }
  return this.borrowings
    .filter((b) => b.status === "approved")
    .reduce((total, b) => total + (b.quantity || 1), 0);
});

// Virtual to calculate available quantity
inventorySchema.virtual("currentlyAvailable").get(function () {
  const borrowed = this.borrowedQuantity;
  return Math.max(0, (this.quantity || 0) - borrowed);
});

// Index for better query performance
inventorySchema.index({ itemName: 1 });
inventorySchema.index({ condition: 1 });
inventorySchema.index({ isLendable: 1 });
inventorySchema.index({ "borrowings.status": 1 });
inventorySchema.index({ "borrowings.phoneNumber": 1 });

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
