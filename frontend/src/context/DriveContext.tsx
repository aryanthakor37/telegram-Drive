import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_URL } from '../config/api';

export interface DriveFolder {
  _id: string;
  name: string;
  owner: string;
  createdAt: string;
  fileCount?: number;
  color?: string;
}

interface DriveContextProps {
  folders: DriveFolder[];
  setFolders: React.Dispatch<React.SetStateAction<DriveFolder[]>>;
  currentFolder: DriveFolder | null;
  setCurrentFolder: React.Dispatch<React.SetStateAction<DriveFolder | null>>;
  loadingFolders: boolean;
  stats: any;
  setStats: React.Dispatch<React.SetStateAction<any>>;
  syncing: boolean;
  setSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  theme: 'dark' | 'light';
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
  viewMode: 'grid' | 'list';
  setViewMode: React.Dispatch<React.SetStateAction<'grid' | 'list'>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  storagePercentage: number;
  driveTotalSize: number;
  fetchFolders: () => Promise<void>;
  fetchStats: () => Promise<void>;
  refreshFilesTrigger: number;
  triggerFilesRefresh: () => void;
}

const DriveContext = createContext<DriveContextProps | undefined>(undefined);

export const DriveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<DriveFolder | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const [refreshFilesTrigger, setRefreshFilesTrigger] = useState(0);

  const triggerFilesRefresh = () => {
    setRefreshFilesTrigger(prev => prev + 1);
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('viewMode') as 'grid' | 'list') || 'grid';
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  const fetchFolders = async () => {
    try {
      setLoadingFolders(true);
      const res = await axios.get(`${API_URL}/drive/folders`, { withCredentials: true });
      setFolders(res.data);
    } catch (err) {
      console.error('Failed to fetch folders', err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/drive/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFolders();
      fetchStats();
    } else {
      setFolders([]);
      setStats(null);
    }
  }, [token]);

  const driveTotalSize = stats?.totalSize || 0;
  // Dynamic visual level for unlimited storage: starts at 12% and adds 5% per GB up to a max of 75%
  const storagePercentage = Math.min(12 + (driveTotalSize / (1024 * 1024 * 1024)) * 5, 75);

  return (
    <DriveContext.Provider
      value={{
        folders, setFolders,
        currentFolder, setCurrentFolder,
        loadingFolders,
        stats, setStats,
        syncing, setSyncing,
        theme, setTheme,
        viewMode, setViewMode,
        searchQuery, setSearchQuery,
        storagePercentage, driveTotalSize,
        fetchFolders, fetchStats,
        refreshFilesTrigger,
        triggerFilesRefresh
      }}
    >
      {children}
    </DriveContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDrive = () => {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error('useDrive must be used within a DriveProvider');
  }
  return context;
};