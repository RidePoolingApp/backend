import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication, requireDriver } from "../../middlewares/auth";
import { geoRedis } from "../../../services/redis";
import { getSocketService } from "../../../services/socketInstance";

const router = express.Router();

router.post("/register", requireAuthentication, async (req, res) => {
  try {
    const { licenseNumber, licenseExpiry, vehicleType, vehicleMake, vehicleModel, vehicleYear, vehicleColor, licensePlate } = req.body;

    console.log("Driver registration request:", { licenseNumber, vehicleType, vehicleMake, vehicleModel, vehicleYear, vehicleColor, licensePlate, userId: req.user?.id });

    if (!licenseNumber || !licenseExpiry || !vehicleType || !vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !licensePlate) {
      console.log("Missing fields in registration");
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingDriver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (existingDriver) {
      return res.status(400).json({ error: "Already registered as driver" });
    }

    // Check if license plate already exists
    const existingPlate = await prisma.driverProfile.findUnique({
      where: { licensePlate },
    });

    if (existingPlate) {
      return res.status(400).json({ error: "License plate already registered" });
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
        isVerified: true,
      },
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { role: "DRIVER" },
    });

    console.log("Driver registered successfully:", driver.id);
    res.status(201).json(driver);
  } catch (error: any) {
    console.error("Error registering driver:", error);
    res.status(500).json({ error: error.message || "Failed to register driver" });
  }
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

// Set driver's current location from database location
router.put("/current-location", requireAuthentication, requireDriver, async (req, res) => {
  const { locationId } = req.body;

  if (!locationId) {
    return res.status(400).json({ error: "locationId is required" });
  }

  // Verify location exists
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return res.status(404).json({ error: "Location not found" });
  }

  const driver = await prisma.driverProfile.update({
    where: { id: req.driver!.id },
    data: {
      currentLocationId: locationId,
      currentLat: location.lat,
      currentLng: location.lng,
    },
    include: { currentLocation: true },
  });

  // Update geo-redis if driver is online
  if (req.driver!.isOnline && location.lat && location.lng) {
    await geoRedis.geoadd("drivers:online", location.lng, location.lat, req.driver!.id);
  }

  res.json(driver);
});

// Update driver fare settings
router.put("/fare-settings", requireAuthentication, requireDriver, async (req, res) => {
  const { farePerKm, baseFare } = req.body;

  if (farePerKm === undefined && baseFare === undefined) {
    return res.status(400).json({ error: "farePerKm or baseFare is required" });
  }

  // Validate fare values
  if (farePerKm !== undefined && (farePerKm < 5 || farePerKm > 50)) {
    return res.status(400).json({ error: "Fare per km must be between ₹5 and ₹50" });
  }

  if (baseFare !== undefined && (baseFare < 10 || baseFare > 100)) {
    return res.status(400).json({ error: "Base fare must be between ₹10 and ₹100" });
  }

  const updateData: { farePerKm?: number; baseFare?: number } = {};
  if (farePerKm !== undefined) updateData.farePerKm = Number(farePerKm);
  if (baseFare !== undefined) updateData.baseFare = Number(baseFare);

  const driver = await prisma.driverProfile.update({
    where: { id: req.driver!.id },
    data: updateData,
    include: { currentLocation: true },
  });

  res.json(driver);
});

// Get available drivers at a specific location
router.get("/available", requireAuthentication, async (req, res) => {
  const { locationId, city, state, district } = req.query;

  const where: {
    isOnline: boolean;
    isVerified: boolean;
    currentLocationId?: string | { not: null };
    currentLocation?: {
      city?: { equals: string; mode: "insensitive" };
      state?: { equals: string; mode: "insensitive" };
      district?: { equals: string; mode: "insensitive" };
    };
  } = {
    isOnline: true,
    isVerified: true,
    currentLocationId: { not: null },
  };

  if (locationId) {
    where.currentLocationId = String(locationId);
  } else if (city || state || district) {
    where.currentLocation = {};
    if (city) where.currentLocation.city = { equals: String(city), mode: "insensitive" };
    if (state) where.currentLocation.state = { equals: String(state), mode: "insensitive" };
    if (district) where.currentLocation.district = { equals: String(district), mode: "insensitive" };
  }

  const drivers = await prisma.driverProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
        },
      },
      currentLocation: true,
    },
    orderBy: { rating: "desc" },
  });

  res.json(drivers);
});

