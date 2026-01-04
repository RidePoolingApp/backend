import type { Request, Response, NextFunction } from "express";
import { createClerkClient } from "@clerk/backend";
import jwtLib from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../../services/db";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

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

interface ClerkJwtPayload extends jwtLib.JwtPayload {
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export const requireAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const decoded = await new Promise<ClerkJwtPayload>((resolve, reject) => {
      jwtLib.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded as ClerkJwtPayload);
      });
    });

    const clerkUserId = decoded.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: { driverProfile: true },
    });

    if (!user) {
      let primaryEmail: string | undefined;
      let firstName: string | undefined;
      let lastName: string | undefined;
      let phone: string | undefined;

      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;
        firstName = clerkUser.firstName || undefined;
        lastName = clerkUser.lastName || undefined;
        phone = clerkUser.phoneNumbers[0]?.phoneNumber || undefined;
      } catch (clerkError) {
        console.log("Could not fetch Clerk user, using token data");
        primaryEmail = decoded.email;
        firstName = decoded.firstName;
        lastName = decoded.lastName;
      }

      if (!primaryEmail) {
        return res.status(400).json({ error: "User email not found in token" });
      }

      user = await prisma.user.upsert({
        where: { email: primaryEmail },
        update: { clerkId: clerkUserId },
        create: {
          clerkId: clerkUserId,
          email: primaryEmail,
          firstName,
          lastName,
          phone,
          password: "",
        },
        include: { driverProfile: true },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireDriver = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!driver) {
    return res.status(403).json({ error: "Driver profile required" });
  }

  if (!driver.isVerified) {
    return res.status(403).json({ error: "Driver not verified" });
  }

  req.driver = driver;
  next();
};

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const generateToken = (userId: string): string => {
  return jwtLib.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
};

export const generateRefreshToken = (userId: string): string => {
  return jwtLib.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
};
