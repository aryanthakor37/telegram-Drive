import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { protect } from '../middleware/auth.js';
import { getConnectedClient } from '../services/telegram.js';
import File from '../models/File.js';
import User from '../models/User.js';
import Folder from '../models/Folder.js';
import bigInt from 'big-integer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const MOCK_FILES_PATH = path.resolve('src/models/files_mock.json');
const MOCK_FOLDERS_PATH = path.resolve('src/models/folders_mock.json');

const getMockFolders = () => {
  try {
    if (!fs.existsSync(MOCK_FOLDERS_PATH)) return [];
    return JSON.parse(fs.readFileSync(MOCK_FOLDERS_PATH, 'utf-8') || '[]');
  } catch (err) {
    return [];
  }
};

const saveMockFolders = (folders) => {
  try {
    const dir = path.dirname(MOCK_FOLDERS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MOCK_FOLDERS_PATH, JSON.stringify(folders, null, 2));
  } catch (err) {}
};
const getMockFiles = () => {
  try {
    if (!fs.existsSync(MOCK_FILES_PATH)) return [];
    return JSON.parse(fs.readFileSync(MOCK_FILES_PATH, 'utf-8') || '[]');
  } catch (err) {
    return [];
  }
};
const saveMockFiles = (files) => {
  try {
    const dir = path.dirname(MOCK_FILES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MOCK_FILES_PATH, JSON.stringify(files, null, 2));
  } catch (err) {}
};

// @desc    Get all files indexed in the drive for current user, optionally filtered by folder
// @route   GET /api/drive/files
// @access  Private
router.get('/files', protect, async (req, res) => {
  try {
    const { folder, trash, category } = req.query;

    if (global.isMockDB) {
      const files = getMockFiles();
      let userFiles = files.filter(f => f.owner === req.user._id);
      
      if (trash === 'true') {
        userFiles = userFiles.filter(f => f.isDeleted);
      } else {
        userFiles = userFiles.filter(f => !f.isDeleted);
        if (folder) {
          if (folder === 'root') {
            userFiles = userFiles.filter(f => !f.folder);
          } else {
            userFiles = userFiles.filter(f => f.folder === folder);
          }
        }
        if (category) {
          userFiles = userFiles.filter(f => getFileTypeCategory(f.mimeType || 'application/octet-stream', f.name) === category);
        }
      }
      return res.json(userFiles);
    }

    const query = { owner: req.user._id };
    
    if (trash === 'true') {
      query.isDeleted = true;
    } else {
      query.isDeleted = { $ne: true };
      if (folder) {
        if (folder === 'root') {
          query.folder = null;
        } else {
          query.folder = folder;
        }
      }
    }
    
    let files = await File.find(query).sort({ createdAt: -1 });
    if (category) {
      files = files.filter(f => getFileTypeCategory(f.mimeType || 'application/octet-stream', f.name) === category);
    }
    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Server error listing files' });
  }
});

// @desc    Search files by name globally
// @route   GET /api/drive/search
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    if (global.isMockDB) {
      const files = getMockFiles();
      const userFiles = files.filter(f => f.owner === req.user._id && !f.isDeleted && f.name.toLowerCase().includes(q.toLowerCase()));
      return res.json(userFiles.slice(0, 10)); // return top 10 matches
    }

    const regex = new RegExp(q, 'i');
    const files = await File.find({ owner: req.user._id, isDeleted: { $ne: true }, name: regex })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(files);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error during search' });
  }
});

