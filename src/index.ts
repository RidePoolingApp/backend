import express from "express";
import cors from "cors";
import apiV1 from "./api/v1";

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(cors());
app.use("/api/v1", apiV1);

app.get("/", (req, res) => {
  res.send("This shit works!!");
});

app.listen(PORT, () => {
  console.log("Server is running on port 3000");
});
