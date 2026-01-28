import incidentController from "./incident.controller.js";
import { verify } from "../middlewares/authentication.middleware.js";
import express from "express";

const IncidentRouter = express.Router();

IncidentRouter.post("/", verify, incidentController.incidentController);
IncidentRouter.get("/", verify, incidentController.getAllIncidents);
IncidentRouter.get("/:id", verify, incidentController.getIncidentById);
IncidentRouter.delete("/bulk-delete", verify, incidentController.deleteMultipleIncidents);
IncidentRouter.delete("/:id", verify, incidentController.deleteIncident);

export default IncidentRouter;
