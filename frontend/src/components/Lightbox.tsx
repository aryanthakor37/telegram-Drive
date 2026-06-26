import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Loader, Info, Music } from 'lucide-react';
import { formatBytes } from './FileCard';
import { API_URL } from '../config/api';

interface DriveFile {
  _id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface LightboxProps {
  files: DriveFile[];
  initialFileId: string;
  onClose: () => void;
  onDownload: (id: string, name: string) => void;
}

const Lightbox: React.FC<LightboxProps> = ({ files, initialFileId, onClose, onDownload }) => {
  const mediaFiles = files.filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/') || f.mimeType.startsWith('audio/'));
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, mediaFiles.findIndex(f => f._id === initialFileId)));
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeFile = mediaFiles[currentIndex];
  const token = localStorage.getItem('token');
  const previewUrl = activeFile ? `${API_URL}/drive/download/${activeFile._id}?token=${token}` : '';

  const handlePrevious = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : mediaFiles.length - 1));
    setLoading(true);
  }, [mediaFiles.length]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex(prev => (prev < mediaFiles.length - 1 ? prev + 1 : 0));
    setLoading(true);
  }, [mediaFiles.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, onClose]);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!activeFile) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 h-16 bg-linear-to-b from-black/80 to-transparent flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate select-none drop-shadow-md">
            {currentIndex + 1} / {mediaFiles.length} <span className="opacity-50 mx-2">•</span> {activeFile.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onDownload(activeFile._id, activeFile.name)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Download">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={() => setShowInfo(!showInfo)} className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`} title="Info">
            <Info className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-red-500/80 rounded-full transition-colors ml-2" title="Close">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Navigation Controls */}
      {mediaFiles.length > 1 && (
        <>
          <button onClick={handlePrevious} className="absolute left-4 p-3 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all z-10 backdrop-blur-md">
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button onClick={handleNext} className="absolute right-4 p-3 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all z-10 backdrop-blur-md">
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Main Content Area */}
      <div className="w-full h-full flex items-center justify-center p-16 select-none" onClick={onClose}>
        <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {loading && <Loader className="absolute w-12 h-12 text-white/50 animate-spin z-[-1]" />}

          {activeFile.mimeType.startsWith('image/') && (
            <img
              src={previewUrl}
              alt={activeFile.name}
              className="max-w-full max-h-[85vh] object-contain rounded-sm shadow-2xl transition-opacity duration-300"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          )}

          {activeFile.mimeType.startsWith('video/') && (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-w-full max-h-[85vh] rounded-sm shadow-2xl bg-black"
              onLoadedData={() => setLoading(false)}
            />
          )}

          {activeFile.mimeType.startsWith('audio/') && (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center min-w-75">
              <div className="w-24 h-24 bg-brand-500/20 rounded-full flex items-center justify-center mb-8">
                <Music className="w-10 h-10 text-brand-500" />
              </div>
              <audio
                src={previewUrl}
                controls
                autoPlay
                className="w-full"
                onLoadedData={() => setLoading(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Info Sidebar */}
      {showInfo && (
        <div className="absolute top-16 right-4 w-72 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl z-20 text-white animate-in slide-in-from-right-4 fade-in">
          <h3 className="text-sm font-bold mb-4 border-b border-white/10 pb-2">File Info</h3>
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-white/50 block mb-1">Name</span>
              <span className="break-all">{activeFile.name}</span>
            </div>
            <div>
              <span className="text-white/50 block mb-1">Type</span>
              <span>{activeFile.mimeType}</span>
            </div>
            <div>
              <span className="text-white/50 block mb-1">Size</span>
              <span>{formatBytes(activeFile.size)}</span>
            </div>
            <div>
              <span className="text-white/50 block mb-1">Uploaded</span>
              <span>{new Date(activeFile.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lightbox;
