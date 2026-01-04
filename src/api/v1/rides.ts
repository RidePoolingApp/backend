import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";
import { getSocketService } from "../../../services/socketInstance";

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
  const { type, pickup, drop, scheduledAt, estimatedFare, estimatedDistance } = req.body;

  console.log("Creating ride - received:", { 
    type, 
    estimatedFare, 
    estimatedDistance,
    hasPickup: !!pickup,
    hasDrop: !!drop
  });

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

  // Convert fare/distance to proper types
  const fareValue = typeof estimatedFare === 'number' ? estimatedFare : null;
  const distanceValue = typeof estimatedDistance === 'number' ? estimatedDistance : null;

  console.log("Creating ride with fare/distance:", { fareValue, distanceValue });

  const ride = await prisma.ride.create({
    data: {
      riderId: req.user!.id,
      type: type || "STANDARD",
      pickupId: pickupLocation.id,
      dropId: dropLocation.id,
      fare: fareValue,
      distance: distanceValue,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
    include: { pickup: true, drop: true, rider: true },
  });

  // Emit to all drivers about the new ride request
  try {
    const socketService = getSocketService();
    socketService.emitRideRequest(ride);
  } catch (e) {
    console.error("Socket service not available:", e);
  }

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

  // First, get the user's driver profile if they have one
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: req.user!.id },
  });

  // Allow ride to be viewed by rider OR assigned driver
  const ride = await prisma.ride.findFirst({
    where: {
      id,
      OR: [
        { riderId: req.user!.id }, // User is the rider
        { driverId: driverProfile?.id }, // User is the assigned driver
      ],
    },
    include: {
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
      rider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
        },
      },
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

// Request a ride from a specific driver
router.post("/request-driver", requireAuthentication, async (req, res) => {
  console.log("=== /request-driver RAW BODY ===");
  console.log("req.body:", JSON.stringify(req.body, null, 2));
  console.log("================================");
  
  const { driverId, pickupId, dropId, type, scheduledAt, estimatedFare, estimatedDistance } = req.body;

  console.log("Request driver ride - destructured:", { 
    driverId, 
    pickupId, 
    dropId, 
    type, 
    estimatedFare, 
    estimatedDistance,
    estimatedFareType: typeof estimatedFare,
    estimatedDistanceType: typeof estimatedDistance,
    userId: req.user?.id 
  });

  if (!driverId) {
    return res.status(400).json({ error: "driverId is required" });
  }

  if (!pickupId || !dropId) {
    return res.status(400).json({ error: "pickupId and dropId are required" });
  }

  // Verify driver exists and is online
  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    include: { user: true },
  });

  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }

  if (!driver.isOnline) {
    return res.status(400).json({ error: "Driver is not online" });
  }

  if (!driver.isVerified) {
    return res.status(400).json({ error: "Driver is not verified" });
  }

  // Verify locations exist
  const [pickup, drop] = await Promise.all([
    prisma.location.findUnique({ where: { id: pickupId } }),
    prisma.location.findUnique({ where: { id: dropId } }),
  ]);

  if (!pickup || !drop) {
    return res.status(404).json({ error: "Pickup or drop location not found" });
  }

  // Create the ride with PENDING status and assigned driver
  const fareValue = typeof estimatedFare === 'number' ? estimatedFare : null;
  const distanceValue = typeof estimatedDistance === 'number' ? estimatedDistance : null;
  
  console.log("Creating ride with fare/distance:", { fareValue, distanceValue });
  
  const ride = await prisma.ride.create({
    data: {
      riderId: req.user!.id,
      driverId: driverId,
      type: type || "STANDARD",
      pickupId: pickupId,
      dropId: dropId,
      fare: fareValue,
      distance: distanceValue,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      status: "PENDING",
    },
    include: {
      pickup: true,
      drop: true,
      rider: true,
      driver: {
        include: { user: true },
      },
    },
  });

  // Emit real-time notification to the specific driver
  try {
    const socketService = getSocketService();
    socketService.emitToDriver(driverId, "ride:request", {
      ride,
      message: "New ride request",
    });
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.status(201).json(ride);
});

// Get active ride for current user (rider)
router.get("/active", requireAuthentication, async (req, res) => {
  const ride = await prisma.ride.findFirst({
    where: {
      riderId: req.user!.id,
      status: { in: ["PENDING", "ACCEPTED", "ARRIVING", "STARTED"] },
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
          currentLocation: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(ride);
});

// Complete ride after payment (for mock/demo purposes)
router.put("/:id/complete-after-payment", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findFirst({
    where: { id, riderId: req.user!.id },
    include: { payment: true },
  });

  if (!ride) {
    return res.status(404).json({ error: "Ride not found" });
  }

  if (ride.status === "COMPLETED") {
    return res.status(400).json({ error: "Ride already completed" });
  }

  if (ride.status === "CANCELLED") {
    return res.status(400).json({ error: "Ride was cancelled" });
  }

  // Check if payment exists and is completed
  if (!ride.payment || ride.payment.status !== "COMPLETED") {
    return res.status(400).json({ error: "Payment not completed" });
  }

  // Calculate duration if we have startedAt
  const now = new Date();
  const duration = ride.startedAt 
    ? Math.round((now.getTime() - new Date(ride.startedAt).getTime()) / 60000)
    : 10; // default 10 minutes for mock

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      duration,
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
      rider: true,
      payment: true,
    },
  });

  // Create driver earning if driver exists
  if (updated.driverId && updated.fare) {
    console.log("Creating driver earning (complete-after-payment) - driverId:", updated.driverId, "amount:", updated.fare);
    const earning = await prisma.driverEarning.create({
      data: {
        driverId: updated.driverId,
        amount: updated.fare,
        type: "RIDE",
        description: `Ride ${id.slice(0, 8)}`,
      },
    });
    console.log("Created earning:", earning);

    // Update driver's total trips
    await prisma.driverProfile.update({
      where: { id: updated.driverId },
      data: { totalTrips: { increment: 1 } },
    });
  } else {
    console.log("Skipping earning creation - driverId:", updated.driverId, "fare:", updated.fare);
  }

  // Emit ride completed event
  try {
    const socketService = getSocketService();
    if (updated.driverId) {
      socketService.emitToDriver(updated.driverId, "ride:completed", updated);
    }
  } catch (e) {
    console.error("Socket service not available:", e);
  }

  res.json(updated);
});

export default router;
