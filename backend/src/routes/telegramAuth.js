import express from 'express';
import jwt from 'jsonwebtoken';
import { Api } from 'telegram';
import { protect } from '../middleware/auth.js';
import { createLoginClient, pendingClients } from '../services/telegram.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Mock DB helpers (to keep compatible with mock database fallback)
const MOCK_DB_PATH = path.resolve('src/models/users_mock.json');
const getMockUsers = () => {
  try {
    if (!fs.existsSync(MOCK_DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf-8') || '[]');
  } catch (err) {
    return [];
  }
};
const saveMockUsers = (users) => {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(users, null, 2));
  } catch (err) { }
};

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'telegram_drive_super_secret_key_12345', {
    expiresIn: '30d'
  });
};

// @desc    Send OTP code to Telegram phone number
// @route   POST /api/telegram/send-code
// @access  Public
router.post('/send-code', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  const apiId = parseInt(process.env.TG_API_ID || '0');
  const apiHash = process.env.TG_API_HASH || '';

  try {
    console.log(`[DEBUG] Attempting sendCode for phone: ${phoneNumber} using API_ID: ${apiId} (type: ${typeof apiId}), API_HASH: ${apiHash}`);
    // 1. Initialize temporary client
    const client = createLoginClient();
    await client.connect();

    // 2. Send code request to Telegram
    const { phoneCodeHash } = await client.sendCode(
      { apiId, apiHash },
      phoneNumber
    );


    // 3. Store client in memory for verification
    pendingClients.set(phoneNumber, { client, phoneCodeHash });

    res.json({ phoneCodeHash, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send code error:', error);

    // Check for Telegram FloodWait / Rate Limit Error
    const isFloodWait = error.name === 'FloodWaitError' || 
                        /flood/i.test(error.message) || 
                        /wait/i.test(error.message);
                        
    if (isFloodWait) {
      const match = error.message.match(/wait of (\d+) seconds/i) || 
                    error.message.match(/FLOOD_WAIT_(\d+)/i);
      const seconds = match ? parseInt(match[1]) : 300; // default to 5 minutes
      
      return res.status(429).json({
        message: `A wait of ${seconds} seconds is required (caused by auth.SendCode). (If this is hanging/failing, please turn on a VPN as ISPs block direct Telegram API connections).`,
        floodWait: true,
        seconds
      });
    }

    res.status(500).json({ message: error.message || 'Failed to send OTP code to Telegram.' });
  }
});

// @desc    Verify OTP code and authenticate
// @route   POST /api/telegram/verify-code
// @access  Public
router.post('/verify-code', async (req, res) => {
  const { phoneNumber, phoneCodeHash, phoneCode } = req.body;

  if (!phoneNumber || !phoneCodeHash || !phoneCode) {
    return res.status(400).json({ message: 'Phone number, code hash, and OTP code are required' });
  }

  const pending = pendingClients.get(phoneNumber);
  if (!pending) {
    return res.status(400).json({ message: 'Session expired or not found. Please request OTP again.' });
  }

  try {
    const { client, phoneCodeHash: storedHash } = pending;

    // Check if hashes match (optional safety)
    if (storedHash !== phoneCodeHash) {
      return res.status(400).json({ message: 'Invalid session hash' });
    }

    // 1. Sign in client
    const userSession = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode
      })
    );

    // 2. Get user info from Telegram
    const me = await client.getMe();
    const telegramUserId = me.id.toString();
    const username = me.username || me.firstName || `telegram_${telegramUserId}`;

    // 3. Save session in DB
    const sessionString = client.session.save();

    // Clear pending client from map
    pendingClients.delete(phoneNumber);

    let appUser;

    if (global.isMockDB) {
      const users = getMockUsers();
      let userIndex = users.findIndex(u => u.telegramPhone === phoneNumber || u.telegramUserId === telegramUserId);

      if (userIndex >= 0) {
        // Update user
        users[userIndex].telegramSession = sessionString;
        users[userIndex].telegramUserId = telegramUserId;
        appUser = users[userIndex];
      } else {
        // Ensure mock username is unique
        let finalUsername = username;
        if (users.some(u => u.username === finalUsername)) {
          finalUsername = `${username}_${telegramUserId}`;
        }
        // Create user
        appUser = {
          _id: Date.now().toString(),
          username: finalUsername,
          email: `${telegramUserId}@telegram.com`,
          telegramPhone: phoneNumber,
          telegramSession: sessionString,
          telegramUserId: telegramUserId,
          createdAt: new Date().toISOString()
        };
        users.push(appUser);
      }
      saveMockUsers(users);
    } else {
      // Mongoose flow
      appUser = await User.findOne({
        $or: [
          { telegramPhone: phoneNumber },
          { telegramUserId: telegramUserId },
          { email: `${telegramUserId}@telegram.com` }
        ]
      });

      if (appUser) {
        appUser.telegramSession = sessionString;
        appUser.telegramUserId = telegramUserId;
        appUser.telegramPhone = phoneNumber;
        if (!appUser.email) {
          appUser.email = `${telegramUserId}@telegram.com`;
        }
        await appUser.save();
      } else {
        // Check if the username is already taken
        let finalUsername = username;
        const usernameExists = await User.findOne({ username: finalUsername });
        if (usernameExists) {
          finalUsername = `${username}_${telegramUserId}`;
        }

        // Create user placeholder (password not needed since it's Telegram direct auth, but Mongoose requires it)
        const randomPassword = Math.random().toString(36).substring(2, 15);
        appUser = await User.create({
          username: finalUsername,
          email: `${telegramUserId}@telegram.com`,
          password: randomPassword,
          telegramPhone: phoneNumber,
          telegramSession: sessionString,
          telegramUserId: telegramUserId
        });
      }
    }

    // 4. Return JWT Token
    res.json({
      token: generateToken(appUser._id),
      _id: appUser._id,
      username: appUser.username,
      telegramPhone: appUser.telegramPhone,
      telegramConnected: true
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(401).json({ message: error.message || 'OTP verification failed. Please try again.' });
  }
});

// @desc    Get current Telegram connection status
// @route   GET /api/telegram/status
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    let appUser;
    if (global.isMockDB) {
      const users = getMockUsers();
      appUser = users.find(u => u._id === req.user._id);
    } else {
      appUser = await User.findById(req.user._id);
    }

    if (!appUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      connected: !!appUser.telegramSession,
      phone: appUser.telegramPhone,
      username: appUser.username
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Server error check status' });
  }
});

// @desc    Disconnect/Logout Telegram account
// @route   POST /api/telegram/logout
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const users = getMockUsers();
      const userIndex = users.findIndex(u => u._id === req.user._id);
      if (userIndex >= 0) {
        users[userIndex].telegramSession = null;
        users[userIndex].telegramPhone = null;
        users[userIndex].telegramUserId = null;
        saveMockUsers(users);
      }
    } else {
      const user = await User.findById(req.user._id);
      if (user) {
        user.telegramSession = undefined;
        user.telegramPhone = undefined;
        user.telegramUserId = undefined;
        await user.save();
      }
    }

    res.json({ message: 'Telegram account disconnected successfully' });
  } catch (error) {
    console.error('Telegram logout error:', error);
    res.status(500).json({ message: 'Server error logging out' });
  }
});

export default router;
