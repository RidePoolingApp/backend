import express from "express";
import auth from "./auth";
import users from "./users";
import drivers from "./drivers";
import rides from "./rides";
import sharing from "./sharing";
import dailyCab from "./dailyCab";
import payments from "./payments";

const router = express.Router();

router.use("/auth", auth);
router.use("/users", users);
router.use("/drivers", drivers);
router.use("/rides", rides);
router.use("/sharing", sharing);
router.use("/daily-cab", dailyCab);
router.use("/payments", payments);

router.get("/", (_req, res) => {
  res.send("Hello from api/v1");
});

export default router;