// @desc    Upload file to Telegram and index its metadata
// @route   POST /api/drive/upload
// @access  Private
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    // 1. Fetch user to check Telegram connection
    let appUser;
    if (global.isMockDB) {
      const users = JSON.parse(fs.readFileSync(path.resolve('src/models/users_mock.json'), 'utf-8') || '[]');
      appUser = users.find(u => u._id === req.user._id);
    } else {
      appUser = await User.findById(req.user._id);
    }

    if (!appUser || !appUser.telegramSession) {
      return res.status(400).json({ message: 'Telegram account is not connected. Please connect it first.' });
    }

    // 2. Write temp file from memory buffer
    const tempDir = path.resolve('temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    // Save with unique name to avoid collisions
    const tempFileName = `upload_${Date.now()}_${req.file.originalname}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // 3. Connect to Telegram
    const client = await getConnectedClient(appUser.telegramSession);

    // 4. Send file as message attachment to Self (Saved Messages)
    const message = await client.sendFile('me', {
      file: tempFilePath,
      caption: `TG-Drive: ${req.file.originalname}`,
      forceDocument: true,
      workers: 4
    });

    // 5. Delete local temp file
    fs.unlinkSync(tempFilePath);

    // 6. Save metadata
    const { folder } = req.body;
    let savedFile;
    if (global.isMockDB) {
      const files = getMockFiles();
      savedFile = {
        _id: Date.now().toString(),
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        telegramMessageId: message.id,
        owner: req.user._id,
        folder: (folder && folder !== 'root') ? folder : null,
        createdAt: new Date().toISOString()
      };
      files.push(savedFile);
      saveMockFiles(files);
    } else {
      savedFile = await File.create({
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        telegramMessageId: message.id,
        owner: req.user._id,
        folder: (folder && folder !== 'root') ? folder : null
      });
    }

    res.status(201).json(savedFile);
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload file to Telegram.' });
  }
});

// @desc    Sync files from Telegram Saved Messages into DB (for files uploaded from phone/other devices)
// @route   POST /api/drive/sync
// @access  Private
router.post('/sync', protect, async (req, res) => {
  try {
    const appUser = await User.findById(req.user._id);
    if (!appUser || !appUser.telegramSession) {
      return res.status(400).json({ message: 'Telegram account is not connected.' });
    }

    const client = await getConnectedClient(appUser.telegramSession);

    // Get all message IDs already indexed in DB for this user to avoid duplicates
    const existingFiles = await File.find({ owner: req.user._id }).select('telegramMessageId');
    const indexedMsgIds = new Set(existingFiles.map(f => f.telegramMessageId));

    // Scan Telegram Saved Messages in batches for both documents and photos
    const newFiles = [];

    // Helper to process messages and extract file metadata
    const processMessages = async (offsetId = 0) => {
      const batchSize = 100;
      let currentOffset = offsetId;
      let hasMore = true;
      let scannedCount = 0;
      const maxScan = 300; // Limit scan depth to 300 messages to prevent rate-limits and timeouts

      while (hasMore && scannedCount < maxScan) {
        const messages = await client.getMessages('me', {
          limit: batchSize,
          offsetId: currentOffset
        });

        if (!messages || messages.length === 0) break;

        for (const msg of messages) {
          if (!msg.media) continue;

          const msgId = msg.id;

          // Skip already indexed messages
          if (indexedMsgIds.has(msgId)) continue;

          let fileName = null;
          let fileSize = 0;
          let mimeType = 'application/octet-stream';
          const media = msg.media;

          if (media.document) {
            const doc = media.document;
            mimeType = doc.mimeType || 'application/octet-stream';
            fileSize = doc.size ? Number(doc.size) : 0;
            if (isNaN(fileSize)) fileSize = 0;

            const fileNameAttr = doc.attributes?.find(a => a.fileName);
            if (fileNameAttr) {
              fileName = fileNameAttr.fileName;
            } else {
              const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
              fileName = `file_${msgId}.${ext}`;
            }
          } else if (media.photo) {
            mimeType = 'image/jpeg';
            fileName = `photo_${msgId}.jpg`;
            const sizes = media.photo?.sizes;
            if (sizes && sizes.length > 0) {
              const largest = sizes[sizes.length - 1];
              fileSize = largest.size ? Number(largest.size) : 0;
              if (isNaN(fileSize)) fileSize = 0;
            }
          } else {
            // No usable media (e.g. webpage, geo, poll)
            continue;
          }

          if (!fileName) continue;

          newFiles.push({
            name: fileName,
            size: fileSize,
            mimeType,
            telegramMessageId: msgId,
            owner: req.user._id,
            folder: null,
          });
        }

        scannedCount += messages.length;

        if (messages.length < batchSize) {
          hasMore = false;
        } else {
          const nextOffset = messages[messages.length - 1].id;
          // Safeguard: if offset doesn't decrease, break to prevent infinite loop
          if (nextOffset >= currentOffset && currentOffset !== 0) {
            break;
          }
          currentOffset = nextOffset;
        }
      }
    };

    // Single pass through all Saved Messages — pick up documents AND photos
    await processMessages();

    // Insert new files into DB
    let inserted = 0;
    if (newFiles.length > 0) {
      try {
        const result = await File.insertMany(newFiles, { ordered: false });
        inserted = result.length;
      } catch (insertError) {
        // If it's a bulk write error, we can extract the number of successfully inserted files
        if (insertError.name === 'MongoBulkWriteError' || insertError.name === 'BulkWriteError') {
          inserted = insertError.result?.nInserted || 0;
          console.warn('[Sync] Duplicate files or validation issues skipped. Successfully inserted:', inserted);
        } else {
          console.error('[Sync] insertMany critical failure:', insertError);
          return res.status(500).json({ message: 'Database write failure: ' + insertError.message });
        }
      }
    }

    res.json({
      message: `Sync complete. Found ${inserted} new file(s) from Telegram.`,
      synced: inserted
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: error.message || 'Failed to sync files from Telegram.' });
  }
});

const getFileTypeCategory = (mimeType, name) => {
  const lower = name.toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType.startsWith('video/') || 
    lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.avi') || 
    lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.flv') || 
    lower.endsWith('.3gp')
  ) {
    return 'video';
  }
  if (
    mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || 
    mimeType.includes('compressed') || mimeType.includes('archive') ||
    lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z') || 
    lower.endsWith('.tar') || lower.endsWith('.gz') || lower.endsWith('.bz2') || 
    lower.endsWith('.xz')
  ) {
    return 'archive';
  }
  if (
    mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet') || 
    mimeType.includes('presentation') || mimeType.startsWith('text/') || 
    lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.md') || 
    lower.endsWith('.csv') || lower.endsWith('.doc') || lower.endsWith('.docx') || 
    lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.ppt') || 
    lower.endsWith('.pptx')
  ) {
    return 'document';
  }
  return 'other';
};

// @desc    Get drive statistics (total files, total size, size breakdown)
// @route   GET /api/drive/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    let files = [];
    if (global.isMockDB) {
      files = getMockFiles().filter(f => f.owner === req.user._id);
    } else {
      files = await File.find({ owner: req.user._id });
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const rootFilesCount = files.filter(f => !f.folder && !f.isDeleted).length;
    const starredCount = files.filter(f => f.isStarred && !f.isDeleted).length;
    const trashCount = files.filter(f => f.isDeleted).length;
    const totalActiveFiles = files.filter(f => !f.isDeleted).length;
    
    // Type breakdown count and size
    const breakdown = {
      image: { count: 0, size: 0 },
      video: { count: 0, size: 0 },
      archive: { count: 0, size: 0 },
      document: { count: 0, size: 0 },
      other: { count: 0, size: 0 }
    };

    files.forEach(f => {
      const cat = getFileTypeCategory(f.mimeType || 'application/octet-stream', f.name);
      breakdown[cat].count++;
      breakdown[cat].size += f.size;
    });

    res.json({
      totalFiles: files.length,
      totalActiveFiles,
      totalSize,
      rootFilesCount,
      starredCount,
      trashCount,
      breakdown
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error retrieving statistics' });
  }
});

// @desc    Download file from Telegram and stream back to browser
// @route   GET /api/drive/download/:id
// @access  Private
router.get('/download/:id', protect, async (req, res) => {
  try {
    let fileMetadata;
    if (global.isMockDB) {
      const files = getMockFiles();
      fileMetadata = files.find(f => f._id === req.params.id && f.owner === req.user._id);
    } else {
      fileMetadata = await File.findOne({ _id: req.params.id, owner: req.user._id });
    }

    if (!fileMetadata) {
      return res.status(404).json({ message: 'File not found' });
    }

    // 1. Fetch user's session
    let appUser;
    if (global.isMockDB) {
      const users = JSON.parse(fs.readFileSync(path.resolve('src/models/users_mock.json'), 'utf-8') || '[]');
      appUser = users.find(u => u._id === req.user._id);
    } else {
      appUser = await User.findById(req.user._id);
    }

    if (!appUser || !appUser.telegramSession) {
      return res.status(400).json({ message: 'Telegram account is not connected.' });
    }

    // 2. Connect Telegram
    const client = await getConnectedClient(appUser.telegramSession);

    // 3. Fetch Telegram message by ID
    const messages = await client.getMessages('me', {
      ids: [fileMetadata.telegramMessageId]
    });

    if (!messages || messages.length === 0 || !messages[0].media) {
      return res.status(404).json({ message: 'File media could not be located in Telegram.' });
    }

    // 4. Download thumbnail if requested (buffered in-memory)
    if (req.query.thumbnail === 'true') {
      let buffer;
      try {
        buffer = await client.downloadMedia(messages[0].media, { thumbSize: 'm' }) ||
                 await client.downloadMedia(messages[0].media, { thumbSize: 'x' }) ||
                 await client.downloadMedia(messages[0].media, { thumbSize: 's' });
      } catch (err) {
        console.warn('[Telegram Service] Thumbnail download failed, falling back to full media:', err);
      }
      if (buffer) {
        res.setHeader('Content-Type', fileMetadata.mimeType || 'image/jpeg');
        return res.send(buffer);
      }
    }

    // 5. Full file download / Range stream
    const fileSize = fileMetadata.size || 0;

    if (fileSize === 0) {
      res.setHeader('Content-Type', fileMetadata.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', '0');
      return res.end();
    }

    // Parse Range header
    const range = req.headers.range;
    let start = 0;
    let end = fileSize - 1;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start)) start = 0;
      if (isNaN(end)) end = fileSize - 1;
    }

    if (start < 0) start = 0;
    if (end >= fileSize) end = fileSize - 1;

    if (start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ message: 'Requested range not satisfiable' });
    }

    // Telegram MTProto requires offsets to be multiples of 4096 bytes (4 KB)
    const alignedStart = Math.floor(start / 4096) * 4096;
    const skipBytes = start - alignedStart;
    const totalBytesToSend = end - start + 1;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', fileMetadata.mimeType || 'application/octet-stream');

    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', totalBytesToSend);
    } else {
      res.status(200);
      res.setHeader('Content-Length', fileSize);
      if (req.query.download === 'true' || (!fileMetadata.mimeType?.startsWith('video/') && !fileMetadata.mimeType?.startsWith('audio/'))) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMetadata.name)}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileMetadata.name)}"`);
      }
    }

    // Stream the media chunks
    const chunkSize = 512 * 1024; // 512 KB
    let sentBytes = 0;

    const stream = client.iterDownload({
      file: messages[0].media,
      offset: bigInt(alignedStart),
      chunkSize: chunkSize,
      requestSize: chunkSize
    });

    let isFirstChunk = true;

    for await (let chunk of stream) {
      if (isFirstChunk) {
        isFirstChunk = false;
        if (skipBytes > 0) {
          chunk = chunk.slice(skipBytes);
        }
      }

      const remainingBytes = totalBytesToSend - sentBytes;
      if (remainingBytes <= 0) {
        break;
      }

      let dataToWrite = chunk;
      if (chunk.length > remainingBytes) {
        dataToWrite = chunk.slice(0, remainingBytes);
      }

      const ok = res.write(dataToWrite);
      sentBytes += dataToWrite.length;

      if (!ok) {
        await new Promise((resolve) => res.once('drain', resolve));
      }

      if (sentBytes >= totalBytesToSend) {
        break;
      }
    }
    res.end();
  } catch (error) {
    console.error('File download/stream error:', error);
    // Only send error response if headers have not been sent yet
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Failed to download/stream file from Telegram.' });
    } else {
      res.end();
    }
  }
});

// @desc    Get recent files
// @route   GET /api/drive/files/recent
// @access  Private
router.get('/files/recent', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const files = getMockFiles();
      const userFiles = files.filter(f => f.owner === req.user._id && !f.isDeleted);
      return res.json(userFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20));
    }
    const files = await File.find({ owner: req.user._id, isDeleted: { $ne: true } })
                            .sort({ createdAt: -1 })
                            .limit(20);
    res.json(files);
  } catch (error) {
    console.error('Get recent files error:', error);
    res.status(500).json({ message: 'Server error listing recent files' });
  }
});

// @desc    Get starred files
// @route   GET /api/drive/files/starred
// @access  Private
router.get('/files/starred', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const files = getMockFiles();
      const userFiles = files.filter(f => f.owner === req.user._id && f.isStarred && !f.isDeleted);
      return res.json(userFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }
    const files = await File.find({ owner: req.user._id, isStarred: true, isDeleted: { $ne: true } })
                            .sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    console.error('Get starred files error:', error);
    res.status(500).json({ message: 'Server error listing starred files' });
  }
});

// @desc    Get trash files
// @route   GET /api/drive/files/trash
// @access  Private
router.get('/files/trash', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const files = getMockFiles();
      const userFiles = files.filter(f => f.owner === req.user._id && f.isDeleted);
      return res.json(userFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }
    const files = await File.find({ owner: req.user._id, isDeleted: true })
                            .sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    console.error('Get trash files error:', error);
    res.status(500).json({ message: 'Server error listing trash files' });
  }
});

