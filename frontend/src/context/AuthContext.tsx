import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

export interface User {
  _id: string;
  username: string;
  telegramPhone: string;
  telegramConnected: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  sendOtp: (phoneNumber: string) => Promise<{ phoneCodeHash: string }>;
  verifyOtp: (phoneNumber: string, phoneCodeHash: string, phoneCode: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  // Set axios headers automatically
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  // Load user status on launch
  useEffect(() => {
    const checkStatus = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const res = await axios.get(`${API_URL}/telegram/status`);

        if (res.data.connected) {
          setUser({
            _id: localStorage.getItem('userId') || '1',
            username: res.data.username || 'Telegram User',
            telegramPhone: res.data.phone || '',
            telegramConnected: true
          });
        } else {
          // Connected false means session expired
          logout();
        }
      } catch (err) {
        console.error('Failed to get connection status', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sendOtp = async (phoneNumber: string) => {
    try {
      const res = await axios.post(`${API_URL}/telegram/send-code`, { phoneNumber });
      return res.data; // contains phoneCodeHash
    } catch (err: any) {
      if (err.response?.status === 429 && err.response?.data?.floodWait) {
        const floodError = new Error(err.response.data.message || 'Telegram OTP request limit reached.');
        (floodError as any).floodWait = true;
        (floodError as any).seconds = err.response.data.seconds;
        throw floodError;
      }
      throw new Error(err.response?.data?.message || 'Failed to send OTP. Please check the number.');
    }
  };

  const verifyOtp = async (phoneNumber: string, phoneCodeHash: string, phoneCode: string) => {
    try {
      const res = await axios.post(`${API_URL}/telegram/verify-code`, {
        phoneNumber,
        phoneCodeHash,
        phoneCode
      });

      const { token: userToken, ...userData } = res.data;

      localStorage.setItem('token', userToken);
      localStorage.setItem('userId', userData._id);

      setToken(userToken);
      setUser(userData);

      axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Invalid OTP code. Please try again.');
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/telegram/logout`);
      }
    } catch (err) {
      console.warn('Failed to notify backend on logout', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        sendOtp,
        verifyOtp,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
