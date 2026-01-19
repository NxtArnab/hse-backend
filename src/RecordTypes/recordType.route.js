import express from "express";
import { getRecordTypes } from "./recordType.controller.js";

const router = express.Router();

router.get("/", getRecordTypes);

export default router;