// @desc    Toggle star status
// @route   PUT /api/drive/files/:id/star
// @access  Private
router.put('/files/:id/star', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const files = getMockFiles();
      const fileIndex = files.findIndex(f => f._id === req.params.id && f.owner === req.user._id);
      if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
      
      files[fileIndex].isStarred = !files[fileIndex].isStarred;
      saveMockFiles(files);
      return res.json(files[fileIndex]);
    }
    
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) return res.status(404).json({ message: 'File not found' });
    
    file.isStarred = !file.isStarred;
    await file.save();
    res.json(file);
  } catch (error) {
    console.error('Toggle star error:', error);
    res.status(500).json({ message: 'Failed to toggle star' });
  }
});

// @desc    Toggle trash status (soft delete / restore)
// @route   PUT /api/drive/files/:id/trash
// @access  Private
router.put('/files/:id/trash', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const files = getMockFiles();
      const fileIndex = files.findIndex(f => f._id === req.params.id && f.owner === req.user._id);
      if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
      
      files[fileIndex].isDeleted = !files[fileIndex].isDeleted;
      saveMockFiles(files);
      return res.json(files[fileIndex]);
    }
    
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) return res.status(404).json({ message: 'File not found' });
    
    file.isDeleted = !file.isDeleted;
    await file.save();
    res.json(file);
  } catch (error) {
    console.error('Toggle trash error:', error);
    res.status(500).json({ message: 'Failed to toggle trash status' });
  }
});

