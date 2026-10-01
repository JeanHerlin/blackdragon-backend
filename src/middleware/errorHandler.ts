import type { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

// Centralized so every controller can throw and never has to format an HTTP
// response itself (see code-standards skill).
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

export default errorHandler;
