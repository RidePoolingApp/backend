import { type NextFunction, type Response, type Request } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../services/db";
import { driverDocumentSchema, driverRegisterSchema } from "../../types/driver";
export const verifyDriver = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { authorization } = req.headers;
  const userId = await verifyUserId(authorization!);
  if (userId === 0) {
    console.log("after jwt verify");

    return res
      .status(401)
      .json({ message: "Unauthorized Request after jwt verify" });
  }
  const driver = await prisma.driver.findFirst({
    where: {
      userId: String(userId),
    },
  });
  if (!driver) {
    console.log("after db call");

    return res
      .status(401)
      .json({ message: "Unauthorized Request after db call" });
  }
  next();
};

const verifyUserId = async (authorization: string) => {
  const token = authorization.split(" ")[1];
  if (!token) {
    return 0;
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
    userId: string;
  };
  if (!decoded.userId) {
    return 0;
  }
  return decoded.userId;
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
