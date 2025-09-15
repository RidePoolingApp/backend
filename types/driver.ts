import z from "zod";

export const driverRegisterSchema = z.object({
  userId: z.string(),
  currentLocationLat: z.number(),
  currentLocationLng: z.number(),
});

export const driverDocumentSchema = z.object({
  driverId: z.string(),
  adhaarCard: z.object({
    adhaarNumber: z.int(),
    name: z.string(),
  }),
  driverLicense: z.object({
    DLNumber: z.string(),
    DOB: z.string(),
  }),
});
