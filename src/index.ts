import express from "express";
import cors from "cors";
import apiV1 from "./api/v1";
import http from "http";
import SocketService from "../services/socketService";

const app = express();
app.use(express.json());
app.use(cors());
app.use("/api/v1", apiV1);

app.get("/", (_req, res) => {
  res.send("WayLink Backend API");
});

const startServer = async () => {
  const PORT = process.env.PORT || 3000;

  const socketService = new SocketService();
  const httpServer = http.createServer(app);
  socketService.getIo().attach(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  socketService.initListeners();
};

startServer();
