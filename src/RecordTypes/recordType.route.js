import express from "express";
import {
	createRecordType,
	deleteRecordType,
	getRecordTypes,
	updateRecordType,
} from "./recordType.controller.js";

const router = express.Router();

router.get("/", getRecordTypes);
router.post("/", createRecordType);
router.put("/:id", updateRecordType);
router.delete("/:id", deleteRecordType);

export default router;
