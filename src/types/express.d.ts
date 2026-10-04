// Augments Express's Request with the admin identity attached by the authenticate
// middleware, so every controller/route can read req.admin without a cast.
import 'express';

declare global {
  namespace Express {
    interface Request {
      admin?: { email: string };
      // Captured by app.ts's express.json({ verify }) — needed to check Facebook's
      // X-Hub-Signature-256 header, which is computed over the exact raw bytes, not the
      // re-serialized parsed body.
      rawBody?: Buffer;
    }
  }
}
