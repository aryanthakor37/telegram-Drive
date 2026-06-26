import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDrive } from '../context/DriveContext';
import { Background3D } from '../components/Background3D';
import { StorageOrb3D } from '../components/StorageOrb3D';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  LogOut, Search, Menu, X, Folder, FolderPlus, Sun, Moon, LayoutGrid, List,
  RefreshCw, Loader, Trash, Shield, Clock, Star, Settings, Edit3, Palette, File
} from 'lucide-react';
import ContextMenu from '../components/ContextMenu';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../config/api';

const DashboardLayout: React.FC = () => {
  const { user: _user, logout } = useAuth();
  const {
    folders, setFolders,
    currentFolder, setCurrentFolder,
    loadingFolders,
    stats,
    syncing, setSyncing,
    theme, setTheme,
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    storagePercentage, driveTotalSize,
    fetchFolders, fetchStats,
    triggerFilesRefresh
  } = useDrive();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Folder Context Menu State
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number, y: number, folder: any } | null>(null);
  const [renameFolderModal, setRenameFolderModal] = useState<{ isOpen: boolean, folder: any | null, newName: string }>({ isOpen: false, folder: null, newName: '' });

  const navigate = useNavigate();
  const location = useLocation();

  const handleDragOver = (e: React.DragEvent, folderId: string | 'root') => {
    e.preventDefault();
    if (dragOverFolderId !== folderId) setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const fileId = e.dataTransfer.getData('text/plain');
    if (!fileId) return;

    try {
      await axios.put(`${API_URL}/drive/files/${fileId}/move`, { folderId: folderId || 'root' }, { withCredentials: true });
      fetchFolders();
      fetchStats();
      triggerFilesRefresh();
      toast.success('File moved');
    } catch (err: any) {
      console.error('Move failed:', err);
      toast.error('Failed to move file');
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/drive/folders`, { name: newFolderName }, { withCredentials: true });
      setFolders([...folders, { ...res.data, fileCount: 0 }]);
      setNewFolderName('');
      setShowCreateFolder(false);
      toast.success('Folder created');
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      toast.error('Failed to create folder: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete folder "${name}"? Files inside will be moved to root.`)) return;
    try {
      await axios.delete(`${API_URL}/drive/folders/${id}`, { withCredentials: true });
      setFolders(folders.filter(f => f._id !== id));
      if (currentFolder?._id === id) {
        setCurrentFolder(null);
      }
      toast.success('Folder deleted');
    } catch (err: any) {
      console.error('Failed to delete folder:', err);
      toast.error('Failed to delete folder');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API_URL}/drive/sync`, {}, { withCredentials: true });
      await Promise.all([fetchFolders(), fetchStats()]);
      triggerFilesRefresh();
      toast.success(res.data.message || 'Synced successfully');
    } catch (err: any) {
      console.error('Sync failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleFolderContextMenu = (folder: any, e: React.MouseEvent) => {
    e.preventDefault();
    setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
  };

  const handleRenameFolder = async () => {
    if (!renameFolderModal.folder || !renameFolderModal.newName.trim()) return;
    try {
      const res = await axios.put(`${API_URL}/drive/folders/${renameFolderModal.folder._id}/rename`, { name: renameFolderModal.newName }, { withCredentials: true });
      setFolders(folders.map(f => f._id === renameFolderModal.folder._id ? { ...f, name: res.data.name } : f));
      toast.success('Folder renamed');
      setRenameFolderModal({ isOpen: false, folder: null, newName: '' });
    } catch (err) {
      console.error('Rename folder failed:', err);
      toast.error('Failed to rename folder');
    }
  };

  const handleChangeFolderColor = async (folderId: string, color: string) => {
    try {
      await axios.put(`${API_URL}/drive/folders/${folderId}/color`, { color }, { withCredentials: true });
      setFolders(folders.map(f => f._id === folderId ? { ...f, color } : f));
      toast.success('Folder color updated');
    } catch (err) {
      console.error('Change folder color failed:', err);
      toast.error('Failed to change color');
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`${API_URL}/drive/search?q=${encodeURIComponent(query)}`, { withCredentials: true });
        setSearchResults(res.data);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navigateTo = (path: string, folder: any = null) => {
    setCurrentFolder(folder);
    navigate(path);
    closeMobileMenu();
  };

  const isRouteActive = (path: string) => location.pathname === path;
  const isFolderActive = (folderId: string | null) => location.pathname === '/my-files' && currentFolder?._id === folderId;

  const getHeaderTitle = () => {
    if (currentFolder) return currentFolder.name;
    if (location.pathname.startsWith('/category/')) {
      const cat = location.pathname.split('/').pop() || '';
      if (cat === 'image') return 'Images';
      if (cat === 'video') return 'Videos';
      if (cat === 'document') return 'Documents';
      if (cat === 'archive') return 'Archives';
      return cat.charAt(0).toUpperCase() + cat.slice(1);
    }
    if (isRouteActive('/my-files') || location.pathname === '/') return 'Saved Messages';
    const baseName = location.pathname.slice(1);
    return baseName.charAt(0).toUpperCase() + baseName.slice(1).replace('-', ' ');
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark-950 text-white dark' : 'bg-slate-50 text-slate-900'} font-sans selection:bg-brand-500/30 overflow-hidden relative`}>

      {/* 3D Background - Persistent */}
      <Background3D />

      <div className="flex h-screen relative z-10">

        {/* Mobile Menu Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
            onClick={closeMobileMenu}
          />
        )}

        {/* SIDEBAR */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-70 sm:w-72 bg-white/70 dark:bg-dark-900/40 backdrop-blur-xl border-r border-slate-200/80 dark:border-dark-850/60 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col shadow-2xl lg:shadow-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>

          <div className="p-5 flex items-center justify-between border-b border-slate-200/50 dark:border-dark-850/40">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-linear-to-br from-brand-400 to-brand-600 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center transform transition-transform hover:scale-105 hover:rotate-3 duration-300">
                  <Shield className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight">
                TG-Drive
              </span>
            </div>
            <button
              onClick={closeMobileMenu}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
            {/* Main Navigation */}
            <nav className="space-y-0.5 mt-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-600 px-3 pb-1.5 pt-0.5 tracking-widest">Drive</p>
              {[
                { path: '/my-files', label: 'My Files', icon: <Folder className="w-4 h-4" />, count: stats?.rootFilesCount, color: 'text-brand-500', bg: 'bg-brand-500/10' },
                { path: '/recent', label: 'Recent', icon: <Clock className="w-4 h-4" />, count: stats?.totalActiveFiles, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { path: '/starred', label: 'Starred', icon: <Star className="w-4 h-4" />, count: stats?.starredCount, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                { path: '/trash', label: 'Trash', icon: <Trash className="w-4 h-4" />, count: stats?.trashCount, color: 'text-red-500', bg: 'bg-red-500/10' },
                { path: '/settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, count: undefined, color: 'text-slate-500', bg: 'bg-slate-500/10' },
              ].map(({ path, label, icon, count, color, bg }) => {
                const active = isRouteActive(path);
                return (
                  <button
                    key={path}
                    onClick={() => navigateTo(path, null)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group/nav ${
                      active
                        ? `${color} ${bg} shadow-sm`
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-850/40 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={active ? color : 'text-slate-400 dark:text-slate-500 group-hover/nav:text-slate-600 dark:group-hover/nav:text-slate-300'}>{icon}</span>
                      {label}
                    </div>
                    {count !== undefined && count > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        active ? `${color} bg-white/30 dark:bg-black/20` : 'bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-450'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Folders Section */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-600 px-3 pb-1.5 pt-0.5 tracking-widest">Folders</p>
              <nav className="space-y-1">
                {/* Default Root Folder */}
                <button
                  onClick={() => navigateTo('/my-files', null)}
                  onDragOver={(e) => handleDragOver(e, 'root')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, null)}
                  className={`folder-btn-hover w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all border-l-4 ${dragOverFolderId === 'root'
                    ? 'bg-brand-500/20 border-brand-500 scale-[1.02]'
                    : isFolderActive(null)
                      ? 'text-brand-500 dark:text-brand-400 bg-brand-500/10 border-brand-500'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-850/40 hover:text-slate-900 dark:hover:text-white border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder className={`w-4.5 h-4.5 ${isFolderActive(null) || dragOverFolderId === 'root' ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate">Saved Messages</span>
                  </div>
                  {stats && stats.rootFilesCount !== undefined && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-450">
                      {stats.rootFilesCount}
                    </span>
                  )}
                </button>

                {/* Dynamic Database Folders */}
                {loadingFolders ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                ) : (
                  folders.map((folder) => (
                    <div key={folder._id} className="group flex items-center justify-between rounded-xl transition-all">
                      <button
                        onClick={() => navigateTo('/my-files', folder)}
                        onDragOver={(e) => handleDragOver(e, folder._id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, folder._id)}
                        onContextMenu={(e) => handleFolderContextMenu(folder, e)}
                        className={`folder-btn-hover flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left truncate border-l-4 ${dragOverFolderId === folder._id
                          ? 'bg-brand-500/20 border-brand-500 scale-[1.02]'
                          : isFolderActive(folder._id)
                            ? 'text-brand-500 dark:text-brand-400 bg-brand-500/10 border-brand-500'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-850/40 hover:text-slate-900 dark:hover:text-white border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Folder className={`w-4.5 h-4.5 shrink-0 ${isFolderActive(folder._id) || dragOverFolderId === folder._id ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'}`} style={folder.color ? { color: folder.color } : {}} />
                          <span className="truncate">{folder.name}</span>
                        </div>
                        {folder.fileCount !== undefined && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-800 text-slate-500 dark:text-slate-450 ml-1">
                            {folder.fileCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder._id, folder.name); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-opacity rounded-lg ml-1"
                        title="Delete Folder"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}

                {/* Create Folder Sidebar Button */}
                {!showCreateFolder ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateFolder(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-850/20 border border-dashed border-slate-250 dark:border-slate-800 transition-all text-left group/create-folder"
                  >
                    <FolderPlus className="w-4 h-4 text-slate-450 group-hover/create-folder:text-brand-500" />
                    <span>Create Folder</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateFolder} className="px-2 space-y-2 mt-2">
                    <input
                      type="text"
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-dark-950/60 border border-slate-300 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white">Cancel</button>
                      <button type="submit" className="px-2.5 py-1 text-xs bg-brand-500 text-white rounded-lg font-medium">Create</button>
                    </div>
                  </form>
                )}
              </nav>
            </div>
          </div>

          {/* Footer Section */}
          <div className="p-4 border-t border-slate-200 dark:border-dark-850/60 bg-slate-50/50 dark:bg-dark-900/40 space-y-4 rounded-b-3xl">
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 py-2 px-3 bg-slate-200 dark:bg-dark-850 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all group/sync disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : 'group-hover/sync:rotate-180 transition-transform duration-500'}`} /> Sync
              </button>
              <button
                onClick={logout}
                className="flex-1 py-2 px-3 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-650 dark:text-red-400 font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>

            <div className="flex items-center gap-3 px-2 py-1.5 bg-gradient-to-r from-slate-100/60 to-transparent dark:from-dark-950/30 dark:to-transparent border border-slate-200/50 dark:border-slate-800/40 rounded-2xl">
              <StorageOrb3D percentage={storagePercentage} showPercentage={false} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-tight">Drive Capacity</p>
                  <p className="text-[9px] font-bold text-brand-500">Unlimited</p>
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 truncate">{formatBytes(driveTotalSize)} used</p>
                <div className="w-full h-1 bg-slate-200 dark:bg-dark-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700"
                    style={{ width: `${Math.min(100, storagePercentage)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          {/* HEADER */}
          <header className="sticky top-0 z-40 bg-white/75 dark:bg-dark-900/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-850 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-slate-600 dark:text-slate-350 p-1">
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-1.5 text-sm font-semibold overflow-hidden">
                <span className="truncate max-w-30 md:max-w-xs font-bold text-brand-600 dark:text-brand-400">
                  {getHeaderTitle()}
                </span>
              </div>
            </div>

            <div className={`flex-1 transition-all duration-300 ${searchFocused ? 'max-w-lg' : 'max-w-md'} relative mx-2 hidden md:block group`}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className={`w-4 h-4 transition-transform duration-350 ${searchFocused ? 'rotate-12 text-brand-500' : ''}`} />
              </div>
              <input
                type="text"
                placeholder="Search files globally..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-dark-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-450 focus:outline-none focus:border-brand-500/50 transition-all text-xs font-medium"
              />
              {/* Search Dropdown */}
              {searchFocused && searchQuery.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400 font-semibold px-4">
                    <span>Search Results</span>
                    {isSearching && <Loader className="w-3 h-3 animate-spin text-brand-500" />}
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {searchResults.length === 0 && !isSearching ? (
                      <div className="p-4 text-center text-xs text-slate-500">No matching files found.</div>
                    ) : (
                      searchResults.map(file => (
                        <div
                          key={file._id}
                          className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-dark-850 cursor-pointer flex items-center justify-between border-b border-slate-50 dark:border-dark-800/50 last:border-0"
                          onClick={() => {
                            // Quick navigate to folder
                            if (file.folder) {
                              const folder = folders.find(f => f._id === file.folder);
                              navigateTo('/my-files', folder);
                            } else {
                              navigateTo('/my-files', null);
                            }
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <File className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col truncate">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{file.name}</span>
                              <span className="text-[10px] text-slate-400 truncate">{formatBytes(file.size)} • {new Date(file.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-100 dark:bg-dark-950 rounded-lg p-0.5 flex border border-slate-200 dark:border-slate-800/40">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-850 shadow-sm text-brand-500 dark:text-brand-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-850 shadow-sm text-brand-500 dark:text-brand-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} className="p-2 text-slate-500 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-dark-850 rounded-xl transition-all group/theme active:scale-90" title="Toggle Theme">
                {theme === 'dark' ? <Sun className="w-4.5 h-4.5 group-hover/theme:rotate-180 transition-transform duration-500" /> : <Moon className="w-4.5 h-4.5 group-hover/theme:rotate-[-30deg] group-hover/theme:scale-110 transition-transform duration-500" />}
              </button>
            </div>
          </header>

          {/* MOBILE SEARCH BAR */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-850 md:hidden bg-white/30 dark:bg-dark-950/20">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className={`w-4 h-4 ${mobileSearchFocused ? 'text-brand-500' : ''}`} />
              </div>
              <input
                type="text"
                placeholder="Search files globally..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setMobileSearchFocused(true)}
                onBlur={() => setTimeout(() => setMobileSearchFocused(false), 200)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-dark-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-brand-500/50 text-xs"
              />
              {/* Mobile Search Dropdown */}
              {mobileSearchFocused && searchQuery.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {searchResults.length === 0 && !isSearching ? (
                      <div className="p-4 text-center text-xs text-slate-500">No matching files found.</div>
                    ) : (
                      searchResults.map(file => (
                        <div
                          key={file._id}
                          className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-dark-850 cursor-pointer flex items-center justify-between border-b border-slate-50 dark:border-dark-800/50 last:border-0"
                          onClick={() => {
                            if (file.folder) {
                              const folder = folders.find(f => f._id === file.folder);
                              navigateTo('/my-files', folder);
                            } else {
                              navigateTo('/my-files', null);
                            }
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <File className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col truncate">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{file.name}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PAGE CONTENT */}
          <main className="flex-1 p-4 md:p-6 pb-24 overflow-y-auto custom-scrollbar relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {folderContextMenu && (
        <ContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          onClose={() => setFolderContextMenu(null)}
          actions={[
            {
              label: 'Rename',
              icon: <Edit3 className="w-4 h-4" />,
              onClick: () => setRenameFolderModal({ isOpen: true, folder: folderContextMenu.folder, newName: folderContextMenu.folder.name })
            },
            {
              label: 'Change Color',
              icon: <Palette className="w-4 h-4" />,
              onClick: () => {
                // To keep it simple, we use a prompt for now or cycle through colors. Let's just set a preset color.
                const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#cbd5e1'];
                const currentColor = folderContextMenu.folder.color || '#cbd5e1';
                const nextColor = colors[(colors.indexOf(currentColor) + 1) % colors.length];
                handleChangeFolderColor(folderContextMenu.folder._id, nextColor);
              }
            },
            {
              label: 'Delete',
              icon: <Trash className="w-4 h-4" />,
              danger: true,
              onClick: () => handleDeleteFolder(folderContextMenu.folder._id, folderContextMenu.folder.name)
            }
          ]}
        />
      )}

      {/* Rename Folder Modal */}
      {renameFolderModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Rename Folder</h3>
            <input
              type="text"
              value={renameFolderModal.newName}
              onChange={(e) => setRenameFolderModal(prev => ({ ...prev, newName: e.target.value }))}
              className="w-full bg-slate-100 dark:bg-dark-800 border-none rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 mb-6"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenameFolderModal({ isOpen: false, folder: null, newName: '' }); }}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRenameFolderModal({ isOpen: false, folder: null, newName: '' })} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors">Cancel</button>
              <button onClick={handleRenameFolder} className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;