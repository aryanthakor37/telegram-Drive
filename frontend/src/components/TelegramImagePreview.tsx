import React, { useState } from 'react';
import { Image } from 'lucide-react';
import { API_URL } from '../config/api';

export const TelegramImagePreview: React.FC<{ fileId: string; filename: string }> = ({ fileId, filename }) => {
  const [error, setError] = useState(false);
  const token = localStorage.getItem('token');
  const src = `${API_URL}/drive/download/${fileId}?thumbnail=true&token=${token}`;

  if (error) {
    return (
      <div className="w-full h-full bg-slate-100 dark:bg-dark-900/50 flex flex-col items-center justify-center text-slate-500 text-xs p-2 text-center">
        <Image className="w-6 h-6 mb-1 text-slate-400" />
        <span>No Preview</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={filename}
      className="w-full h-full object-cover hover:scale-105 transition-transform duration-350"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
};
