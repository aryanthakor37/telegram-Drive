import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

// Map to hold pending login clients
// key: phoneNumber, value: { client, phoneCodeHash }
export const pendingClients = new Map();

// Cache to store connected clients by session string to prevent socket leakage
const connectedClients = new Map();

/**
 * Helper to get a connected TelegramClient instance using a saved session string
 * @param {string} sessionString 
 * @returns {Promise<TelegramClient>}
 */
export const getConnectedClient = async (sessionString) => {
  const apiId = parseInt(process.env.TG_API_ID || '0');
  const apiHash = process.env.TG_API_HASH || '';

  if (!apiId || !apiHash) {
    throw new Error('Telegram API_ID and API_HASH must be configured in environment variables.');
  }

  // Check cache first to reuse the active connection
  if (sessionString && connectedClients.has(sessionString)) {
    const cachedClient = connectedClients.get(sessionString);
    try {
      if (cachedClient.connected) {
        return cachedClient;
      }
    } catch (err) {
      console.warn('[Telegram Service] Cached client active check failed:', err);
    }
    // Clean up stale client
    connectedClients.delete(sessionString);
  }

  const client = new TelegramClient(
    new StringSession(sessionString || ''),
    apiId,
    apiHash,
    {
      // useWSS: true is REQUIRED to bypass ISP censorship blocks on raw TCP ports in certain regions (e.g. India)
      useWSS: true,
      connectionRetries: 5
    }
  );

  await client.connect();

  if (sessionString) {
    connectedClients.set(sessionString, client);
  }

  return client;
};

/**
 * Helper to create a new client for login setup
 * @returns {TelegramClient}
 */
export const createLoginClient = () => {
  const apiId = parseInt(process.env.TG_API_ID || '0');
  const apiHash = process.env.TG_API_HASH || '';

  if (!apiId || !apiHash) {
    throw new Error('Telegram API_ID and API_HASH must be configured in environment variables.');
  }

  return new TelegramClient(
    new StringSession(''),
    apiId,
    apiHash,
    {
      useWSS: true,
      connectionRetries: 5
    }
  );
};
