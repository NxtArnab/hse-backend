import { createIncident, getIncidents, getIncidentById, updateIncident, deleteIncident, bulkDeleteIncidents } from "./incident.controller.js";
import express from 'express';
import { verify } from "../middlewares/authentication.middleware.js";

const IncidentRouter = express.Router();

IncidentRouter.use(verify);

IncidentRouter.post("/", createIncident);
IncidentRouter.get("/", getIncidents);
IncidentRouter.get("/:id", getIncidentById);
IncidentRouter.put("/:id", updateIncident);
IncidentRouter.delete("/bulk-delete", bulkDeleteIncidents);
IncidentRouter.delete("/:id", deleteIncident);

export default IncidentRouter;