// @desc    Move file to another folder
// @route   PUT /api/drive/files/:id/move
// @access  Private
router.put('/files/:id/move', protect, async (req, res) => {
  try {
    const { folderId } = req.body;
    
    if (global.isMockDB) {
      const files = getMockFiles();
      const fileIndex = files.findIndex(f => f._id === req.params.id && f.owner === req.user._id);
      if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
      
      files[fileIndex].folder = folderId === 'root' ? null : folderId;
      saveMockFiles(files);
      return res.json(files[fileIndex]);
    }
    
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) return res.status(404).json({ message: 'File not found' });
    
    file.folder = folderId === 'root' ? null : folderId;
    await file.save();
    res.json(file);
  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({ message: 'Failed to move file' });
  }
});

// @desc    Delete file permanently from Telegram and index database
// @route   DELETE /api/drive/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    let fileMetadata;
    if (global.isMockDB) {
      const files = getMockFiles();
      fileMetadata = files.find(f => f._id === req.params.id && f.owner === req.user._id);
    } else {
      fileMetadata = await File.findOne({ _id: req.params.id, owner: req.user._id });
    }

    if (!fileMetadata) {
      return res.status(404).json({ message: 'File not found' });
    }

    // 1. Fetch user's session
    let appUser;
    if (global.isMockDB) {
      const users = JSON.parse(fs.readFileSync(path.resolve('src/models/users_mock.json'), 'utf-8') || '[]');
      appUser = users.find(u => u._id === req.user._id);
    } else {
      appUser = await User.findById(req.user._id);
    }

    if (appUser && appUser.telegramSession) {
      try {
        // 2. Connect Telegram and delete message
        const client = await getConnectedClient(appUser.telegramSession);
        await client.deleteMessages('me', [fileMetadata.telegramMessageId], { revoke: true });
      } catch (tgErr) {
        console.warn('Failed to delete message directly from Telegram (it may already be deleted):', tgErr.message);
      }
    }

    // 3. Remove metadata from DB/file index
    if (global.isMockDB) {
      const files = getMockFiles();
      const filtered = files.filter(f => f._id !== req.params.id);
      saveMockFiles(filtered);
    } else {
      await File.deleteOne({ _id: req.params.id });
    }

    res.json({ message: 'File deleted successfully from drive and Telegram storage.' });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete file.' });
  }
});

