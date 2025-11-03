import cors from "cors";
import express, { type Request, type Response } from "express";
import type { Ride } from "../../../types/ride";
import prisma from "../../../services/db";
import { verifyDriver } from "../../middlewares/driver";
import { verifyRidePayload } from "../../middlewares/ride";
const app = express();
app.use(express.json());
app.use(cors());

app.post(
  "/",
  verifyDriver,
  verifyRidePayload,
  async (req: Request, res: Response) => {
    const payload: Ride = req.body;

    const newRide = await prisma.ride.create({
      data: {
        estimatedDistance: payload.estimatedDistance,
        estimatedDuration: payload.estimatedDuration,
        startLocationLat: payload.startLocationLat,
        startLocationLng: payload.startLocationLng,
        endLocationLat: payload.endLocationLat,
        endLocationLng: payload.endLocationLng,
        driverId: payload.driverId,
      },
    });

    if (!newRide) {
      return res.status(400).json({ message: "failed to create trip!" });
    }

    res.status(201).json({ message: "trip created successfully!" });
  },
);

export default app;
