import express from "express";
import recordTypeRoutes from "./record-types/recordType.route.js";
import investigationOptionRoutes from "./investigation-options/investigationOption.route.js";

const adminRouter = express.Router();

adminRouter.use("/record-types", recordTypeRoutes);
adminRouter.use("/investigation-options", investigationOptionRoutes);

export default adminRouter;
