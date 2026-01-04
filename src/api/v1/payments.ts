import express from "express";
import prisma from "../../../services/db";
import { requireAuthentication } from "../../middlewares/auth";

const router = express.Router();

router.post("/initiate", requireAuthentication, async (req, res) => {
  const { rideId, amount, method } = req.body;

  if (!amount || !method) {
    return res.status(400).json({ error: "amount and method are required" });
  }

  if (rideId) {
    const existingPayment = await prisma.payment.findFirst({ where: { rideId } });
    if (existingPayment) {
      return res.status(400).json({ error: "Payment already exists for this ride" });
    }
  }

  const payment = await prisma.payment.create({
    data: {
      userId: req.user!.id,
      rideId,
      amount,
      method,
    },
  });

  res.status(201).json(payment);
});

router.post("/verify", requireAuthentication, async (req, res) => {
  const { paymentId, transactionId } = req.body;

  if (!paymentId || !transactionId) {
    return res.status(400).json({ error: "paymentId and transactionId are required" });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: req.user!.id },
  });

  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "COMPLETED",
      transactionId,
    },
  });

  res.json(updated);
});

router.get("/history", requireAuthentication, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const payments = await prisma.payment.findMany({
    where: { userId: req.user!.id },
    include: { ride: true },
    orderBy: { createdAt: "desc" },
    skip,
    take: Number(limit),
  });

  const total = await prisma.payment.count({ where: { userId: req.user!.id } });

  res.json({ payments, total, page: Number(page), limit: Number(limit) });
});

export default router;
