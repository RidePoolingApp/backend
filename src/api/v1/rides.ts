import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

const getOrCreateLocation = async (data: {
  state: string;
  district: string;
  city: string;
  locationName: string;
  address: string;
  pincode: string;
  landmark?: string;
  lat?: number;
  lng?: number;
}) => {
  return prisma.location.upsert({
    where: {
      state_district_city_locationName: {
        state: data.state,
        district: data.district,
        city: data.city,
        locationName: data.locationName,
      },
    },
    update: {},
    create: data,
  });
};

router.post("/", requireAuthentication, async (req, res) => {
  const { type, pickup, drop, scheduledAt } = req.body;

  if (!pickup?.address || !pickup?.pincode || !pickup?.locationName || !pickup?.state || !pickup?.district || !pickup?.city) {
    return res.status(400).json({ error: "Pickup address, pincode, locationName, state, district, city are required" });
  }
  if (!drop?.address || !drop?.pincode || !drop?.locationName || !drop?.state || !drop?.district || !drop?.city) {
    return res.status(400).json({ error: "Drop address, pincode, locationName, state, district, city are required" });
  }

  const pickupLocation = await getOrCreateLocation({
    state: pickup.state,
    district: pickup.district,
    city: pickup.city,
    locationName: pickup.locationName,
    address: pickup.address,
    pincode: pickup.pincode,
    landmark: pickup.landmark,
    lat: pickup.lat,
    lng: pickup.lng,
  });

  const dropLocation = await getOrCreateLocation({
    state: drop.state,
    district: drop.district,
    city: drop.city,
    locationName: drop.locationName,
    address: drop.address,
    pincode: drop.pincode,
    landmark: drop.landmark,
    lat: drop.lat,
    lng: drop.lng,
  });

  const ride = await prisma.ride.create({
    data: {
      riderId: req.user!.id,
      type: type || "STANDARD",
      pickupId: pickupLocation.id,
      dropId: dropLocation.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
    include: { pickup: true, drop: true },
  });

  res.status(201).json(ride);
});

router.get("/history", requireAuthentication, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const rides = await prisma.ride.findMany({
    where: { riderId: req.user!.id },
    include: {
      driver: true,
      rating: true,
      pickup: true,
      drop: true,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: Number(limit),
  });

  const total = await prisma.ride.count({ where: { riderId: req.user!.id } });

  res.json({ rides, total, page: Number(page), limit: Number(limit) });
});

router.get("/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: { id, riderId: req.user!.id },
    include: {
      driver: true,
      rating: true,
      payment: true,
      pickup: true,
      drop: true,
    },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found" });
  }

  res.json(ride);
});

router.put("/:id/cancel", requireAuthentication, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ride = await prisma.ride.findFirst({
    where: { id, riderId: req.user!.id },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found" });
  }

  if (ride.status === "COMPLETED" || ride.status === "CANCELLED") {
    return res.status(400).json({ error: "Cannot cancel this ride" });
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  res.json(updated);
});

router.post("/:id/rate", requireAuthentication, async (req, res) => {
  const id = req.params.id;
  const { score, comment } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Ride ID is required" });
  }

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: "Score must be between 1 and 5" });
  }

  const ride = await prisma.ride.findFirst({
    where: { id, riderId: req.user!.id, status: "COMPLETED" },
  });

  if (!ride) {
    return res.status(404).json({ error: "Completed ride not found" });
  }

  if (!ride.driverId) {
    return res.status(400).json({ error: "Ride has no driver" });
  }

  const existingRating = await prisma.rating.findUnique({ where: { rideId: id } });
  if (existingRating) {
    return res.status(400).json({ error: "Ride already rated" });
  }

  const rating = await prisma.rating.create({
    data: {
      rideId: id,
      raterId: req.user!.id,
      driverId: ride.driverId,
      score,
      comment,
    },
  });

  const avgRating = await prisma.rating.aggregate({
    where: { driverId: ride.driverId },
    _avg: { score: true },
  });

  await prisma.driverProfile.update({
    where: { id: ride.driverId },
    data: { rating: avgRating._avg.score || 5 },
  });

  res.status(201).json(rating);
});

export default router;
