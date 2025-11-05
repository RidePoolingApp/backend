import { Server } from "socket.io";
import Redis from "ioredis";
import { redisOptions } from "../src/config/redis";

//The main class for socket services
class SocketService {
  private _io: Server;
  private _pub: Redis;
  private _sub: Redis;

  constructor() {
    console.log("Starting socket service...");

    this._io = new Server({
      cors: {
        origin:
          process.env.NODE_ENV === "production"
            ? process.env.ALLOWED_ORIGIN
            : "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this._pub = new Redis(redisOptions);
    this._sub = new Redis(redisOptions);

    this._pub && this._sub
      ? console.log("Redis Connected!")
      : console.log("Redis not connected!");

    // Error handlers
    this._pub.on("error", (err) => console.error("Redis Pub Error:", err));
    this._sub.on("error", (err) => console.error("Redis Sub Error:", err));

    // Subscribe to general messages channel
    this._sub.subscribe("MESSAGES");
  }

  public getIo() {
    return this._io;
  }

  //initializing the listeners
  public initListeners() {
    console.log("Initializing socket listeners...");

    this._io.on("connection", (socket) => {
      console.log("New connection:", socket.id);
      socket.on("message", async (message: string) => {
        console.log("message recieved : " + message);
        this._pub.publish("MESSAGES", JSON.stringify({ message }));
      });
    });

    // Handle Redis messages
    this._sub.on("message", (channel: string, message: string) => {
      if (channel === "MESSAGES") {
        this._io.emit("message", message);
        console.log("Message sent to all servers!");
      }
    });
  }
}

export default SocketService;
