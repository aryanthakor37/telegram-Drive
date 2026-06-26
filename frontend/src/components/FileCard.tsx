import React from 'react';
import { Star, RefreshCw, Trash2 } from 'lucide-react';
import { TelegramImagePreview } from './TelegramImagePreview';

// Helper for formatting file size
export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export interface FileData {
  _id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  isStarred?: boolean;
  folder?: string | null;
  telegramMessageId?: number;
}

interface FileCardProps {
  file: FileData;
  onClick?: (file: FileData) => void;
  onContextMenu?: (file: FileData, e: React.MouseEvent) => void;
  onToggleStar?: (file: FileData, e: React.MouseEvent) => void;
  onRestore?: (fileId: string, e: React.MouseEvent) => void;
  onPermanentDelete?: (fileId: string, e: React.MouseEvent) => void;
  getFileIcon: (mimeType: string, filename: string, className?: string) => React.ReactNode;
  isTrashMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (file: FileData, e: React.MouseEvent) => void;
  onDownload?: (fileId: string, fileName: string, e: React.MouseEvent) => void;
}

const FileCard: React.FC<FileCardProps> = ({
  file,
  onClick,
  onContextMenu,
  onToggleStar,
  onRestore,
  onPermanentDelete,
  getFileIcon,
  isTrashMode = false,
  isSelected = false,
  onToggleSelect,
  onDownload
}) => {
  
  const handleClick = () => {
    // If shift/ctrl click, we might want to select instead, but let parent handle that.
    if (onClick) onClick(file);
  };

  if (isTrashMode) {
    return (
      <div className="bg-white dark:bg-dark-850/60 border rounded-2xl overflow-hidden flex flex-col group relative transition-all shadow-sm border-slate-200 dark:border-slate-800/80 hover:border-red-500/50">
        <div className="aspect-[4/3] w-full relative overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-800/50 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-dark-800 dark:to-dark-900 grayscale">
          {getFileIcon(file.mimeType, file.name)}
          <div className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 duration-300">
            <button onClick={(e) => onRestore && onRestore(file._id, e)} className="p-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-md" title="Restore">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={(e) => onPermanentDelete && onPermanentDelete(file._id, e)} className="p-2.5 bg-red-650 hover:bg-red-500 text-white rounded-xl shadow-md" title="Delete Permanently">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-3">
          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{file.name}</p>
          <div className="flex justify-between items-center mt-1 text-[9px] text-slate-400 font-semibold uppercase">
            <span>{formatBytes(file.size)}</span>
            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', file._id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={handleClick}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(file, e);
        }
      }}
      className={`bg-white dark:bg-dark-850/60 border rounded-2xl overflow-hidden flex flex-col group relative transition-all shadow-sm cursor-pointer hover:shadow-md ${
        isSelected 
          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/10' 
          : 'border-slate-200 dark:border-slate-800/80 hover:border-brand-500/50'
      }`}
    >
      {/* Selection Checkbox */}
      {onToggleSelect && (
        <div 
          onClick={(e) => { e.stopPropagation(); onToggleSelect(file, e); }}
          className={`absolute top-2 left-2 z-30 p-1.5 rounded-lg transition-all ${
            isSelected 
              ? 'opacity-100 bg-brand-500 text-white shadow-sm' 
              : 'opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-dark-900/80 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-slate-400'
          }`}
        >
          <div className={`w-3.5 h-3.5 border flex items-center justify-center rounded-[4px] transition-colors ${
            isSelected ? 'border-transparent' : 'border-slate-400 dark:border-slate-500'
          }`}>
            {isSelected && <svg viewBox="0 0 14 14" fill="none" className="w-2.5 h-2.5 text-white"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </div>
      )}

      <div className="absolute top-2 right-2 z-20 flex gap-1">
        {onDownload && (
          <button onClick={(e) => onDownload(file._id, file.name, e)} className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-brand-500" title="Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </button>
        )}
        {onToggleStar && (
          <button onClick={(e) => onToggleStar(file, e)} className="p-1" title="Star">
            <Star className={`w-4 h-4 ${file.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-yellow-400'}`} />
          </button>
        )}
      </div>
      <div className="aspect-[4/3] w-full relative overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-slate-800/50 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-dark-800 dark:to-dark-950">
        {file.mimeType.startsWith('image/') ? (
          <TelegramImagePreview fileId={file._id} filename={file.name} />
        ) : (
          getFileIcon(file.mimeType, file.name)
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{file.name}</p>
        <div className="flex justify-between items-center mt-1 text-[9px] text-slate-400 font-semibold uppercase">
          <span>{formatBytes(file.size)}</span>
          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default FileCard;
