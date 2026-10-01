// Augments Express's Request with the admin identity attached by the authenticate
// middleware, so every controller/route can read req.admin without a cast.
import 'express';

declare global {
  namespace Express {
    interface Request {
      admin?: { email: string };
    }
  }
}
