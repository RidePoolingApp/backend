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

router.post("/search", requireAuthentication, async (req, res) => {
  const { routeStart, routeEnd, departureTime, seats = 1 } = req.body;

  if (!routeStart || !routeEnd || !departureTime) {
    return res.status(400).json({ error: "routeStart, routeEnd, and departureTime are required" });
  }

  const startTime = new Date(departureTime);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

  const rides = await prisma.sharedRide.findMany({
    where: {
      status: "PENDING",
      routeStart: { address: { contains: routeStart, mode: "insensitive" } },
      routeEnd: { address: { contains: routeEnd, mode: "insensitive" } },
      departureTime: { gte: startTime, lte: endTime },
      availableSeats: { gte: Number(seats) },
    },
    include: {
      passengers: true,
      routeStart: true,
      routeEnd: true,
    },
    orderBy: { departureTime: "asc" },
  });

  res.json(rides);
});

router.post("/join", requireAuthentication, async (req, res) => {
  const { sharedRideId, pickup, drop, seats = 1 } = req.body;

  if (!sharedRideId || !pickup?.address || !pickup?.pincode || !pickup?.locationName || !pickup?.state || !pickup?.district || !pickup?.city) {
    return res.status(400).json({ error: "sharedRideId and pickup (address, pincode, locationName, state, district, city) are required" });
  }
  if (!drop?.address || !drop?.pincode || !drop?.locationName || !drop?.state || !drop?.district || !drop?.city) {
    return res.status(400).json({ error: "drop (address, pincode, locationName, state, district, city) is required" });
  }

  const ride = await prisma.sharedRide.findUnique({ where: { id: sharedRideId } });

  if (!ride) {
    return res.status(404).json({ error: "Shared ride not found" });
  }

  if (ride.availableSeats < seats) {
    return res.status(400).json({ error: "Not enough seats available" });
  }

  const existingPassenger = await prisma.sharedRidePassenger.findFirst({
    where: { sharedRideId, userId: req.user!.id },
  });

  if (existingPassenger) {
    return res.status(400).json({ error: "Already joined this ride" });
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

  const passenger = await prisma.sharedRidePassenger.create({
    data: {
      sharedRideId,
      userId: req.user!.id,
      pickupId: pickupLocation.id,
      dropId: dropLocation.id,
      seats: Number(seats),
    },
    include: { pickup: true, drop: true },
  });

  await prisma.sharedRide.update({
    where: { id: sharedRideId },
    data: { availableSeats: ride.availableSeats - Number(seats) },
  });

  res.status(201).json(passenger);
});

router.get("/matches", requireAuthentication, async (req, res) => {
  const passengers = await prisma.sharedRidePassenger.findMany({
    where: { userId: req.user!.id },
    include: {
      pickup: true,
      drop: true,
      sharedRide: {
        include: {
          routeStart: true,
          routeEnd: true,
          passengers: {
            include: {
              user: true,
              pickup: true,
              drop: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(passengers);
});

router.delete("/:id/leave", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  const passenger = await prisma.sharedRidePassenger.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!passenger) {
    return res.status(404).json({ error: "Not found" });
  }

  if (passenger.status !== "PENDING" && passenger.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Cannot leave at this stage" });
  }

  await prisma.sharedRide.update({
    where: { id: passenger.sharedRideId },
    data: { availableSeats: { increment: passenger.seats } },
  });

  await prisma.sharedRidePassenger.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  res.status(204).send();
});

export default router;
