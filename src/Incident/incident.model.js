import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  driveItemId: { type: String, required: false },
  originalName: { type: String, required: false },
  storedName: { type: String, required: false },
  fileUrl: { type: String, required: false },
  mimeType: { type: String, required: false },
  fileSize: { type: Number, required: false },
  extension: { type: String, required: false },
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  incidentNumber: {
    type: Number,
    required: false,
    unique: true,
    sparse: true,
    min: 1,
  },
  incident_title: {
    type: String,
    required: false,
  },
  incident_eventTime: {
    hour: {
      type: Number,
      min: 1,
      max: 12,
      required: false,
    },
    minute: {
      type: Number,
      min: 0,
      max: 59,
      required: false,
    },
    period: {
      type: String,
      enum: ["AM", "PM"],
      required: false,
    },
  },
  incident_recordable: {
    type: Boolean,
    default: false,
  },
  incident_description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: false,
  },
  incident_eventDate: {
    type: Date,
    required: true,
  },
  incident_timeUnknown: {
    type: Boolean,
    default: false,
  },
  incident_isPrivate: {
    type: Boolean,
    default: false,
  },
  distributionRoles: {
    type: [String],
    default: [],
  },
  distributionUsers: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
      email: {
        type: String,
        required: false,
      },
    },
  ],
  incident_attachment: attachmentSchema,
  incident_attachments: {
    type: [attachmentSchema],
    default: [],
  },
  hazard: {
    type: String,
    required: false,
  },
  investigation_contributing_behaviour: {
    type: String,
    required: false,
  },
  investigation_contributing_condition: {
    type: String,
    required: false,
  },
  investigation_comments: {
    type: String,
    required: false,
  },
  investigation_files: {
    type: [attachmentSchema],
    default: [],
  },
  investigation_authority: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  investigation_signature: {
    dataUrl: { type: String, required: false },
    signedAt: { type: Date, required: false },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  },
  recordTypeForms: [
    {
      template: {
        type: String,
        required: true,
      },
      formData: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
    },
  ],
  observation_description: {
    type: String,
    required: true,
  },
  observation_status: {
    type: String,
    enum: ["Verified", "Not Effective", "Needs Follow-Up"],
  },
  observation_observedBy: {
    type: String,
    enum: ["Supervisor", "Safety Officer"],
    required: true,
  },
  observation_files: attachmentSchema,
  witnesses: [
    {
      name: { type: String, required: true },
      statement: { type: String, required: true },
      dateReceived: { type: Date, required: true },
      attachment: attachmentSchema,
    },
  ],
  actions: [
    {
      description: { type: String, required: true },
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
      attachment: attachmentSchema,
      observation: {
        observationDate: { type: Date, required: false },
        observedBy: { type: String, required: false },
        attachment: attachmentSchema,
        actionStatus: {
          type: String,
          enum: ["Open", "In Progress", "Completed", "Overdue", "Cancelled"],
          default: "Open",
        },
        percentageComplete: { type: Number, min: 0, max: 100, default: 0 },
        observationNotes: { type: String, required: false },
        findingsOrBarriers: { type: String, required: false },
        followUpRequired: { type: Boolean, default: false },
        nextObservationDate: { type: Date, required: false },
          observation_signature: {
            dataUrl: { type: String, required: false },
            signedAt: { type: Date, required: false },
            signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
          },
        },
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

const IncidentModel = mongoose.model("Incident", incidentSchema);

export default IncidentModel;
