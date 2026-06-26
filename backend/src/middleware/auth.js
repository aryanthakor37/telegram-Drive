import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'telegram_drive_super_secret_key_12345');

      if (global.isMockDB) {
        const MOCK_DB_PATH = path.resolve('src/models/users_mock.json');
        let users = [];
        if (fs.existsSync(MOCK_DB_PATH)) {
          users = JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf-8') || '[]');
        }
        const user = users.find(u => u._id === decoded.id);
        if (!user) {
          return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        const { password, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
        return next();
      }

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      return next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

