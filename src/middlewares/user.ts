import { type NextFunction, type Response, type Request } from "express";
import { loginSchema, signUpSchema } from "../../types/user";
import prisma from "../../services/db";

export const verifySignUpPayload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsedSchema = signUpSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  req.body = parsedSchema.data;

  next();
};

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsedSchema = loginSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: parsedSchema.data.userId,
    },
    select: {
      role: true,
    },
  });
  req.body.role = user?.role;
  if (!user) {
    return res.status(400).json({ message: "user does not exist" });
  }

  next();
};
