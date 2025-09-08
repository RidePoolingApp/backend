import express, {
  type NextFunction,
  type Response,
  type Request,
} from "express";
import cors from "cors";
import { signUpSchema } from "../../../types/user";
const app = express();

app.use(express.json());

app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from api/v1/user");
});

const verifyType = async (req: Request, res: Response, next: NextFunction) => {
  const parsedSchema = signUpSchema.safeParse(req.body);
  if (!parsedSchema.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }
  next();
};

app.post("/signup", verifyType, async (req, res) => {
  const payLoad = await req.body;

  res.status(200).json({
    message: "User created successfully :" + payLoad.name,
  });
});

export default app;
