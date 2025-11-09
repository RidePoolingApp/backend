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

export interface GeoLocation {
  startLocationLat: number;
  startLocationLng: number;
  endLocationLat: number;
  endLocationLng: number;
}

export interface RideSearch {
  startLocationLat: number;
  startLocationLng: number;
  endLocationLat: number;
  endLocationLng: number;
  luggage?: boolean;
}

export interface LatLang {
  lat: number;
  lang: number;
}
