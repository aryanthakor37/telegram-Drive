import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDrive } from '../../context/DriveContext';

import {
  File, Image, Video, Music, Archive, FileText, Download, Trash2,
  Plus, AlertCircle, Star, X, FileCode, Share2, HardDrive,
  ChevronDown, ChevronUp, FolderOpen
} from 'lucide-react';
import FileCard from '../../components/FileCard';
import ContextMenu from '../../components/ContextMenu';
import Lightbox from '../../components/Lightbox';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { API_URL } from '../../config/api';

interface DriveFile {
  _id: string;
  name: string;
  size: number;
  mimeType: string;
  telegramMessageId?: number;
  folder: string | null;
  isStarred?: boolean;
  createdAt: string;
}

type CategoryType = 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

const getFileCategory = (mimeType: string, name: string): CategoryType => {
  const lower = name.toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.mov') || lower.endsWith('.avi')) return 'video';
  if (mimeType.startsWith('audio/') || lower.endsWith('.mp3') || lower.endsWith('.flac') || lower.endsWith('.wav')) return 'audio';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z') || lower.endsWith('.tar') || lower.endsWith('.gz')) return 'archive';
  if (mimeType.includes('pdf') || lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.ppt') || lower.endsWith('.pptx') || lower.endsWith('.txt')) return 'document';
  return 'other';
};

const CATEGORY_TABS: { id: CategoryType; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
  { id: 'all', label: 'All Files', icon: <FolderOpen className="w-4 h-4" />, color: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500' },
  { id: 'image', label: 'Images', icon: <Image className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500' },
  { id: 'video', label: 'Videos', icon: <Video className="w-4 h-4" />, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500' },
  { id: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" />, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500' },
  { id: 'document', label: 'Documents', icon: <FileText className="w-4 h-4" />, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500' },
  { id: 'archive', label: 'Archives', icon: <Archive className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500' },
];

const MyFiles: React.FC = () => {
  const { currentFolder, viewMode, searchQuery, refreshFilesTrigger, stats, storagePercentage } = useDrive();

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');

  const [sortField, setSortField] = useState<'name' | 'size' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview State
  const [activePreviewFile, setActivePreviewFile] = useState<DriveFile | null>(null);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: DriveFile } | null>(null);

  // Multi-Selection
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const handleToggleSelect = (file: DriveFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFiles(prev =>
      prev.includes(file._id) ? prev.filter(id => id !== file._id) : [...prev, file._id]
    );
  };

  const clearSelection = () => setSelectedFiles([]);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string, name: string, className: string = "w-10 h-10") => {
    const lower = name.toLowerCase();
    if (mimeType.startsWith('image/')) return <Image className={`${className} text-emerald-500`} />;
    if (mimeType.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.mkv')) return <Video className={`${className} text-rose-500`} />;
    if (mimeType.startsWith('audio/') || lower.endsWith('.mp3')) return <Music className={`${className} text-purple-500`} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || lower.endsWith('.zip')) return <Archive className={`${className} text-amber-600`} />;
    if (mimeType.includes('pdf') || lower.endsWith('.pdf')) return <FileText className={`${className} text-red-500`} />;
    if (lower.endsWith('.exe') || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.jsx') || lower.endsWith('.tsx') || lower.endsWith('.json') || lower.endsWith('.html') || lower.endsWith('.css') || lower.endsWith('.txt')) return <FileCode className={`${className} text-blue-500`} />;
    return <File className={`${className} text-slate-500`} />;
  };

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      setError('');
      const folderParam = currentFolder ? currentFolder._id : 'root';
      const res = await axios.get(`${API_URL}/drive/files?folder=${folderParam}`, { withCredentials: true });
      setFiles(res.data);
    } catch (err: any) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load files.');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder, refreshFilesTrigger]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000 * 1024 * 1024) {
      setError('File size exceeds 2GB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder) {
      formData.append('folder', currentFolder._id);
    }

    try {
      setError('');
      toast.promise(
        axios.post(`${API_URL}/drive/upload`, formData, { withCredentials: true }),
        {
          loading: `Uploading ${file.name}...`,
          success: (res) => {
            setFiles(prev => [res.data, ...prev]);
            return `${file.name} uploaded successfully`;
          },
          error: (err) => err.response?.data?.message || 'Upload failed'
        }
      ).finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
    } catch (err: any) {
      console.error('Upload catch error:', err);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = (id: string, _name?: string) => {
    const token = localStorage.getItem('token');
    window.location.href = `${API_URL}/drive/download/${id}?token=${token}&download=true`;
  };

  const handleDeleteFile = async (id: string) => {
    if (!window.confirm('Are you sure you want to move this file to trash?')) return;
    try {
      await axios.put(`${API_URL}/drive/files/${id}/trash`, {}, { withCredentials: true });
      setFiles(files.filter(f => f._id !== id));
      if (activePreviewFile?._id === id) setActivePreviewFile(null);
      setSelectedFiles(prev => prev.filter(selectedId => selectedId !== id));
      toast.success('Moved to trash');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to trash file');
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedFiles.length) return;
    if (!window.confirm(`Are you sure you want to move ${selectedFiles.length} files to trash?`)) return;
    try {
      await Promise.all(selectedFiles.map(id =>
        axios.put(`${API_URL}/drive/files/${id}/trash`, {}, { withCredentials: true })
      ));
      setFiles(files.filter(f => !selectedFiles.includes(f._id)));
      if (activePreviewFile && selectedFiles.includes(activePreviewFile._id)) setActivePreviewFile(null);
      toast.success(`${selectedFiles.length} files moved to trash`);
      clearSelection();
    } catch (err) {
      console.error('Batch delete failed:', err);
      toast.error('Failed to trash some files');
    }
  };

  const handleToggleStar = async (file: DriveFile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await axios.put(`${API_URL}/drive/files/${file._id}/star`, {}, { withCredentials: true });
      setFiles(files.map(f => f._id === file._id ? { ...f, isStarred: res.data.isStarred } : f));
    } catch (err) {
      console.error('Star failed', err);
    }
  };

  const handleShare = async (file: DriveFile) => {
    try {
      const res = await axios.put(`${API_URL}/drive/files/${file._id}/share`, {}, { withCredentials: true });
      const shareLink = `${window.location.origin}/share/${res.data.shareToken}`;

      toast((t) => (
        <div className="flex flex-col gap-2 p-1 w-full max-w-sm">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Share2 className="w-4 h-4 text-brand-500" />
            Link Generated!
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 break-all bg-slate-100 dark:bg-dark-900 p-2 rounded-lg border border-slate-200 dark:border-dark-800">
            {shareLink}
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-md transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                toast.success('Copied to clipboard!', { id: t.id });
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white rounded-md transition-colors shadow-sm"
            >
              Copy Link
            </button>
          </div>
        </div>
      ), { duration: 10000, position: 'bottom-center' });

      setFiles(files.map(f => f._id === file._id ? { ...f, isPublic: true, shareToken: res.data.shareToken } : f));
    } catch (err) {
      console.error('Share failed:', err);
      toast.error('Failed to generate share link');
    }
  };

  const handleFileClick = async (file: DriveFile) => {
    if (file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
      setActivePreviewFile(file);
    } else {
      handleDownload(file._id);
    }
  };

  const handleSort = (field: 'name' | 'size' | 'createdAt') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || getFileCategory(f.mimeType, f.name) === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === 'size') {
      comparison = a.size - b.size;
    } else {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Category counts
  const categoryCounts = CATEGORY_TABS.reduce((acc, tab) => {
    if (tab.id === 'all') {
      acc[tab.id] = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length;
    } else {
      acc[tab.id] = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        getFileCategory(f.mimeType, f.name) === tab.id
      ).length;
    }
    return acc;
  }, {} as Record<CategoryType, number>);

  const handleContextMenu = (file: any, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const activeCategoryData = CATEGORY_TABS.find(c => c.id === activeCategory)!;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-750 dark:text-red-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Visual Statistics Cards (Root View Only) */}
      {!currentFolder && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-350">
          {/* Card 1: Storage */}
          <div className="p-4 bg-white/60 dark:bg-dark-900/30 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col justify-between group hover:border-brand-500/30 dark:hover:border-brand-500/30 transition-all hover:shadow-md duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Storage</p>
                <h4 className="text-xl font-extrabold text-slate-850 dark:text-white mt-1.5 leading-none">
                  {formatBytes(stats.totalSize || 0)}
                </h4>
              </div>
              <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/10 text-brand-500 rounded-xl">
                <HardDrive className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-slate-100 dark:bg-dark-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-400 to-brand-600 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, storagePercentage)}%` }}
                />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 mt-1.5">Unlimited Storage</p>
            </div>
          </div>

          {/* Card 2: Images */}
          <div
            className="p-4 bg-white/60 dark:bg-dark-900/30 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex justify-between items-start group hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-all hover:shadow-md duration-300 cursor-pointer"
            onClick={() => setActiveCategory('image')}
          >
            <div>
              <p className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Images</p>
              <h4 className="text-xl font-extrabold text-slate-850 dark:text-white mt-1.5 leading-none">
                {stats.breakdown?.image?.count ?? categoryCounts.image}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">{stats.breakdown?.image?.size ? formatBytes(stats.breakdown.image.size) : '—'}</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Image className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 3: Videos */}
          <div
            className="p-4 bg-white/60 dark:bg-dark-900/30 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex justify-between items-start group hover:border-rose-500/30 dark:hover:border-rose-500/30 transition-all hover:shadow-md duration-300 cursor-pointer"
            onClick={() => setActiveCategory('video')}
          >
            <div>
              <p className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Videos</p>
              <h4 className="text-xl font-extrabold text-slate-850 dark:text-white mt-1.5 leading-none">
                {stats.breakdown?.video?.count ?? categoryCounts.video}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">{stats.breakdown?.video?.size ? formatBytes(stats.breakdown.video.size) : '—'}</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
              <Video className="w-4.5 h-4.5" />
            </div>
          </div>

          {/* Card 4: Documents */}
          <div
            className="p-4 bg-white/60 dark:bg-dark-900/30 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex justify-between items-start group hover:border-amber-500/30 dark:hover:border-amber-500/30 transition-all hover:shadow-md duration-300 cursor-pointer"
            onClick={() => setActiveCategory('document')}
          >
            <div>
              <p className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">Documents</p>
              <h4 className="text-xl font-extrabold text-slate-850 dark:text-white mt-1.5 leading-none">
                {stats.breakdown?.document?.count ?? categoryCounts.document}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">{stats.breakdown?.document?.size ? formatBytes(stats.breakdown.document.size) : '—'}</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <FileText className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar-x">
        {CATEGORY_TABS.map((tab) => {
          const count = categoryCounts[tab.id];
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? `${tab.bg} ${tab.color} ${tab.border} shadow-sm`
                  : 'text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-dark-900/20 border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <span className={isActive ? tab.color : 'text-slate-400'}>{tab.icon}</span>
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? `${tab.color} bg-white/40 dark:bg-black/20` : 'bg-slate-100 dark:bg-dark-800 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 ${activeCategoryData.color}`}>
            {activeCategoryData.icon}
            <span>{sortedFiles.length} {activeCategory === 'all' ? 'files' : activeCategoryData.label.toLowerCase()}</span>
          </div>
          {selectedFiles.length > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-brand-500">{selectedFiles.length} selected</span>
              <button onClick={clearSelection} className="text-slate-400 hover:text-slate-600 hover:underline transition-all">Clear</button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 hidden sm:block">Sort:</span>
          {(['name', 'size', 'createdAt'] as const).map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`flex items-center gap-0.5 hover:text-brand-500 transition-colors ${sortField === field ? 'text-brand-500' : ''}`}
            >
              {field === 'createdAt' ? 'Date' : field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
          ))}
        </div>
      </div>

      {/* File Grid / List */}
      {!loadingFiles && sortedFiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 px-4 text-center"
        >
          <div className={`w-20 h-20 mb-6 rounded-2xl ${activeCategoryData.bg} flex items-center justify-center`}>
            <span className={`${activeCategoryData.color} scale-150`}>{activeCategoryData.icon}</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            {activeCategory === 'all' ? 'No files here yet' : `No ${activeCategoryData.label} found`}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
            {activeCategory === 'all'
              ? 'Upload your first file to get started with Telegram Drive.'
              : `Upload ${activeCategoryData.label.toLowerCase()} files and they will appear here automatically.`}
          </p>
          {activeCategory === 'all' && (
            <label className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl transition-colors cursor-pointer shadow-lg shadow-brand-500/20 text-sm">
              <input type="file" className="hidden" onChange={handleFileUpload} />
              <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Upload File</span>
            </label>
          )}
        </motion.div>
      ) : viewMode === 'grid' ? (
        <motion.div layout className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {/* Upload button card */}
          {activeCategory === 'all' && (
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-dark-900/10 rounded-2xl p-4 flex flex-col items-center justify-center aspect-[4/3.2] transition-all hover:border-brand-500 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-800 flex items-center justify-center mb-2 group-hover:bg-brand-500/10 transition-colors">
                <Plus className="w-5 h-5 text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-brand-500">Upload File</span>
              <input type="file" className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
            </label>
          )}

          {loadingFiles ? (
            [1, 2, 3, 4].map(n => <div key={n} className="aspect-[4/3.2] rounded-2xl bg-slate-200 dark:bg-dark-900/40 animate-pulse"></div>)
          ) : sortedFiles.map((file, index) => (
            <motion.div
              key={file._id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <FileCard
                file={file as any}
                onClick={(f) => handleFileClick(f as any)}
                onContextMenu={(f, e) => handleContextMenu(f as any, e)}
                onToggleStar={(f, e) => handleToggleStar(f as any, e)}
                getFileIcon={getFileIcon}
                isSelected={selectedFiles.includes(file._id)}
                onToggleSelect={(f, e) => handleToggleSelect(f as any, e)}
                onDownload={(id, _fileName, e) => {
                  e?.stopPropagation();
                  handleDownload(id);
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="bg-white dark:bg-dark-850/30 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
          {/* Upload row for list view */}
          {activeCategory === 'all' && (
            <label className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800/60 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 cursor-pointer group transition-colors">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-dark-800 flex items-center justify-center group-hover:bg-brand-500/10 transition-colors">
                <Plus className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <span className="text-xs font-semibold text-slate-400 group-hover:text-brand-500 transition-colors">Upload a file...</span>
              <input type="file" className="hidden" onChange={handleFileUpload} ref={fileInputRef} />
            </label>
          )}
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold bg-slate-50 dark:bg-dark-900/20">
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5 hidden sm:table-cell">Uploaded</th>
                <th className="px-5 py-3.5 hidden sm:table-cell">Size</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loadingFiles ? (
                <tr><td colSpan={4} className="px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <div className="w-4 h-4 border-2 border-brand-500/40 border-t-brand-500 rounded-full animate-spin" />
                    Loading...
                  </div>
                </td></tr>
              ) : sortedFiles.map((file) => (
                <tr
                  key={file._id}
                  className={`hover:bg-slate-50 dark:hover:bg-dark-800/20 cursor-pointer transition-colors ${selectedFiles.includes(file._id) ? 'bg-brand-50/50 dark:bg-brand-500/10' : ''}`}
                  onContextMenu={(e) => handleContextMenu(file, e)}
                  onClick={() => {
                    if (selectedFiles.length > 0) {
                      handleToggleSelect(file as any, {} as any);
                    } else {
                      handleFileClick(file);
                    }
                  }}
                >
                  <td className="px-5 py-3.5 flex items-center gap-3 font-semibold text-slate-900 dark:text-white">
                    <div onClick={(e) => { e.stopPropagation(); handleToggleSelect(file as any, e); }} className="cursor-pointer">
                      <div className={`w-4 h-4 border rounded-md flex items-center justify-center transition-colors ${selectedFiles.includes(file._id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {selectedFiles.includes(file._id) && <svg viewBox="0 0 14 14" fill="none" className="w-2.5 h-2.5"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </div>
                    <button onClick={(e) => handleToggleStar(file, e)} className="p-1">
                      <Star className={`w-4 h-4 ${file.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} />
                    </button>
                    {getFileIcon(file.mimeType, file.name, "w-4.5 h-4.5")}
                    <span className="truncate max-w-xs">{file.name}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">{new Date(file.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">{formatBytes(file.size)}</td>
                  <td className="px-5 py-3.5 text-right space-x-3">
                    <button onClick={(e) => { e.stopPropagation(); handleDownload(file._id, file.name); }} className="text-brand-500 hover:text-brand-600 font-medium hover:underline">Download</button>
                    <span className="text-slate-200 dark:text-slate-700">|</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(file._id); }} className="text-red-400 hover:text-red-500 font-medium hover:underline">Trash</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activePreviewFile && (
        <Lightbox
          files={sortedFiles}
          initialFileId={activePreviewFile._id}
          onClose={() => setActivePreviewFile(null)}
          onDownload={handleDownload}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          actions={[
            {
              label: 'Download',
              icon: <Download className="w-4 h-4" />,
              onClick: () => handleDownload(contextMenu.file._id, contextMenu.file.name)
            },
            {
              label: contextMenu.file.isStarred ? 'Unstar' : 'Star',
              icon: <Star className={`w-4 h-4 ${contextMenu.file.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />,
              onClick: () => handleToggleStar(contextMenu.file)
            },
            {
              label: 'Share',
              icon: <Share2 className="w-4 h-4" />,
              onClick: () => handleShare(contextMenu.file)
            },
            {
              label: 'Move to Trash',
              icon: <Trash2 className="w-4 h-4" />,
              danger: true,
              onClick: () => handleDeleteFile(contextMenu.file._id)
            }
          ]}
        />
      )}

      {/* Floating Selection Toolbar */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-5"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-brand-500 rounded-full text-xs font-bold">{selectedFiles.length}</span>
              <span className="text-sm font-medium">selected</span>
            </div>
            <div className="h-5 w-px bg-slate-700"></div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleBatchDelete} className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors" title="Delete Selected">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={clearSelection} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Clear Selection">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyFiles;