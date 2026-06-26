import React, { useEffect, useRef } from 'react';


export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose(); // Close on scroll for better UX
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true); // capture phase to catch all scrolls

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Prevent menu from going off-screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${y}px`,
    left: `${x}px`,
    zIndex: 9999,
  };

  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      menuStyle.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (y + rect.height > window.innerHeight) {
      menuStyle.top = `${window.innerHeight - rect.height - 10}px`;
    }
  }

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-white/80 dark:bg-dark-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-dark-800/80 rounded-xl shadow-2xl overflow-hidden min-w-50 py-1 animate-in fade-in zoom-in-95 duration-100"
    >
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${action.danger
              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-850 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <span className={action.danger ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}>
            {action.icon}
          </span>
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;
