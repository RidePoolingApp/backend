import { Server } from "socket.io";
import Redis from "ioredis";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();
//define redis config
const redisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "21348"),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  //  tls: {},
};

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
