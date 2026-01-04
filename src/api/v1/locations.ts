import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

router.get("/", requireAuthentication, async (req, res) => {
  const { state, district, city, search, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    ...(state && { state: { equals: String(state), mode: "insensitive" as const } }),
    ...(district && { district: { equals: String(district), mode: "insensitive" as const } }),
    ...(city && { city: { equals: String(city), mode: "insensitive" as const } }),
    ...(search && {
      OR: [
        { locationName: { contains: String(search), mode: "insensitive" as const } },
        { address: { contains: String(search), mode: "insensitive" as const } },
        { city: { contains: String(search), mode: "insensitive" as const } },
      ],
    }),
  };

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where,
      orderBy: [{ state: "asc" }, { district: "asc" }, { city: "asc" }, { locationName: "asc" }],
      skip,
      take: Number(limit),
    }),
    prisma.location.count({ where }),
  ]);

  res.json({ locations, total, page: Number(page), limit: Number(limit) });
});

router.get("/states", requireAuthentication, async (_req, res) => {
  const states = await prisma.location.findMany({
    select: { state: true },
    distinct: ["state"],
    orderBy: { state: "asc" },
  });

  res.json(states.map((s) => s.state));
});

router.get("/districts", requireAuthentication, async (req, res) => {
  const { state } = req.query;

  if (!state) {
    return res.status(400).json({ error: "state is required" });
  }

  const districts = await prisma.location.findMany({
    where: { state: { equals: String(state), mode: "insensitive" } },
    select: { district: true },
    distinct: ["district"],
    orderBy: { district: "asc" },
  });

  res.json(districts.map((d) => d.district));
});

router.get("/cities", requireAuthentication, async (req, res) => {
  const { state, district } = req.query;

  if (!state || !district) {
    return res.status(400).json({ error: "state and district are required" });
  }

  const cities = await prisma.location.findMany({
    where: {
      state: { equals: String(state), mode: "insensitive" },
      district: { equals: String(district), mode: "insensitive" },
    },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  res.json(cities.map((c) => c.city));
});

router.get("/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  const location = await prisma.location.findUnique({ where: { id } });

  if (!location) {
    return res.status(404).json({ error: "Location not found" });
  }

  res.json(location);
});

router.post("/", requireAuthentication, async (req, res) => {
  const { state, district, city, locationName, address, pincode, landmark, lat, lng } = req.body;

  if (!state || !district || !city || !locationName || !address || !pincode) {
    return res.status(400).json({ error: "state, district, city, locationName, address, pincode are required" });
  }

  const existing = await prisma.location.findUnique({
    where: { state_district_city_locationName: { state, district, city, locationName } },
  });

  if (existing) {
    return res.status(409).json({ error: "Location already exists", location: existing });
  }

  const location = await prisma.location.create({
    data: { state, district, city, locationName, address, pincode, landmark, lat, lng },
  });

  res.status(201).json(location);
});

router.put("/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;
  const { state, district, city, locationName, address, pincode, landmark, lat, lng } = req.body;

  const existing = await prisma.location.findUnique({ where: { id } });

  if (!existing) {
    return res.status(404).json({ error: "Location not found" });
  }

  const location = await prisma.location.update({
    where: { id },
    data: {
      ...(state !== undefined && { state }),
      ...(district !== undefined && { district }),
      ...(city !== undefined && { city }),
      ...(locationName !== undefined && { locationName }),
      ...(address !== undefined && { address }),
      ...(pincode !== undefined && { pincode }),
      ...(landmark !== undefined && { landmark }),
      ...(lat !== undefined && { lat }),
      ...(lng !== undefined && { lng }),
    },
  });

  res.json(location);
});

router.delete("/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.location.findUnique({ where: { id } });

  if (!existing) {
    return res.status(404).json({ error: "Location not found" });
  }

  await prisma.location.delete({ where: { id } });

  res.status(204).send();
});

export default router;
