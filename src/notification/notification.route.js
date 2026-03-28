import express from "express";
import {
  deleteAllNotifications,
  deleteMultipleNotifications,
  deleteNotification,
  getMyNotifications,
  markAllAsRead,
  markAsRead,
} from "./notification.controller.js";
import { verify } from "../middlewares/authentication.middleware.js";

const notificationRouter = express.Router();

notificationRouter.use(verify);

notificationRouter.get("/", getMyNotifications);
notificationRouter.patch("/read-all", markAllAsRead);
notificationRouter.patch("/:id/read", markAsRead);
notificationRouter.delete("/delete-all", deleteAllNotifications);
notificationRouter.delete("/delete-multiple", deleteMultipleNotifications);
notificationRouter.delete("/:id", deleteNotification);

export default notificationRouter;