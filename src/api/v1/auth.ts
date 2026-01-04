import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../../services/db";
import { generateToken, generateRefreshToken } from "../../middlewares/auth";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

function excludePassword<T extends { password: string }>(user: T): Omit<T, "password"> {
  const { password, ...rest } = user;
  void password;
  return rest;
}

router.post("/signup", async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "Email already registered" });
  }

  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ error: "Phone already registered" });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
    },
  });

  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  res.status(201).json({
    user: excludePassword(user),
    token,
    refreshToken,
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  res.json({
    user: excludePassword(user),
    token,
    refreshToken,
  });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken is required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

export default router;
