import z from "zod";
export const signUpSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.email(),
  password: z.string().min(8),
});
