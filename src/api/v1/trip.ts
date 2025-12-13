import cors from "cors";
import express from "express";
import type { LatLang } from "../../../types/ride";
const app = express();
app.use(express.json());
app.use(cors());

app.get("/search", async (req) => {
  const currLocation: LatLang = req.body.currLocation;
  console.log(currLocation);
});

export default app;
