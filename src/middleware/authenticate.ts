import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import env from '../config/env';
import AppError from '../utils/AppError';

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(new AppError('Missing or invalid Authorization header', 401));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    req.admin = { email: payload.sub as string };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

export default authenticate;
