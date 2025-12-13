import { type NextFunction, type Response, type Request } from "express";
import { loginSchema, signUpSchema } from "../../types/user";
import bcrypt from "bcrypt";
import prisma from "../../services/db";
const isValidPassword = async (password: string, hash: string) => {
  const result = await bcrypt.compare(password, hash);
  return result;
};

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

export const userExists = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { userId, email } = req.body;
  const user = await prisma.user.findFirst({
    where: {
      email,
      id: userId,
    },
  });
  if (user) {
    return res.status(400).json({ message: "user already exists!" });
  }
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
      email: parsedSchema.data.email,
    },
  });
  if (!user) {
    return res.status(400).json({ message: "user does not exist" });
  }
  if (!(await isValidPassword(parsedSchema.data.password, user.password!))) {
    return res.status(400).json({ message: "invalid password" });
  }
  req.body.password = user.password;
  req.body.userId = user.id;
  next();
};
