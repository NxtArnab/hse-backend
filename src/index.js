import dotenv from "dotenv";
import router from "./routes.js";
import express from "express";
import cookieParser from "cookie-parser";
import initializeDB from "../utils/db.js";
import cors from "cors";

dotenv.config();

const corsOptions = {
  origin: ["http://localhost:3000"],
  credentials: true,
};

initializeDB();

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/", router);

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  console.error(`[Error] ${statusCode} - ${message}`);
  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
