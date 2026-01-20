import mongoose from "mongoose";
import { COLLECTION_CREATE } from "../src/constant.js";

const initializeDB = () =>
  mongoose
    .connect(`${process.env.BASE_URL}/${COLLECTION_CREATE}`)
    .then(() => {
      console.log("Database Connected");
    })
    .catch((err) => {
      console.log(err);
    });

export default initializeDB;
