import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import prisma from "../../../services/db";
import { verifySignUpPayload, verifyUser } from "../../middlewares/user";

const app = express();
app.use(express.json());
app.use(cors());

//signup handler
app.post("/signup", verifySignUpPayload, async (req, res) => {
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

//login handler
app.post("/login", verifyUser, async (req, res) => {
  const { userId, role } = await req.body;

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!);
  res.status(200).json({ message: "Logged in as " + role, token });
});

export default app;
