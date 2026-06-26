import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDrive } from '../../context/DriveContext';
import {
  File, Image, Video, Music, Archive, FileText, Download, Trash2, Share2,
  Star, AlertCircle, FileCode
} from 'lucide-react';
import FileCard from '../../components/FileCard';
import { motion } from 'framer-motion';
import ContextMenu from '../../components/ContextMenu';
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

const StarredFiles: React.FC = () => {
  const { viewMode, searchQuery } = useDrive();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [error, setError] = useState('');

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: DriveFile } | null>(null);

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
    if (lower.match(/\.(exe|js|ts|jsx|tsx|json|html|css|txt|py|cpp|c|h|java)$/)) return <FileCode className={`${className} text-blue-500`} />;
    return <File className={`${className} text-slate-500`} />;
  };

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      setError('');
      const res = await axios.get(`${API_URL}/drive/files/starred`, { withCredentials: true });
      setFiles(res.data);
    } catch (err: any) {
      console.error('Failed to fetch starred files:', err);
      setError('Failed to load starred files.');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);



  const handleDeleteFile = async (id: string) => {
    if (!window.confirm('Are you sure you want to move this file to trash?')) return;
    try {
      await axios.put(`${API_URL}/drive/files/${id}/trash`, {}, { withCredentials: true });
      setFiles(files.filter(f => f._id !== id));
      toast.success('Moved to trash');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to trash file');
    }
  };

  const handleToggleStar = async (file: DriveFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await axios.put(`${API_URL}/drive/files/${file._id}/star`, {}, { withCredentials: true });
      setFiles(files.filter(f => f._id !== file._id)); // Removing from list if un-starred
    } catch (err) {
      console.error('Star failed', err);
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleContextMenu = (file: any, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
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

    } catch (err) {
      console.error('Share failed:', err);
      toast.error('Failed to generate share link');
    }
  };

  const handleDownload = (id: string, _name?: string) => {
    const token = localStorage.getItem('token');
    window.location.href = `${API_URL}/drive/download/${id}?token=${token}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}s

      {!loadingFiles && filteredFiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 px-4 text-center"
        >
          <div className="w-24 h-24 mb-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Star className="w-12 h-12 text-yellow-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No starred files</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Star important files to keep them easily accessible here.
          </p>
        </motion.div>
      ) : viewMode === 'grid' ? (
        <motion.div layout className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {loadingFiles ? (
            [1, 2, 3, 4].map(n => <div key={n} className="aspect-[4/3.2] rounded-2xl bg-slate-200 dark:bg-dark-900/40 animate-pulse"></div>)
          ) : filteredFiles.map((file, index) => (
            <motion.div
              key={file._id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <FileCard
                key={file._id}
                file={file as any}
                onContextMenu={(f, e) => handleContextMenu(f as any, e)}
                onToggleStar={(f, e) => handleToggleStar(f as any, e)}
                getFileIcon={getFileIcon}
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
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold bg-slate-50 dark:bg-dark-900/20">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Uploaded</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loadingFiles ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : filteredFiles.map((file) => (
                <tr
                  key={file._id}
                  className="hover:bg-slate-50 dark:hover:bg-dark-800/20"
                  onContextMenu={(e) => handleContextMenu(file, e)}
                >
                  <td className="px-6 py-4 flex items-center gap-3 font-semibold text-slate-900 dark:text-white cursor-pointer">
                    <button onClick={(e) => handleToggleStar(file, e)} className="p-1 -ml-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    </button>
                    {getFileIcon(file.mimeType, file.name, "w-5 h-5")}
                    <span className="truncate max-w-xs">{file.name}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{new Date(file.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-slate-500">{formatBytes(file.size)}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => handleDownload(file._id)} className="text-brand-500 hover:underline">Download</button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button onClick={() => handleDeleteFile(file._id)} className="text-red-500 hover:underline">Trash</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              onClick: () => handleDownload(contextMenu.file._id)
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
    </div>
  );
};

export default StarredFiles;