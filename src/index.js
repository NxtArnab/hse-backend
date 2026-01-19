import mongoose from "mongoose";
import dotenv from "dotenv";
import { COLLECTION_CREATE } from "./constant.js";
import router from "./routes.js";
import express from "express";

dotenv.config({ quiet: true });

mongoose
  .connect(`${process.env.BASE_URL}/${COLLECTION_CREATE}`)
  .then(() => {
    console.log("Database Connected");
  })
  .catch((err) => {
    console.log(err);
  });

const app = express();
app.use(express.json());

app.use("/api/v1/", router);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
