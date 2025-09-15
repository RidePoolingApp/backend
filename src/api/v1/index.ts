import express from "express";
import cors from "cors";
import user from "./user";
import driver from "./driver";
const app = express();

app.use(express.json());
app.use("/user", user);
app.use("/driver", driver);
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from api/v1");
});

export default app;