router.get("/jobs", requireAuthentication, requireDriver, async (req, res) => {
  // Get pending rides (both general and specifically requested from this driver)
  const rides = await prisma.ride.findMany({
    where: {
      status: "PENDING",
      OR: [
        { driverId: null }, // General rides anyone can accept
        { driverId: req.driver!.id }, // Rides specifically requested from this driver
      ],
    },
    include: {
      rider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
        },
      },
      pickup: true,
      drop: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json(rides);
});

// Get pending ride requests specifically for this driver
router.get("/requests", requireAuthentication, requireDriver, async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: {
      status: "PENDING",
      driverId: req.driver!.id,
    },
    include: {
      rider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
        },
      },
      pickup: true,
      drop: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(rides);
});

router.post("/jobs/:id/accept", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: {
      id,
      status: "PENDING",
      OR: [
        { driverId: null },
        { driverId: req.driver!.id },
      ],
    },
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
    include: {
      pickup: true,
      drop: true,
      rider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
        },
      },
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              profileImage: true,
            },
          },
          currentLocation: true,
        },
      },
    },
  });

  // Notify rider that driver accepted
  try {
    const socketService = getSocketService();
    socketService.emitToRider(ride.riderId, "ride:accepted", {
      ride: updated,
      message: "Driver accepted your ride request",
    });
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.json(updated);
});

// Reject a ride request
router.post("/jobs/:id/reject", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ride = await prisma.ride.findFirst({
    where: {
      id,
      status: "PENDING",
      driverId: req.driver!.id, // Can only reject rides specifically assigned to them
    },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found or not assigned to you" });
  }

  // Remove driver assignment and keep as pending for others
  const updated = await prisma.ride.update({
    where: { id },
    data: {
      driverId: null,
      cancelReason: reason ? `Driver rejected: ${reason}` : "Driver rejected",
    },
    include: {
      pickup: true,
      drop: true,
    },
  });

  // Notify rider that driver rejected
  try {
    const socketService = getSocketService();
    socketService.emitToRider(ride.riderId, "ride:rejected", {
      ride: updated,
      message: "Driver rejected your ride request",
      reason: reason,
    });
    // Also broadcast to other drivers
    socketService.emitRideRequest(updated);
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.json({ success: true, message: "Ride request rejected" });
});

// Update ride status to ARRIVING (driver is on the way to pickup)
router.put("/rides/:id/arriving", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: { id, driverId: req.driver!.id, status: "ACCEPTED" },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found or not in accepted state" });
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: { status: "ARRIVING" },
    include: {
      pickup: true,
      drop: true,
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              profileImage: true,
            },
          },
          currentLocation: true,
        },
      },
    },
  });

  // Notify rider
  try {
    const socketService = getSocketService();
    socketService.emitToRider(ride.riderId, "ride:arriving", {
      ride: updated,
      message: "Driver is on the way",
    });
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.json(updated);
});

router.put("/rides/:id/start", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: { id, driverId: req.driver!.id, status: { in: ["ACCEPTED", "ARRIVING"] } },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found or not in accepted/arriving state" });
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: "STARTED",
      startedAt: new Date(),
    },
    include: {
      pickup: true,
      drop: true,
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              profileImage: true,
            },
          },
        },
      },
    },
  });

  // Notify rider
  try {
    const socketService = getSocketService();
    socketService.emitToRider(ride.riderId, "ride:started", {
      ride: updated,
      message: "Your ride has started",
    });
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.json(updated);
});

