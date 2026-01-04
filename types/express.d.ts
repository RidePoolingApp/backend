import type { User, DriverProfile } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      driver?: DriverProfile;
    }
  }
}

export {};
