import express from "express";
import cors from "cors";
import apiV1 from "./api/v1";
import http from "http";
//import SocketService from "../services/socketService";
const app = express();
app.use(express.json());

app.use(cors());
app.use("/api/v1", apiV1);

app.get("/", (req, res) => {
  res.send("This shit works!!");
});

const startServer = async () => {
  // create a new socket service from SocketService class
  const PORT = 3000;

  //const socketService = new SocketService();
  // create a new http server
  // set the port
  const httpServer = http.createServer(app);
  // attach the socket service to the http server
  //  socketService.getIo().attach(httpServer);
  // listen to the port
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  // initialize the socket listeners
  //socketService.initListeners();

  app.get("/", (req, res) => {
    res.send("This shit works!!");
  });
};

startServer();
