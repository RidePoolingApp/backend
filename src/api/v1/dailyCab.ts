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

router.post("/subscribe", requireAuthentication, async (req, res) => {
  const { pickup, drop, pickupTime, daysOfWeek, startDate, endDate, fare } = req.body;

  if (!pickup?.address || !pickup?.pincode || !pickup?.locationName || !pickup?.state || !pickup?.district || !pickup?.city) {
    return res.status(400).json({ error: "pickup (address, pincode, locationName, state, district, city) is required" });
  }
  if (!drop?.address || !drop?.pincode || !drop?.locationName || !drop?.state || !drop?.district || !drop?.city) {
    return res.status(400).json({ error: "drop (address, pincode, locationName, state, district, city) is required" });
  }
  if (!pickupTime || !daysOfWeek || !startDate || !endDate || fare === undefined) {
    return res.status(400).json({ error: "pickupTime, daysOfWeek, startDate, endDate, fare are required" });
  }

  const existingActive = await prisma.dailyCabSubscription.findFirst({
    where: { userId: req.user!.id, status: "ACTIVE" },
  });

  if (existingActive) {
    return res.status(400).json({ error: "Already have an active subscription" });
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

  const subscription = await prisma.dailyCabSubscription.create({
    data: {
      userId: req.user!.id,
      pickupId: pickupLocation.id,
      dropId: dropLocation.id,
      pickupTime,
      daysOfWeek,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      fare,
    },
    include: { pickup: true, drop: true },
  });

  res.status(201).json(subscription);
});

router.get("/subscription", requireAuthentication, async (req, res) => {
  const subscription = await prisma.dailyCabSubscription.findFirst({
    where: { userId: req.user!.id, status: "ACTIVE" },
    include: { pickup: true, drop: true },
  });

  if (!subscription) {
    return res.status(404).json({ error: "No active subscription" });
  }

  res.json(subscription);
});

router.put("/subscription/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;
  const { pickupTime, daysOfWeek, endDate, status } = req.body;

  const subscription = await prisma.dailyCabSubscription.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!subscription) {
    return res.status(404).json({ error: "Subscription not found" });
  }

  const updated = await prisma.dailyCabSubscription.update({
    where: { id },
    data: {
      ...(pickupTime !== undefined && { pickupTime }),
      ...(daysOfWeek !== undefined && { daysOfWeek }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(status !== undefined && { status }),
    },
  });

  res.json(updated);
});

router.delete("/subscription/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  const subscription = await prisma.dailyCabSubscription.findFirst({
    where: { id, userId: req.user!.id },
  });

  if (!subscription) {
    return res.status(404).json({ error: "Subscription not found" });
  }

  await prisma.dailyCabSubscription.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  res.status(204).send();
});

export default router;
