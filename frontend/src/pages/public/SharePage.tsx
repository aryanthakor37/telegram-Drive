import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Download, File, Loader, AlertCircle } from 'lucide-react';
import { API_URL } from '../../config/api';

const SharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const res = await axios.get(`${API_URL}/public/files/${token}`);
        setFile(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'File not found or link has expired.');
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [token]);

  const handleDownload = () => {
    window.location.href = `${API_URL}/public/download/${token}`;
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex items-center justify-center">
        <Loader className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-dark-900 rounded-3xl p-8 text-center shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Unavailable</h2>
          <p className="text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 dark:border-dark-800 bg-white/80 dark:bg-dark-950/80 backdrop-blur-xl flex items-center px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
            <span className="font-bold text-lg leading-none">T</span>
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Telegram Drive</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-dark-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-dark-800">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-brand-50 dark:bg-brand-500/10 rounded-3xl flex items-center justify-center text-brand-500 mb-6">
              <File className="w-12 h-12" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 break-all">{file.name}</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 uppercase tracking-widest">
              {formatBytes(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
            </p>

            <button
              onClick={handleDownload}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-brand-500/25"
            >
              <Download className="w-5 h-5" />
              Download File
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SharePage;
