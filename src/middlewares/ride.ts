import { type NextFunction, type Response, type Request } from "express";
import { createRideSchema } from "../../types/ride";

export const verifyRidePayload = async (req: Request, res: Response, next: NextFunction) => {
  const payload = req.body;
  const verifiedPayload = createRideSchema.safeParse(payload);
  if (!verifiedPayload.success) {
    return res.status(400).json({
      message: "Invalid request body",
      err: verifiedPayload.error.issues,
    });
  }
  req.body = verifiedPayload.data;
  next();
};
