import { Request, Response, NextFunction } from 'express';

export default function role(req: Request, res: Response, next: NextFunction) {
  next();
}
