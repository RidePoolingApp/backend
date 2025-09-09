import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import express, {
  type NextFunction,
  type Response,
  type Request,
} from "express";
import cors from "cors";
import { loginSchema, signUpSchema } from "../../../types/user";
import prisma from "../../../services/db";
const app = express();

app.use(express.json());

app.use(cors());

const getUserId = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  const user = await prisma.user.findFirst({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
  req.body.userId = user?.id;
  next();
};

const verifyType = async (req: Request, res: Response, next: NextFunction) => {
  const parsedSchema = signUpSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  req.body = parsedSchema.data;

  next();
};

const verifyLoginData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const parsedSchema = loginSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }
  next();
};

app.post("/signup", verifyType, async (req, res) => {
  const payload = req.body;
  const { name, phone, email } = payload;
  try {
    // if signup using email password
    if (payload.password) {
      bcrypt.hash(payload.password, 10, async function (err, hash) {
        try {
          const user = await prisma.user.create({
            data: {
              name,
              phone,
              email,
              password: hash,
            },
          });

          user ? console.log("user created") : console.log("user not created");
        } catch (err) {
          console.log(err);
        }
        // Store hash in your password DB.
      });
    } else {
      const user = await prisma.user.create({
        data: {
          name,
          phone,
          email,
        },
      });

      user ? console.log("user created") : console.log("user not created");

      res.status(200).json({ message: "Signup successful" });
    }
  } catch (err: any) {
    console.log(err.message);
    return res
      .status(500)
      .json({ message: "couldn't complete signup! try again" });
  }
});

app.post("/login", verifyLoginData, getUserId, async (req, res) => {
  const { userId } = await req.body;
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!);
  res.status(200).json({ message: "Login Successful", token });
});

export default app;
