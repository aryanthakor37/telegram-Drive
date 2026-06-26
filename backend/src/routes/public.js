import express from 'express';
import fs from 'fs';
import path from 'path';
import { getConnectedClient } from '../services/telegram.js';
import File from '../models/File.js';
import User from '../models/User.js';

const router = express.Router();
const MOCK_FILES_PATH = path.resolve('src/models/files_mock.json');

const getMockFiles = () => {
  try {
    if (!fs.existsSync(MOCK_FILES_PATH)) return [];
    return JSON.parse(fs.readFileSync(MOCK_FILES_PATH, 'utf-8') || '[]');
  } catch (err) {
    return [];
  }
};

// @desc    Get public file metadata by share token
// @route   GET /api/public/files/:token
// @access  Public
router.get('/files/:token', async (req, res) => {
  try {
    const { token } = req.params;
    let file;

    if (global.isMockDB) {
      const files = getMockFiles();
      file = files.find(f => f.shareToken === token && f.isPublic && !f.isDeleted);
    } else {
      file = await File.findOne({ shareToken: token, isPublic: true, isDeleted: false }).select('-owner -folder');
    }

    if (!file) {
      return res.status(404).json({ message: 'File not found or link has expired' });
    }

    res.json({
      _id: file._id,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: file.createdAt
    });
  } catch (error) {
    console.error('Public file fetch error:', error);
    res.status(500).json({ message: 'Server error retrieving file' });
  }
});

// @desc    Download public file by share token
// @route   GET /api/public/download/:token
// @access  Public
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    let file;

    if (global.isMockDB) {
      const files = getMockFiles();
      file = files.find(f => f.shareToken === token && f.isPublic && !f.isDeleted);
    } else {
      file = await File.findOne({ shareToken: token, isPublic: true, isDeleted: false });
    }

    if (!file) {
      return res.status(404).json({ message: 'File not found or link has expired' });
    }

    // Fetch owner's Telegram session to download the file
    let appUser;
    if (global.isMockDB) {
      const users = JSON.parse(fs.readFileSync(path.resolve('src/models/users_mock.json'), 'utf-8') || '[]');
      appUser = users.find(u => u._id === file.owner);
    } else {
      appUser = await User.findById(file.owner);
    }

    if (!appUser || !appUser.telegramSession) {
      return res.status(400).json({ message: 'Telegram account is not connected.' });
    }

    const client = await getConnectedClient(appUser.telegramSession);
    if (!client) {
      return res.status(500).json({ message: 'Telegram client not connected' });
    }

    // Try to get message from the "Saved Messages" of the owner using their session.
    const result = await client.getMessages('me', { ids: [file.telegramMessageId] });
    
    if (!result || result.length === 0 || !result[0]) {
      return res.status(404).json({ message: 'File not found in Telegram' });
    }

    const message = result[0];
    const buffer = await client.downloadMedia(message);
    
    if (!buffer) {
      return res.status(500).json({ message: 'Failed to download from Telegram' });
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Public download error:', error);
    res.status(500).json({ message: 'Server error downloading file' });
  }
});

export default router;
