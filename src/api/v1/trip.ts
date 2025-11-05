import cors from "cors";
import express from "express";
import type { RideSearch } from "../../../types/ride";
const app = express();
app.use(express.json());
app.use(cors());

const getRides = async (rideSearch: RideSearch) => {};

app.get("/", (req, res) => {});

export default app;
