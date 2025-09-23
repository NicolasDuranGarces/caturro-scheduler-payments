import jwt from 'jsonwebtoken';
import env from '../config/env';

export type JwtPayload = {
  sub: number;
  role: 'ADMIN' | 'BARISTA';
};

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.TOKEN_EXPIRES_IN });

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
  iat: number;
  exp: number;
};
