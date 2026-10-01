import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Express does not forward rejected promises to error middleware on its own;
// this wrapper is what lets every controller skip repeating the same try/catch.
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
