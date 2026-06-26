import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  HardDrive, Settings, LogOut, Search, Menu, X, File,
  Upload, Download, Trash, Image, AlertCircle, FileText, FileCode, Archive, CheckCircle2
} from 'lucide-react';
import { API_URL } from '../config/api';

interface DriveFile {
  _id: string;
  name: string;
  size: number;
  mimeType: string;
  telegramMessageId: number;
  createdAt: string;
}

// Inline component to load private Telegram image previews as local blob URLs
const TelegramImagePreview: React.FC<{ fileId: string; filename: string }> = ({ fileId, filename }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let url: string | null = null;

    const fetchPreview = async () => {
      try {
        const res = await axios.get(`${API_URL}/drive/download/${fileId}`, { responseType: 'blob' });
        if (isMounted) {
          url = URL.createObjectURL(res.data);
          setSrc(url);
        }
      } catch (err) {
        console.error('Failed to load image preview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [fileId]);

  if (loading) {
    return (
      <div className="w-full h-full bg-slate-900/60 animate-pulse flex items-center justify-center text-xs text-dark-500">
        Loading...
      </div>
    );
  }

  if (!src) {
    return (
      <div className="w-full h-full bg-slate-900/40 flex flex-col items-center justify-center text-dark-500 text-xs p-2 text-center">
        <Image className="w-6 h-6 mb-1 text-dark-600" />
        <span>No Preview</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={filename}
      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
      loading="lazy"
    />
  );
};

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('drive'); // drive, settings
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Fetch files list on mount
  const fetchFiles = async () => {
    setLoadingFiles(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/drive/files`);
      setFiles(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve files list.');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle Drag & Drop / Manual Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/drive/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchFiles();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload file to Telegram.');
    } finally {
      setUploading(false);
    }
  };

  // Handle File Download
  const handleDownload = async (fileId: string, filename: string) => {
    setDownloadingId(fileId);
    try {
      const res = await axios.get(`${API_URL}/drive/download/${fileId}`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));

      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('Failed to download file: ' + (err.message || 'Error occurred'));
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle File Deletion
  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file? It will be removed from your Telegram chat as well.')) return;

    setDeletingId(fileId);
    try {
      await axios.delete(`${API_URL}/drive/${fileId}`);
      await fetchFiles();
    } catch (err: any) {
      alert('Failed to delete file: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to format file size
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Helper to pick file icon
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-emerald-400" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-400" />;
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html')) {
      return <FileCode className="w-5 h-5 text-yellow-400" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) {
      return <Archive className="w-5 h-5 text-blue-400" />;
    }
    return <File className="w-5 h-5 text-dark-400" />;
  };

  // Filter files by search
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Separate images and other documents for beautiful gallery view
  const imageFiles = filteredFiles.filter(f => f.mimeType.startsWith('image/'));
  const documentFiles = filteredFiles.filter(f => !f.mimeType.startsWith('image/'));

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-900/60 border-r border-slate-800/80 backdrop-blur-xl transform lg:translate-x-0 lg:static transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col justify-between p-4">
          <div className="space-y-6">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-2 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white glow-brand shadow-md">
                  <HardDrive className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h1 className="font-bold text-white leading-none">TG Drive</h1>
                  <span className="text-xs text-brand-400 font-medium">Telegram Storage</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden text-dark-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Upload Action */}
            <div className="px-2">
              <label className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-medium rounded-xl flex items-center justify-center gap-2 border border-brand-400/20 shadow-lg shadow-brand-500/10 transition-all cursor-pointer active:scale-98 text-center text-sm">
                <Upload className="w-4 h-4 inline-block" />
                <span>Upload File</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1 px-2">
              <button
                onClick={() => setActiveTab('drive')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeTab === 'drive' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-dark-400 hover:bg-slate-800/40 hover:text-dark-200'}`}
              >
                <HardDrive className="w-4.5 h-4.5" />
                <span>My Drive</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${activeTab === 'settings' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-dark-400 hover:bg-slate-800/40 hover:text-dark-200'}`}
              >
                <Settings className="w-4.5 h-4.5" />
                <span>Connection Status</span>
              </button>
            </nav>
          </div>

          {/* User Profile info and Logout */}
          <div className="bg-dark-950/80 border border-slate-800/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 font-bold">
                {user?.username?.substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                <p className="text-[10px] text-dark-400 truncate">{user?.telegramPhone}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full py-2 px-3 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-red-400 hover:text-red-300 font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Telegram</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-40 bg-dark-950/60 backdrop-blur-md border-b border-slate-900 px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-dark-300 hover:text-white p-1"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-white text-lg">TG Drive</span>
          </div>

          {/* Search bar */}
          <div className="hidden sm:flex items-center max-w-md w-full relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-dark-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search shared images, files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-900/40 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-all text-sm"
            />
          </div>

          {/* Storage status & Connection indicator */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Connected: {user?.telegramPhone}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 space-y-8">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-center gap-3 max-w-4xl mx-auto">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload progress overlay loader */}
          {uploading && (
            <div className="p-5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm flex items-center gap-4 max-w-4xl mx-auto animate-pulse">
              <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin"></div>
              <span>Uploading file directly to your Telegram chat... Please hold on.</span>
            </div>
          )}

          {activeTab === 'drive' && (
            <div className="max-w-6xl mx-auto space-y-10">
              {/* Image Gallery Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Image className="w-5 h-5 text-emerald-400" />
                  <span>Images</span>
                </h3>

                {loadingFiles ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="aspect-[4/3] rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse"></div>
                    ))}
                  </div>
                ) : imageFiles.length === 0 ? (
                  <div className="p-10 text-center glass-card rounded-2xl border border-slate-900 text-dark-500 text-sm">
                    No images uploaded yet. Upload or drag and drop images to see them here!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {imageFiles.map((file) => (
                      <div
                        key={file._id}
                        className="glass-card border border-slate-850 hover:border-brand-500/30 rounded-2xl overflow-hidden flex flex-col group relative"
                      >
                        {/* Image Preview Box */}
                        <div className="aspect-[4/3] w-full bg-slate-900 relative overflow-hidden border-b border-slate-850">
                          <TelegramImagePreview fileId={file._id} filename={file.name} />

                          {/* Quick Action Overlay on hover */}
                          <div className="absolute inset-0 bg-dark-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button
                              onClick={() => handleDownload(file._id, file.name)}
                              disabled={downloadingId === file._id}
                              className="p-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(file._id)}
                              disabled={deletingId === file._id}
                              className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Image Metadata */}
                        <div className="p-3">
                          <p className="text-xs font-semibold text-white truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex justify-between items-center mt-1 text-[10px] text-dark-400 font-medium">
                            <span>{formatBytes(file.size)}</span>
                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Documents Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <File className="w-5 h-5 text-brand-400" />
                  <span>Other Files</span>
                </h3>

                {loadingFiles ? (
                  <div className="space-y-3">
                    <div className="h-12 w-full bg-slate-900/60 rounded-xl animate-pulse"></div>
                    <div className="h-12 w-full bg-slate-900/60 rounded-xl animate-pulse"></div>
                  </div>
                ) : documentFiles.length === 0 ? (
                  <div className="p-6 text-center glass-card rounded-2xl border border-slate-900 text-dark-500 text-sm">
                    No documents uploaded.
                  </div>
                ) : (
                  <div className="glass rounded-2xl border border-slate-800/80 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-dark-400 font-medium bg-slate-900/20">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Uploaded</th>
                            <th className="px-6 py-4">Size</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {documentFiles.map((file) => (
                            <tr key={file._id} className="hover:bg-slate-850/10 transition-colors group">
                              <td className="px-6 py-4 flex items-center gap-3 font-medium text-white">
                                {getFileIcon(file.mimeType)}
                                <span className="truncate max-w-xs md:max-w-md">{file.name}</span>
                              </td>
                              <td className="px-6 py-4 text-dark-400">{new Date(file.createdAt).toLocaleDateString()}</td>
                              <td className="px-6 py-4 text-dark-400">{formatBytes(file.size)}</td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button
                                  onClick={() => handleDownload(file._id, file.name)}
                                  disabled={downloadingId === file._id}
                                  className="text-xs text-brand-400 hover:text-brand-300 hover:underline disabled:opacity-50"
                                >
                                  Download
                                </button>
                                <span className="text-dark-600">|</span>
                                <button
                                  onClick={() => handleDelete(file._id)}
                                  disabled={deletingId === file._id}
                                  className="text-xs text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto glass rounded-3xl p-8 border border-slate-800/80 shadow-xl space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-400" />
                <span>Integration Connection</span>
              </h3>

              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Linked Telegram Session</span>
                </div>
                <div className="space-y-1.5 text-xs text-dark-400 leading-relaxed">
                  <p><strong>Connected Phone:</strong> {user?.telegramPhone}</p>
                  <p><strong>Telegram Username:</strong> @{user?.username}</p>
                </div>
                <p className="text-[10px] text-dark-500">
                  Files uploaded to this drive dashboard are securely dispatched to your Telegram "Saved Messages" channel. Deleting files here deletes them from Telegram.
                </p>
                <button
                  onClick={logout}
                  className="px-4 py-2 mt-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Disconnect Telegram Account
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;
