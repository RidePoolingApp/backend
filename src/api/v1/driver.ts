import cors from "cors";
import express, { type Request, type Response } from "express";
import prisma from "../../../services/db";
import {
  verifyDriver,
  verifyDriverDocumentSchema,
  verifyDriverRegisterSchema,
} from "../../middlewares/driver";
const app = express();
app.use(express.json());
app.use(cors());

app.post(
  "/",
  verifyDriverRegisterSchema,
  async (req: Request, res: Response) => {
    const { userId, currentLocationLat, currentLocationLng } = req.body;
    try {
      const driver = await prisma.driver.create({
        data: {
          userId,
          currentLocationLat,
          currentLocationLng,
        },
      });
      if (!driver) {
        console.log("error creating driver");
      } else {
        res.status(201).json({
          message: "Registered as driver successfully",
        });
      }
    } catch (err) {
      console.log("failed to register driver  ", err);
    }
  },
);

app.post(
  "/documents",
  verifyDriver,
  verifyDriverDocumentSchema,
  async (req: Request, res: Response) => {
    try {
      const { driverId, adhaarCard, driverLicense } = req.body;

      const AdhaarCard = await prisma.aadharCard.create({
        data: {
          adhaarNumber: adhaarCard.adhaarNumber,
          name: adhaarCard.name,
        },
      });

      const DL = await prisma.driverLicense.create({
        data: {
          DLNumber: driverLicense.DLNumber,
          DOB: driverLicense.DOB,
        },
      });

      if (AdhaarCard.id && DL.id) {
        const driverDocument = await prisma.driverDocuments.create({
          data: {
            driverId,
            aadharCardId: AdhaarCard.id,
            driverLicenseId: DL.id,
          },
        });

        if (!driverDocument) {
          return res
            .status(400)
            .json({ message: "failed to upload driver document" });
        }
      }
      res.status(201).json({
        message: "uploaded successfully, forwarding for verification!",
      });
    } catch (err) {
      console.log("error uploading driver documents", err);
    }
  },
);

app.post("/ride", verifyDriver, async (req: Request, res: Response) => {
  try {
    const ride = await prisma.ride.create({
      data: {
        driverId: req.body.driverId,
        startLocationLat: req.body.startLocationLat,
        startLocationLng: req.body.startLocationLng,
        endLocationLat: req.body.endLocationLat,
        endLocationLng: req.body.endLocationLng,
      },
    });
    if (!ride) {
      return res.status(400).json({ message: "failed to create ride!" });
    }
    res.status(201).json({ message: "Ride created successfully!" });
  } catch (err) {
    console.log("error creating ride", err);
  }
});

export default app;
