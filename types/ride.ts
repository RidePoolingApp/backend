import { z } from "zod";
export interface Ride {
  estimatedDistance: number;
  estimatedDuration: number;
  startLocationLat: number;
  startLocationLng: number;
  endLocationLat: number;
  endLocationLng: number;
  driverId: string;
}

export const createRideSchema = z.object({
  estimatedDistance: z.number(),
  estimatedDuration: z.number(),
  startLocationLat: z.number(),
  startLocationLng: z.number(),
  endLocationLat: z.number(),
  endLocationLng: z.number(),
  driverId: z.string(),
});
