import jwt, { JwtPayload as StandardPayload, Secret, SignOptions } from 'jsonwebtoken';
import env from '../config/env';

export interface AppJwtClaims extends StandardPayload {
  sub: string;
  role: 'ADMIN' | 'BARISTA';
}

export interface VerifiedJwtPayload {
  sub: number;
  role: 'ADMIN' | 'BARISTA';
  iat: number;
  exp: number;
}

const secret: Secret = env.JWT_SECRET;
const signOptions: SignOptions = {
  expiresIn: env.TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
};

export const signToken = (payload: { sub: number; role: 'ADMIN' | 'BARISTA' }) => {
  const tokenPayload: AppJwtClaims = {
    sub: String(payload.sub),
    role: payload.role,
  };

  return jwt.sign(tokenPayload, secret, signOptions);
};

export const verifyToken = (token: string): VerifiedJwtPayload => {
  const decoded = jwt.verify(token, secret);

  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }

  const { sub, role, iat, exp } = decoded as Partial<AppJwtClaims> & StandardPayload;

  if (typeof sub !== 'string') {
    throw new Error('Invalid token subject');
  }

  const userId = Number(sub);
  if (!Number.isInteger(userId)) {
    throw new Error('Invalid token subject');
  }

  if (role !== 'ADMIN' && role !== 'BARISTA') {
    throw new Error('Invalid token role');
  }

  if (typeof iat !== 'number' || typeof exp !== 'number') {
    throw new Error('Invalid token timestamps');
  }

  return { sub: userId, role, iat, exp };
};
