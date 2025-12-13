import { z } from "zod";
export type Ride = {
  estimatedDistance: number;
  estimatedDuration: number;
  startLocationLat: number;
  startLocationLng: number;
  endLocationLat: number;
  endLocationLng: number;
  driverId: string;
};

export const createRideSchema = z.object({
  estimatedDistance: z.number(),
  estimatedDuration: z.number(),
  startLocationLat: z.number(),
  startLocationLng: z.number(),
  endLocationLat: z.number(),
  endLocationLng: z.number(),
  driverId: z.string(),
});

export type GeoLocation = {
  startLocationLat: number;
  startLocationLng: number;
  endLocationLat: number;
  endLocationLng: number;
};

export type RideSearch = {
  startLocationLat: number;
  startLocationLng: number;
  endLocationLat: number;
  endLocationLng: number;
  luggage?: boolean;
};

export type LatLang = {
  lat: number;
  lang: number;
};
