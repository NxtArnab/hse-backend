import express from "express";
import {
  getInvestigationOptions,
  createInvestigationOption,
  updateInvestigationOption,
  deleteInvestigationOption,
} from "./investigationOption.controller.js";
import { verify } from "../../middlewares/authentication.middleware.js";

const investigationOptionRoutes = express.Router();

investigationOptionRoutes.get("/", getInvestigationOptions);
investigationOptionRoutes.use(verify);
investigationOptionRoutes.post("/", createInvestigationOption);
investigationOptionRoutes.put("/:id", updateInvestigationOption);
investigationOptionRoutes.delete("/:id", deleteInvestigationOption);

export default investigationOptionRoutes;
