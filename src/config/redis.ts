import dotenv from "dotenv";
dotenv.config();
export const redisOptions = {
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
