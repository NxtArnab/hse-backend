import express from "express";
import {
  handleGetCurrentUser,
  handleLoginUser,
  handleLogoutUser,
} from "./auth.controller.js";
import { verify } from "../middlewares/authentication.middleware.js";
const authRouter = express.Router();

authRouter.post("/login", handleLoginUser); // /api/v1/auth/login
authRouter.post("/logout", verify, handleLogoutUser); // /api/v1/auth/logout
authRouter.get("/get-current-user", verify, handleGetCurrentUser);

export default authRouter;
