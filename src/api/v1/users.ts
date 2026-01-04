import express from "express";
import jwtLib from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

const client = jwksClient({
  jwksUri: "https://refined-duck-56.clerk.accounts.dev/.well-known/jwks.json",
  cache: true,
  rateLimit: true,
});

function getKey(header: jwtLib.JwtHeader, callback: jwtLib.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

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

router.post("/sync", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const { email, firstName, lastName, phone, profileImage } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const decoded = await new Promise<jwtLib.JwtPayload>((resolve, reject) => {
      jwtLib.verify(token, getKey, { algorithms: ["RS256"] }, (err: Error | null, decoded: unknown) => {
        if (err) reject(err);
        else resolve(decoded as jwtLib.JwtPayload);
      });
    });

    const clerkUserId = decoded.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { 
        clerkId: clerkUserId,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(profileImage && { profileImage }),
      },
      create: {
        clerkId: clerkUserId,
        email,
        firstName,
        lastName,
        phone,
        profileImage,
        password: "",
      },
      include: { driverProfile: true },
    });

    res.json(excludePassword(user));
  } catch (error) {
    console.error("Sync error:", error);
    return res.status(401).json({ error: "Invalid token" });
  }
});

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
