import express from "express";
import {
  handleCreateUser,
  softDeleteUser,
  handleUpdateUser,
  handleGetAllUsers,
  hardDeleteUser,
} from "./user.controller.js";

const userRouter = express.Router();

userRouter.get("/all", handleGetAllUsers); // /api/user/all
userRouter.post("/create-user", handleCreateUser);
userRouter.put("/update-user/:id", handleUpdateUser);
userRouter.patch("/soft-delete/:id", softDeleteUser);
userRouter.delete("/:id", hardDeleteUser);

export default userRouter;
