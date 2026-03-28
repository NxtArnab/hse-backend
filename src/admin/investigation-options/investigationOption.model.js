import mongoose from "mongoose";

const investigationOptionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["condition", "behaviour"],
      required: true,
    },
    values: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

investigationOptionSchema.index({ type: 1 }, { unique: true });

export default mongoose.model("InvestigationOption", investigationOptionSchema);