router.put("/rides/:id/complete", requireAuthentication, requireDriver, async (req, res) => {
  const { id } = req.params;
  const { distance, fare } = req.body;

  console.log("Complete ride request - id:", id, "body fare:", fare, "body distance:", distance);

  const ride = await prisma.ride.findFirst({
    where: { id, driverId: req.driver!.id, status: "STARTED" },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found or not started" });
  }

  console.log("Found ride - ride.fare:", ride.fare, "ride.distance:", ride.distance);

  // Use the fare from request body, or fall back to existing ride fare
  const finalFare = fare ?? ride.fare;
  const finalDistance = distance ?? ride.distance;

  console.log("Final values - finalFare:", finalFare, "finalDistance:", finalDistance);

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      distance: finalDistance,
      fare: finalFare,
      duration: Math.round((Date.now() - ride.startedAt!.getTime()) / 60000),
    },
    include: {
      pickup: true,
      drop: true,
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              profileImage: true,
            },
          },
        },
      },
    },
  });

  // Only create earning if we have a valid fare amount
  if (finalFare && finalFare > 0) {
    console.log("Creating driver earning with amount:", finalFare);
    const earning = await prisma.driverEarning.create({
      data: {
        driverId: req.driver!.id,
        amount: finalFare,
        type: "RIDE",
        description: `Ride ${id.slice(0, 8)}`,
      },
    });
    console.log("Created earning:", earning);
  } else {
    console.log("Skipping earning creation - finalFare is:", finalFare);
  }

  await prisma.driverProfile.update({
    where: { id: req.driver!.id },
    data: { totalTrips: { increment: 1 } },
  });

  // Notify rider
  try {
    const socketService = getSocketService();
    socketService.emitToRider(ride.riderId, "ride:completed", {
      ride: updated,
      message: "Your ride has been completed",
    });
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.json(updated);
});

router.get("/earnings", requireAuthentication, requireDriver, async (req, res) => {
  const { from, to } = req.query;

  const where: { driverId: string; date?: { gte?: Date; lte?: Date } } = { driverId: req.driver!.id };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from as string);
    if (to) {
      // Set to end of day (23:59:59.999) to include all earnings for that day
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      where.date.lte = toDate;
    }
  }

  console.log("Fetching earnings for driver:", req.driver!.id, "with filter:", where);

  const earnings = await prisma.driverEarning.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const total = await prisma.driverEarning.aggregate({
    where,
    _sum: { amount: true },
  });

  console.log("Found earnings:", earnings.length, "total:", total._sum.amount);

  res.json({ earnings, total: total._sum.amount || 0 });
});

router.get("/rides/history", requireAuthentication, requireDriver, async (req, res) => {
  const { page = "1", limit = "10", status } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: any = { driverId: req.driver!.id };
  if (status && status !== "All") {
    where.status = status as string;
  }

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      where,
      include: { 
        rider: true, 
        pickup: true, 
        drop: true,
        rating: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum,
    }),
    prisma.ride.count({ where }),
  ]);

  res.json({ rides, total, page: pageNum, limit: limitNum });
});

router.get("/ratings", requireAuthentication, requireDriver, async (req, res) => {
  const ratings = await prisma.rating.findMany({
    where: { driverId: req.driver!.id },
    include: { 
      ride: { include: { rider: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalReviews = ratings.length;
  const avgRating = totalReviews > 0 
    ? ratings.reduce((sum, r) => sum + r.score, 0) / totalReviews 
    : 5;

  const ratingCounts: number[] = [0, 0, 0, 0, 0];
  ratings.forEach(r => {
    if (r.score >= 1 && r.score <= 5) {
      ratingCounts[r.score - 1] = (ratingCounts[r.score - 1] || 0) + 1;
    }
  });

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    percentage: totalReviews > 0 ? ((ratingCounts[star - 1] || 0) / totalReviews) * 100 : 0,
  }));

  const reviews = ratings.slice(0, 20).map(r => ({
    stars: r.score,
    name: r.ride?.rider ? `${r.ride.rider.firstName || ""} ${r.ride.rider.lastName || ""}`.trim() || "Anonymous" : "Anonymous",
    msg: r.comment || "",
    date: r.createdAt.toISOString().split("T")[0],
  }));

  res.json({
    rating: Math.round(avgRating * 10) / 10,
    totalReviews,
    ratingBreakdown,
    reviews,
  });
});

export default router;
