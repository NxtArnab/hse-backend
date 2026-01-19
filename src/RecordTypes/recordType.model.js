import mongoose from "mongoose";

const recordTypeSchema = new mongoose.Schema(
  {
    template: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    layout: [{
       name: { type: String, required: true },
       label: { type: String, required: true },
       type: {
             type: String,
             enum: ["text", "textarea", "select", "date", "checkbox", "file","select-api"],
             required: true
             },
       options: [String], // for select and checkbox
       apiKey: { type: String, required: false },  // for select-api        
       required: { type: Boolean, default: false },
       gridSpan: { type: Number, default: 12 }
    }]
  },
  { timestamps: true }
);

export default mongoose.model("RecordType", recordTypeSchema);