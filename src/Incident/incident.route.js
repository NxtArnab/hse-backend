import multer from "multer";
import { createIncident, getIncidents, getIncidentById, updateIncident, deleteIncident, bulkDeleteIncidents, uploadIncidentAttachment, previewIncidentAttachment } from "./incident.controller.js";
import express from 'express';
import { verify } from "../middlewares/authentication.middleware.js";

const IncidentRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

IncidentRouter.use(verify);

IncidentRouter.post("/attachment-upload", upload.single("file"), uploadIncidentAttachment);
IncidentRouter.get("/attachment-preview/:id", previewIncidentAttachment);
IncidentRouter.post("/", createIncident);
IncidentRouter.get("/", getIncidents);
IncidentRouter.get("/:id", getIncidentById);
IncidentRouter.put("/:id", updateIncident);
IncidentRouter.delete("/bulk-delete", bulkDeleteIncidents);
IncidentRouter.delete("/:id", deleteIncident);

export default IncidentRouter;
