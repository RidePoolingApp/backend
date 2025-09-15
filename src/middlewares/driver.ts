import { type NextFunction, type Response, type Request } from "express";
import prisma from "../../services/db";
import { driverDocumentSchema, driverRegisterSchema } from "../../types/driver";
export const verifyDriver = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { driverId } = req.params;
  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
    },
  });
  if (!driver) {
    return res.status(401).json({ message: "Unauthorized Request" });
  }
  next();
};

export const verifyDriverRegisterSchema = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const payload = req.body;
  const verifiedPayload = driverRegisterSchema.safeParse(payload);
  if (!verifiedPayload.success) {
    return res.status(400).json({ message: "Invalid Request Body" });
  }
  req.body = verifiedPayload.data;
  next();
};

export const verifyDriverDocumentSchema = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const payload = req.body;
  const verifiedPayload = driverDocumentSchema.safeParse(payload);
  if (!verifiedPayload.success) {
    const error = driverDocumentSchema.safeParse(payload);
    return res.status(400).json({ message: "Invalid Request Body ", error });
  }
  req.body = verifiedPayload.data;
  next();
};
