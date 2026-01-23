import User from "./user.model.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return await bcrypt.hash(password, salt);
};

export const checkPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const userExists = async (email) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.exists({ email: normalizedEmail }).lean();
  return !!user;
};

export const getUserByEmail = async (email, hidePassword = false) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .select("-__v")
    .lean();

  if (hidePassword && user) {
    delete user.password;
  }

  return user;
};

export const createUser = async ({ name, email, password, roles }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const hashedPassword = await hashPassword(password);
  const user = new User({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    roles,
  });

  const newUser = await user.save();
  return {
    id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    roles: newUser.roles,
  };
};
