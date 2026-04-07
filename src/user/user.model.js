import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    pin: { type: String },
    roles: { type: [String], default: ["user"] },
    lastModifiedBy: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    avatarUrl: { type: String },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", UserSchema);

export default User;
