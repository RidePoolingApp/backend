import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication, requireDriver } from "../../middlewares/auth";
import { geoRedis } from "../../../services/redis";

const router = express.Router();

router.post("/register", requireAuthentication, async (req, res) => {
  const { licenseNumber, licenseExpiry, vehicleType, vehicleMake, vehicleModel, vehicleYear, vehicleColor, licensePlate } = req.body;

  if (!licenseNumber || !licenseExpiry || !vehicleType || !vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !licensePlate) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const existingDriver = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
  });

  if (existingDriver) {
    return res.status(400).json({ error: "Already registered as driver" });
  }

  const driver = await prisma.driverProfile.create({
    data: {
      userId: req.user!.id,
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      vehicleType,
      vehicleMake,
      vehicleModel,
      vehicleYear: Number(vehicleYear),
      vehicleColor,
      licensePlate,
    },
  });

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { role: "DRIVER" },
  });

  res.status(201).json(driver);
});

router.put("/availability", requireAuthentication, requireDriver, async (req, res) => {
  const { isOnline } = req.body;

  const driver = await prisma.driverProfile.update({
    where: { id: req.driver!.id },
    data: { isOnline: Boolean(isOnline) },
  });

  if (!isOnline) {
    await geoRedis.zrem("drivers:online", req.driver!.id);
  }

  res.json(driver);
});

router.put("/location", requireAuthentication, requireDriver, async (req, res) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  await prisma.driverProfile.update({
    where: { id: req.driver!.id },
    data: { currentLat: lat, currentLng: lng },
  });

  if (req.driver!.isOnline) {
    await geoRedis.geoadd("drivers:online", lng, lat, req.driver!.id);
  }

  res.json({ success: true });
});

router.get("/jobs", requireAuthentication, requireDriver, async (req, res) => {
  if (!req.driver!.currentLat || !req.driver!.currentLng) {
    return res.status(400).json({ error: "Location not set" });
  }

  const rides = await prisma.ride.findMany({
    where: {
      status: "PENDING",
      driverId: null,
    },
    include: { rider: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  res.json(rides);
});

router.post("/jobs/:id/accept", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: { id, status: "PENDING", driverId: null },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not available" });
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      driverId: req.driver!.id,
      status: "ACCEPTED",
    },
  });

  res.json(updated);
});

router.put("/rides/:id/start", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: { id, driverId: req.driver!.id, status: "ACCEPTED" },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found or not in accepted state" });
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: "STARTED",
      startedAt: new Date(),
    },
  });

  res.json(updated);
});

router.put("/rides/:id/complete", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;
  const { distance, fare } = req.body;

  const ride = await prisma.ride.findFirst({
    where: { id, driverId: req.driver!.id, status: "STARTED" },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found or not started" });
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      distance,
      fare,
      duration: Math.round((Date.now() - ride.startedAt!.getTime()) / 60000),
    },
  });

  await prisma.driverEarning.create({
    data: {
      driverId: req.driver!.id,
      amount: fare,
      type: "RIDE",
      description: `Ride ${id}`,
    },
  });

  await prisma.driverProfile.update({
    where: { id: req.driver!.id },
    data: { totalTrips: { increment: 1 } },
  });

  res.json(updated);
});

router.get("/earnings", requireAuthentication, requireDriver, async (req, res) => {
  const { from, to } = req.query;

  const where: { driverId: string; date?: { gte?: Date; lte?: Date } } = { driverId: req.driver!.id };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from as string);
    if (to) where.date.lte = new Date(to as string);
  }

  const earnings = await prisma.driverEarning.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const total = await prisma.driverEarning.aggregate({
    where,
    _sum: { amount: true },
  });

  res.json({ earnings, total: total._sum.amount || 0 });
});

export default router;