// @desc    Get all folders for current user
// @route   GET /api/drive/folders
// @access  Private
router.get('/folders', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      const folders = getMockFolders();
      const files = getMockFiles();
      const userFolders = folders.filter(f => f.owner === req.user._id).map(folder => {
        const fileCount = files.filter(f => f.folder === folder._id && f.owner === req.user._id).length;
        return {
          ...folder,
          fileCount
        };
      });
      return res.json(userFolders);
    }

    const folders = await Folder.find({ owner: req.user._id }).sort({ name: 1 });
    const foldersWithCounts = await Promise.all(folders.map(async (folder) => {
      const fileCount = await File.countDocuments({ folder: folder._id, owner: req.user._id });
      return {
        ...folder.toObject(),
        fileCount
      };
    }));
    res.json(foldersWithCounts);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ message: 'Server error listing folders' });
  }
});

// @desc    Create a new folder
// @route   POST /api/drive/folders
// @access  Private
router.post('/folders', protect, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Folder name is required' });
  }

  try {
    let savedFolder;
    if (global.isMockDB) {
      const folders = getMockFolders();
      savedFolder = {
        _id: Date.now().toString(),
        name,
        owner: req.user._id,
        createdAt: new Date().toISOString()
      };
      folders.push(savedFolder);
      saveMockFolders(folders);
    } else {
      savedFolder = await Folder.create({
        name,
        owner: req.user._id
      });
    }

    res.status(201).json(savedFolder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: 'Server error creating folder' });
  }
});

// @desc    Delete folder and all files inside it
// @route   DELETE /api/drive/folders/:id
// @access  Private
router.delete('/folders/:id', protect, async (req, res) => {
  try {
    // 1. Fetch folder to ensure ownership
    let folder;
    if (global.isMockDB) {
      const folders = getMockFolders();
      folder = folders.find(f => f._id === req.params.id && f.owner === req.user._id);
    } else {
      folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
    }

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // 2. Fetch all files in this folder to delete from Telegram
    let filesToDelete = [];
    if (global.isMockDB) {
      const files = getMockFiles();
      filesToDelete = files.filter(f => f.folder === req.params.id && f.owner === req.user._id);
    } else {
      filesToDelete = await File.find({ folder: req.params.id, owner: req.user._id });
    }

    // 3. Connect to Telegram and delete messages
    let appUser;
    if (global.isMockDB) {
      const users = JSON.parse(fs.readFileSync(path.resolve('src/models/users_mock.json'), 'utf-8') || '[]');
      appUser = users.find(u => u._id === req.user._id);
    } else {
      appUser = await User.findById(req.user._id);
    }

    if (appUser && appUser.telegramSession && filesToDelete.length > 0) {
      try {
        const client = await getConnectedClient(appUser.telegramSession);
        const msgIds = filesToDelete.map(f => f.telegramMessageId);
        await client.deleteMessages('me', msgIds, { revoke: true });
      } catch (tgErr) {
        console.warn('Failed to delete messages from Telegram during folder deletion:', tgErr.message);
      }
    }

    // 4. Delete files from DB
    if (global.isMockDB) {
      const files = getMockFiles();
      const remainingFiles = files.filter(f => !(f.folder === req.params.id && f.owner === req.user._id));
      saveMockFiles(remainingFiles);

      const folders = getMockFolders();
      const remainingFolders = folders.filter(f => !(f._id === req.params.id && f.owner === req.user._id));
      saveMockFolders(remainingFolders);
    } else {
      await File.deleteMany({ folder: req.params.id, owner: req.user._id });
      await Folder.deleteOne({ _id: req.params.id, owner: req.user._id });
    }

    res.json({ message: 'Folder and all its files deleted successfully.' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ message: 'Server error deleting folder' });
  }
});

