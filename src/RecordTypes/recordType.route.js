import express from "express";
import { getRecordTypes, createRecordType, updateRecordType, deleteRecordType } from "./recordType.controller.js";
import { verify } from "../middlewares/authentication.middleware.js";

const recordTypeRoutes = express.Router();

recordTypeRoutes.use(verify); // Admin routes should be protected

recordTypeRoutes.get("/", getRecordTypes);
recordTypeRoutes.post("/", createRecordType);
recordTypeRoutes.put("/:id", updateRecordType);
recordTypeRoutes.delete("/:id", deleteRecordType);

export default recordTypeRoutes;
