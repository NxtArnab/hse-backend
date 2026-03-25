import express from "express";
import {
  createInvestigationOption,
  deleteInvestigationOption,
  getInvestigationOptions,
  updateInvestigationOption,
} from "./investigationOption.controller.js";

const router = express.Router();

router.get("/", getInvestigationOptions);
router.post("/", createInvestigationOption);
router.put("/:id", updateInvestigationOption);
router.delete("/:id", deleteInvestigationOption);

export default router;
