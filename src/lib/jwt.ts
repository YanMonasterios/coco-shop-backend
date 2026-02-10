import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'super-secreto-cocos';

export const signToken = (payload: any) => jwt.sign(payload, SECRET, { expiresIn: '8h' });
export const verifyToken = (token: string) => {
  try { return jwt.verify(token, SECRET); } catch { return null; }
};