import { Server, Socket } from "socket.io";
import Redis from "ioredis";
import { redisOptions } from "../src/config/redis";

interface DriverLocation {
  lat: number;
  lng: number;
  driverId: string;
}

interface RideUpdate {
  rideId: string;
  status: string;
  driverId?: string;
  driverLocation?: DriverLocation;
}

class SocketService {
  private _io: Server;
  private _pub: Redis;
  private _sub: Redis;

  constructor() {
    console.log("Starting socket service...");

    this._io = new Server({
      cors: {
        origin: process.env.NODE_ENV === "production" ? process.env.ALLOWED_ORIGIN : "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this._pub = new Redis(redisOptions);
    this._sub = new Redis(redisOptions);

    if (this._pub && this._sub) {
      console.log("Redis Connected!");
    } else {
      console.log("Redis not connected!");
    }

    this._pub.on("error", (err) => console.error("Redis Pub Error:", err));
    this._sub.on("error", (err) => console.error("Redis Sub Error:", err));

    this._sub.subscribe("DRIVER_LOCATION");
    this._sub.subscribe("RIDE_STATUS");
    this._sub.subscribe("NEW_RIDE_REQUEST");
  }

  public getIo() {
    return this._io;
  }

  public initListeners() {
    console.log("Initializing socket listeners...");

    this._io.on("connection", (socket: Socket) => {
      console.log("New connection:", socket.id);

      socket.on("join:rider", (userId: string) => {
        socket.join(`rider:${userId}`);
        console.log(`Rider ${userId} joined`);
      });

      socket.on("join:driver", (driverId: string) => {
        socket.join(`driver:${driverId}`);
        socket.join("drivers");
        console.log(`Driver ${driverId} joined`);
      });

      socket.on("driver:location", (data: DriverLocation) => {
        this._pub.publish("DRIVER_LOCATION", JSON.stringify(data));
      });

      socket.on("ride:status", (data: RideUpdate) => {
        this._pub.publish("RIDE_STATUS", JSON.stringify(data));
      });

      socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
      });
    });

    this._sub.on("message", (channel: string, message: string) => {
      const data = JSON.parse(message);

      if (channel === "DRIVER_LOCATION") {
        this._io.to("drivers").emit("driver:location", data);
        if (data.rideId) {
          this._io.to(`ride:${data.rideId}`).emit("driver:location", data);
        }
      }

      if (channel === "RIDE_STATUS") {
        this._io.to(`rider:${data.riderId}`).emit("ride:status", data);
        if (data.driverId) {
          this._io.to(`driver:${data.driverId}`).emit("ride:status", data);
        }
      }

      if (channel === "NEW_RIDE_REQUEST") {
        this._io.to("drivers").emit("ride:new", data);
      }
    });
  }

  public emitRideRequest(ride: object) {
    this._pub.publish("NEW_RIDE_REQUEST", JSON.stringify(ride));
  }

  public emitRideStatusUpdate(data: RideUpdate) {
    this._pub.publish("RIDE_STATUS", JSON.stringify(data));
  }

  public emitToDriver(driverId: string, event: string, data: object) {
    this._io.to(`driver:${driverId}`).emit(event, data);
  }

  public emitToRider(riderId: string, event: string, data: object) {
    this._io.to(`rider:${riderId}`).emit(event, data);
  }
}

export default SocketService;
