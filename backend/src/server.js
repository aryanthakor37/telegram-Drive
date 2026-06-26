import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import telegramAuthRoutes from './routes/telegramAuth.js';
import driveRoutes from './routes/drive.js';
import publicRoutes from './routes/public.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';




const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.1.165:5173'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Support Private Network Access preflight checks (PNA)
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(express.json());

// Routes
app.use('/api/telegram', telegramAuthRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/public', publicRoutes);


// Base route
app.get('/', (req, res) => {
  res.send('Telegram Drive Backend API is running...');
});

// Catch 404
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

// Connect to MongoDB & Start Server
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telegram-drive';
    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    app.listen(PORT, () => {
      console.log(`Server running in development mode on port ${PORT}`);
    });
  } catch (error) {
    console.warn('================================================================');
    console.warn('DATABASE CONNECTION WARNING: Failed to connect to MongoDB.');
    console.warn('Falling back to Local JSON File mock database for testing.');
    console.warn('This allows authentication and dashboards to work immediately!');
    console.warn(`Reason: ${error.message}`);
    console.warn('================================================================');
    global.isMockDB = true;
    app.listen(PORT, () => {
      console.log(`Server running in MOCK mode on port ${PORT}`);
    });
  }
};



connectDB();
