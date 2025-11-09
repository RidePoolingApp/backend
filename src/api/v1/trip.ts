import cors from "cors";
import express from "express";
import type { LatLang, RideSearch } from "../../../types/ride";
const app = express();
app.use(express.json());
app.use(cors());

const getRides = async (rideSearch: RideSearch) => {};

app.get("/search", async (req, res) => {
  const currLocation: LatLang = req.body.currLocation;
});

export default app;
