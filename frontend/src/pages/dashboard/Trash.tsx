import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileCard from '../../components/FileCard';
import ContextMenu from '../../components/ContextMenu';
import { useDrive } from '../../context/DriveContext';
import toast from 'react-hot-toast';
import {
  File, Image, Video, Music, Archive, FileText,
  Trash2, RefreshCw, AlertCircle
} from 'lucide-react';
import { API_URL } from '../../config/api';

interface DriveFile {
  _id: string;
  name: string;
  size: number;
  mimeType: string;
  telegramMessageId?: number;
  folder: string | null;
  createdAt: string;
}

const Trash: React.FC = () => {
  const { viewMode, searchQuery, fetchStats } = useDrive();
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
    if (mimeType.startsWith('image/')) return <Image className={`${className} text-blue-500`} />;
    if (mimeType.startsWith('video/') || lower.endsWith('.mp4') || lower.endsWith('.mkv')) return <Video className={`${className} text-rose-500`} />;
    if (mimeType.startsWith('audio/') || lower.endsWith('.mp3')) return <Music className={`${className} text-purple-500`} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || lower.endsWith('.zip')) return <Archive className={`${className} text-amber-500`} />;
    if (mimeType.includes('pdf') || lower.endsWith('.pdf')) return <FileText className={`${className} text-red-500`} />;
    return <File className={`${className} text-slate-500`} />;
  };

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      setError('');
      const res = await axios.get(`${API_URL}/drive/files/trash`, { withCredentials: true });
      setFiles(res.data);
    } catch (err: any) {
      console.error('Failed to fetch trash files:', err);
      setError('Failed to load trash files.');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.put(`${API_URL}/drive/files/${id}/trash`, {}, { withCredentials: true });
      setFiles(files.filter(f => f._id !== id));
      fetchStats();
      toast.success('File restored');
    } catch (err) {
      console.error('Restore failed:', err);
      toast.error('Failed to restore file');
    }
  };

  const handlePermanentDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this file? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/drive/${id}`, { withCredentials: true });
      setFiles(files.filter(f => f._id !== id));
      fetchStats();
      toast.success('File deleted permanently');
    } catch (err) {
      console.error('Delete forever failed:', err);
      toast.error('Failed to permanently delete file');
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleContextMenu = (file: any, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {loadingFiles ? (
            [1, 2, 3, 4].map(n => <div key={n} className="aspect-[4/3.2] rounded-2xl bg-slate-200 dark:bg-dark-900/40 animate-pulse"></div>)
          ) : filteredFiles.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">Trash is empty.</div>
          ) : filteredFiles.map(file => (
            <FileCard
              key={file._id}
              file={file as any}
              getFileIcon={getFileIcon}
              isTrashMode={true}
              onContextMenu={handleContextMenu}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-850/30 rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold bg-slate-50 dark:bg-dark-900/20">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Deleted On</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loadingFiles ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : filteredFiles.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">Trash is empty.</td></tr>
              ) : filteredFiles.map((file) => (
                <tr
                  key={file._id}
                  className="hover:bg-red-50 dark:hover:bg-red-900/10"
                  onContextMenu={(e) => handleContextMenu(file, e)}
                >
                  <td className="px-6 py-4 flex items-center gap-3 font-semibold text-slate-900 dark:text-white cursor-pointer grayscale opacity-70">
                    {getFileIcon(file.mimeType, file.name, "w-5 h-5")}
                    <span className="truncate max-w-xs">{file.name}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{new Date(file.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-slate-500">{formatBytes(file.size)}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={(e) => handleRestore(file._id, e)} className="text-brand-500 hover:underline">Restore</button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button onClick={(e) => handlePermanentDelete(file._id, e)} className="text-red-500 hover:underline font-bold">Delete Forever</button>
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
              label: 'Restore File',
              icon: <RefreshCw className="w-4 h-4" />,
              onClick: () => handleRestore(contextMenu.file._id, { stopPropagation: () => { } } as any)
            },
            {
              label: 'Delete Permanently',
              icon: <Trash2 className="w-4 h-4" />,
              danger: true,
              onClick: () => handlePermanentDelete(contextMenu.file._id, { stopPropagation: () => { } } as any)
            }
          ]}
        />
      )}
    </div>
  );
};

export default Trash;