// @desc    Delete multiple files from Telegram and database
// @route   POST /api/drive/batch-delete
// @access  Private
router.post('/batch-delete', protect, async (req, res) => {
  const { fileIds } = req.body;
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({ message: 'List of file IDs is required' });
  }

  try {
    // 1. Fetch file metadatas to find Telegram message IDs
    let filesToDelete = [];
    if (global.isMockDB) {
      const files = getMockFiles();
      filesToDelete = files.filter(f => fileIds.includes(f._id) && f.owner === req.user._id);
    } else {
      filesToDelete = await File.find({ _id: { $in: fileIds }, owner: req.user._id });
    }

    if (filesToDelete.length === 0) {
      return res.status(404).json({ message: 'No valid files found to delete' });
    }

    // 2. Fetch session
    let appUser;
    if (global.isMockDB) {
      const users = JSON.parse(fs.readFileSync(path.resolve('src/models/users_mock.json'), 'utf-8') || '[]');
      appUser = users.find(u => u._id === req.user._id);
    } else {
      appUser = await User.findById(req.user._id);
    }

    // 3. Connect Telegram and delete messages
    if (appUser && appUser.telegramSession) {
      try {
        const client = await getConnectedClient(appUser.telegramSession);
        const msgIds = filesToDelete.map(f => f.telegramMessageId);
        await client.deleteMessages('me', msgIds, { revoke: true });
      } catch (tgErr) {
        console.warn('Failed to delete messages from Telegram during batch deletion:', tgErr.message);
      }
    }

    // 4. Remove metadata from DB/file index
    const deletedCount = filesToDelete.length;
    const actualDeletedIds = filesToDelete.map(f => f._id);

    if (global.isMockDB) {
      const files = getMockFiles();
      const remainingFiles = files.filter(f => !actualDeletedIds.includes(f._id));
      saveMockFiles(remainingFiles);
    } else {
      await File.deleteMany({ _id: { $in: actualDeletedIds } });
    }

    res.json({ message: `Successfully deleted ${deletedCount} files.`, deletedIds: actualDeletedIds });
  } catch (error) {
    console.error('Batch deletion error:', error);
    res.status(500).json({ message: 'Server error performing batch deletion' });
  }
});

// @desc    Move multiple files to a folder
// @route   POST /api/drive/batch-move
// @access  Private
router.post('/batch-move', protect, async (req, res) => {
  const { fileIds, targetFolderId } = req.body;
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({ message: 'List of file IDs is required' });
  }

  const folderValue = (targetFolderId && targetFolderId !== 'root') ? targetFolderId : null;

  try {
    // Validate folder ownership if folderValue is set
    if (folderValue) {
      let folderExists;
      if (global.isMockDB) {
        const folders = getMockFolders();
        folderExists = folders.find(f => f._id === folderValue && f.owner === req.user._id);
      } else {
        folderExists = await Folder.findOne({ _id: folderValue, owner: req.user._id });
      }

      if (!folderExists) {
        return res.status(404).json({ message: 'Target folder not found' });
      }
    }

    // Update files
    if (global.isMockDB) {
      const files = getMockFiles();
      files.forEach(f => {
        if (fileIds.includes(f._id) && f.owner === req.user._id) {
          f.folder = folderValue;
        }
      });
      saveMockFiles(files);
    } else {
      await File.updateMany(
        { _id: { $in: fileIds }, owner: req.user._id },
        { $set: { folder: folderValue } }
      );
    }

    res.json({ message: `Successfully moved ${fileIds.length} files.`, targetFolderId: folderValue });
  } catch (error) {
    console.error('Batch move error:', error);
    res.status(500).json({ message: 'Server error performing batch move' });
  }
});

// @desc    Generate a public share link for a file
// @route   PUT /api/drive/files/:id/share
// @access  Private
router.put('/files/:id/share', protect, async (req, res) => {
  try {
    const fileId = req.params.id;
    const shareToken = crypto.randomBytes(16).toString('hex');

    if (global.isMockDB) {
      const files = getMockFiles();
      const fileIndex = files.findIndex(f => f._id === fileId && f.owner === req.user._id);
      if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
      files[fileIndex].isPublic = true;
      files[fileIndex].shareToken = shareToken;
      saveMockFiles(files);
      return res.json({ message: 'File shared successfully', shareToken, isPublic: true });
    } else {
      const file = await File.findOne({ _id: fileId, owner: req.user._id });
      if (!file) return res.status(404).json({ message: 'File not found' });

      file.isPublic = true;
      file.shareToken = shareToken;
      await file.save();

      return res.json({ message: 'File shared successfully', shareToken, isPublic: true });
    }
  } catch (error) {
    console.error('Share file error:', error);
    res.status(500).json({ message: 'Server error sharing file' });
  }
});

