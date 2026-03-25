import mongoose from "mongoose";

const recordTypeSchema = new mongoose.Schema(
  {
    template: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    layout: [
      {
        name: { type: String, required: true },
        label: { type: String, required: true },
        type: {
          type: String,
          required: true,
          enum: [
            "text",
            "textarea",
            "select",
            "dropdown",
            "date",
            "time",
            "number",
            "checkbox",
            "radio",
            "file",
            "signature",
            "location",
            "body-diagram",
            "table",
            "multiselect",
            "select-api",
          ],
        },
        options: [String], // for select and checkbox
        apiKey: { type: String, required: false }, // for select-api
        required: { type: Boolean, default: false },
        gridSpan: { type: Number, default: 12 },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("RecordType", recordTypeSchema);