import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

router.post("/subscribe", requireAuthentication, async (req, res) => {
  const { pickup, drop, pickupTime, daysOfWeek, startDate, endDate, fare } = req.body;

  if (!pickup?.address || !pickup?.pincode || pickup?.lat === undefined || pickup?.lng === undefined) {
    return res.status(400).json({ error: "pickup (address, pincode, lat, lng) is required" });
  }
  if (!drop?.address || !drop?.pincode || drop?.lat === undefined || drop?.lng === undefined) {
    return res.status(400).json({ error: "drop (address, pincode, lat, lng) is required" });
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

  const pickupPoint = await prisma.boardingPoint.create({
    data: {
      address: pickup.address,
      pincode: pickup.pincode,
      landmark: pickup.landmark,
      lat: pickup.lat,
      lng: pickup.lng,
    },
  });

  const dropPoint = await prisma.boardingPoint.create({
    data: {
      address: drop.address,
      pincode: drop.pincode,
      landmark: drop.landmark,
      lat: drop.lat,
      lng: drop.lng,
    },
  });

  const subscription = await prisma.dailyCabSubscription.create({
    data: {
      userId: req.user!.id,
      pickupId: pickupPoint.id,
      dropId: dropPoint.id,
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
