import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

const excludePassword = <T extends { password: string }>(user: T): Omit<T, "password"> => {
  const { password, ...rest } = user;
  void password;
  return rest;
};

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

router.get("/profile", requireAuthentication, async (req, res) => {
  res.json(excludePassword(req.user!));
});

router.put("/profile", requireAuthentication, async (req, res) => {
  const { firstName, lastName, phone, profileImage } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(profileImage !== undefined && { profileImage }),
    },
  });

  res.json(excludePassword(user));
});

router.post("/saved-places", requireAuthentication, async (req, res) => {
  const { name, locationName, address, pincode, landmark, lat, lng, state, district, city } = req.body;

  if (!name || !locationName || !address || !pincode || !state || !district || !city) {
    return res.status(400).json({ error: "name, locationName, address, pincode, state, district, city are required" });
  }

  const location = await getOrCreateLocation({
    state,
    district,
    city,
    locationName,
    address,
    pincode,
    landmark,
    lat,
    lng,
  });

  const place = await prisma.savedPlace.create({
    data: {
      userId: req.user!.id,
      name,
      locationId: location.id,
    },
    include: { location: true },
  });

  res.status(201).json(place);
});

router.get("/saved-places", requireAuthentication, async (req, res) => {
  const places = await prisma.savedPlace.findMany({
    where: { userId: req.user!.id },
    include: { location: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(places);
});

router.delete("/saved-places/:id", requireAuthentication, async (req, res) => {
  const { id } = req.params;

  await prisma.savedPlace.deleteMany({
    where: { id, userId: req.user!.id },
  });

  res.status(204).send();
});

export default router;
