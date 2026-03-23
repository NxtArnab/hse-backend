import checkRequiredFields from "../../utils/checkRequiredFields.js";
import User from "./user.model.js";
import { createUser, userExists } from "./user.service.js";

export async function handleGetAllUsers(req, res, next) {
  try {
    const query = req.query || {};
    const users = await User.find(query).select("-password -__v").lean();
    return res.json(users);
  } catch (err) {
    return next(err);
  }
}

export async function handleCreateUser(req, res, next) {
  try {
    const { name, email, password, roles, company } = req.body;

    checkRequiredFields({ name, email, password });

    if (await userExists(email)) {
      const error = new Error("User already exists");
      error.statusCode = 409;
      throw error;
    }

    const newUser = await createUser({ name, email, password, roles, company });

    return res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (err) {
    return next(err);
  }
}

export async function handleUpdateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, isAdmin, avatarUrl, isActive, roles } = req.body;

    checkRequiredFields({ id });

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = String(email).trim().toLowerCase();
    if (isAdmin !== undefined) updatePayload.isAdmin = isAdmin;
    if (avatarUrl !== undefined) updatePayload.avatarUrl = avatarUrl;
    if (isActive !== undefined) updatePayload.isActive = isActive;
    if (roles !== undefined) updatePayload.roles = Array.isArray(roles) ? roles : [];
    updatePayload.lastModifiedBy = req.user?.email || req.user?.id || "system";

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true },
    );

    if (!updatedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    return res.json({ message: "User updated successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function softDeleteUser(req, res, next) {
  try {
    const { id } = req.params;
    checkRequiredFields({ id });
    const deletedUser = await User.findByIdAndUpdate(
      id,
      {
        isActive: false,
        lastModifiedBy: req.user?.email || req.user?.id || "system",
      },
      { new: true },
    );
    if (!deletedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function hardDeleteUser(req, res, next) {
  try {
    const { id } = req.params;
    checkRequiredFields({ id });

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return res.json({ message: "User hard deleted successfully" });
  } catch (err) {
    return next(err);
  }
}
