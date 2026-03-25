import express from "express";
import {
  handleCreateUser,
  softDeleteUser,
  handleUpdateUser,
  handleGetAllUsers,
  hardDeleteUser,
} from "./user.controller.js";
import { verify } from "../middlewares/authentication.middleware.js";

const userRouter = express.Router();

// All user routes require authentication

userRouter.get("/all", verify, handleGetAllUsers); // /api/v1/user/all
userRouter.post("/create-user", handleCreateUser);
userRouter.put("/update-user/:id", verify, handleUpdateUser);
userRouter.patch("/soft-delete/:id", verify, softDeleteUser);
userRouter.delete("/:id", verify, hardDeleteUser);

export default userRouter;
