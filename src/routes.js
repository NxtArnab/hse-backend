import express from "express";
import IncidentRouter from "./Incident/incident.route.js";
import recordTypeRoutes from "./RecordTypes/recordType.route.js";
import investigationOptionRoutes from "./InvestigationOptions/investigationOption.route.js";
import UserRouter from "./user/user.router.js";
import authRouter from "./auth/auth.routes.js";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/user", UserRouter);
router.use("/incident", IncidentRouter);
router.use("/record-types", recordTypeRoutes);
router.use("/investigation-options", investigationOptionRoutes);

export default router;
