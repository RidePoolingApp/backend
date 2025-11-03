import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import {
  userExists,
  verifySignUpPayload,
  verifyUser,
} from "../../middlewares/user";
import prisma from "../../../services/db";

const app = express();
app.use(express.json());
app.use(cors());

//signup handler
app.post("/signup", verifySignUpPayload, userExists, async (req, res) => {
  const payload = req.body;
  const { name, phone, email, userId } = payload;
  try {
    // if signup using email password
    bcrypt.hash(payload.password, 10, async function (err, hash) {
      try {
        const user = await prisma.user.create({
          data: {
            id: userId,
            name,
            email,
            phone,
            password: hash,
          },
        });

        user ? console.log("user created") : console.log("user not created");
        const token = jwt.sign(
          { userId: user.id, password: payload.password },
          process.env.JWT_SECRET!,
        );
        res.status(201).json({ message: "Signup successful", token });
      } catch (err) {
        console.log(err);
      }
      // Store hash in your password DB.
    });
  } catch (err: any) {
    console.log(err.message);
    return res
      .status(500)
      .json({ message: "couldn't complete signup! try again" });
  }
});

//login handler
app.post("/login", verifyUser, async (req, res) => {
  const { userId, password } = req.body;
  console.log("userId", userId);

  const token = jwt.sign({ userId, password }, process.env.JWT_SECRET!);
  res.status(200).json({ message: "Logged in ", token });
});

export default app;
