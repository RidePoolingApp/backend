import Redis from "ioredis";
import { redisOptions } from "../src/config/redis";

export const geoRedis = new Redis(redisOptions);
