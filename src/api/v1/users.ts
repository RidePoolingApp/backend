import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

function excludePassword<T extends { password: string }>(user: T): Omit<T, "password"> {
  const { password, ...rest } = user;
  void password;
  return rest;
}

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
  const { name, address, pincode, landmark, lat, lng } = req.body;

  if (!name || !address || !pincode || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "name, address, pincode, lat, lng are required" });
  }

  const boardingPoint = await prisma.boardingPoint.create({
    data: {
      address,
      pincode,
      landmark,
      lat,
      lng,
    },
  });

  const place = await prisma.savedPlace.create({
    data: {
      userId: req.user!.id,
      name,
      boardingPointId: boardingPoint.id,
    },
    include: { boardingPoint: true },
  });

  res.status(201).json(place);
});

router.get("/saved-places", requireAuthentication, async (req, res) => {
  const places = await prisma.savedPlace.findMany({
    where: { userId: req.user!.id },
    include: { boardingPoint: true },
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
