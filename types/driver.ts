import z from "zod";

export const driverRegisterSchema = z.object({
  userId: z.string(),
  currentLocationLat: z.number(),
  currentLocationLng: z.number(),
});

export const driverDocumentSchema = z.array(
  z.object({
    driverId: z.string(),
    type: z.string(),
    url: z.string(),
  }),
);