// @desc    Revoke public share link for a file
// @route   PUT /api/drive/files/:id/unshare
// @access  Private
router.put('/files/:id/unshare', protect, async (req, res) => {
  try {
    const fileId = req.params.id;

    if (global.isMockDB) {
      const files = getMockFiles();
      const fileIndex = files.findIndex(f => f._id === fileId && f.owner === req.user._id);
      if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
      files[fileIndex].isPublic = false;
      files[fileIndex].shareToken = null;
      saveMockFiles(files);
      return res.json({ message: 'File sharing revoked successfully', shareToken: null, isPublic: false });
    } else {
      const file = await File.findOne({ _id: fileId, owner: req.user._id });
      if (!file) return res.status(404).json({ message: 'File not found' });

      file.isPublic = false;
      file.shareToken = null;
      await file.save();

      return res.json({ message: 'File sharing revoked successfully', shareToken: null, isPublic: false });
    }
  } catch (error) {
    console.error('Unshare file error:', error);
    res.status(500).json({ message: 'Server error revoking share' });
  }
});

// @desc    Rename a file
// @route   PUT /api/drive/files/:id/rename
// @access  Private
router.put('/files/:id/rename', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    if (global.isMockDB) {
      const files = getMockFiles();
      const fileIndex = files.findIndex(f => f._id === req.params.id && f.owner === req.user._id);
      if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
      files[fileIndex].name = name;
      saveMockFiles(files);
      return res.json({ message: 'File renamed successfully', name });
    } else {
      const file = await File.findOneAndUpdate(
        { _id: req.params.id, owner: req.user._id },
        { name },
        { new: true }
      );
      if (!file) return res.status(404).json({ message: 'File not found' });
      return res.json({ message: 'File renamed successfully', name: file.name });
    }
  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({ message: 'Server error renaming file' });
  }
});

// @desc    Rename a folder
// @route   PUT /api/drive/folders/:id/rename
// @access  Private
router.put('/folders/:id/rename', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    if (global.isMockDB) {
      const folders = getMockFolders();
      const folderIndex = folders.findIndex(f => f._id === req.params.id && f.owner === req.user._id);
      if (folderIndex === -1) return res.status(404).json({ message: 'Folder not found' });
      folders[folderIndex].name = name;
      saveMockFolders(folders);
      return res.json({ message: 'Folder renamed successfully', name });
    } else {
      const folder = await Folder.findOneAndUpdate(
        { _id: req.params.id, owner: req.user._id },
        { name },
        { new: true }
      );
      if (!folder) return res.status(404).json({ message: 'Folder not found' });
      return res.json({ message: 'Folder renamed successfully', name: folder.name });
    }
  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({ message: 'Server error renaming folder' });
  }
});

// @desc    Change a folder's color
// @route   PUT /api/drive/folders/:id/color
// @access  Private
router.put('/folders/:id/color', protect, async (req, res) => {
  try {
    const { color } = req.body;
    if (!color) return res.status(400).json({ message: 'Color is required' });

    if (global.isMockDB) {
      const folders = getMockFolders();
      const folderIndex = folders.findIndex(f => f._id === req.params.id && f.owner === req.user._id);
      if (folderIndex === -1) return res.status(404).json({ message: 'Folder not found' });
      folders[folderIndex].color = color;
      saveMockFolders(folders);
      return res.json({ message: 'Folder color updated successfully', color });
    } else {
      const folder = await Folder.findOneAndUpdate(
        { _id: req.params.id, owner: req.user._id },
        { color },
        { new: true }
      );
      if (!folder) return res.status(404).json({ message: 'Folder not found' });
      return res.json({ message: 'Folder color updated successfully', color: folder.color });
    }
  } catch (error) {
    console.error('Color folder error:', error);
    res.status(500).json({ message: 'Server error updating folder color' });
  }
});

export default router;
