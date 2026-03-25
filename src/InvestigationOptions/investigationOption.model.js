import mongoose from "mongoose";

const investigationOptionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["condition", "behaviour"],
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    labelLower: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

investigationOptionSchema.index({ type: 1, labelLower: 1 }, { unique: true });

export default mongoose.model("InvestigationOption", investigationOptionSchema);
