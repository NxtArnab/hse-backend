import jwt from "jsonwebtoken";
import { checkPassword, getUserByEmail } from "../user/user.service.js";

export async function handleLoginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error("Email and password are required");
      error.statusCode = 400;
      throw error;
    }

    const user = await getUserByEmail(String(email).trim().toLowerCase());
    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await checkPassword(password, user.password);
    if (!isPasswordValid) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        isAdmin: user.isAdmin,
        company: user.company?._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set HTTP-only cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    delete user.password; 
    
    return res.status(200).json({
      message: "Login successful",
      user,
    });
  } catch (err) {
    return next(err);
  }
}

export async function handleLogoutUser(req, res, next) {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res.json({ message: "Logout successful" });
  } catch (err) {
    return next(err);
  }
}

export async function handleGetCurrentUser(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const returnUser = await getUserByEmail(user.email, true);
    return res.json(returnUser);
  } catch (err) {
    return next(err);
  }
}
