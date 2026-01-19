import express from "express";
import IncidentRouter from "./Incident/incident.route.js";
import recordTypeRoutes from "./RecordTypes/recordType.route.js";

const router = express.Router();

router.use("/incident", IncidentRouter);
router.use("/record-types", recordTypeRoutes);

export default router;
