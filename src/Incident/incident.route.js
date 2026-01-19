import incidentController from "./incident.controller.js";

import express from "express";

const IncidentRouter = express.Router();

IncidentRouter.post("/", incidentController);

export default IncidentRouter;
