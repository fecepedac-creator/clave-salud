import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none p-4 md:p-0">
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .toast-enter {
            animation: slideInRight 0.3s ease-out forwards;
          }
        `}</style>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              toast-enter pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border-l-[6px] transition-all transform hover:scale-102
              max-w-sm w-full bg-white
              ${toast.type === 'success' ? 'border-emerald-500 shadow-emerald-100' : ''}
              ${toast.type === 'error' ? 'border-red-500 shadow-red-100' : ''}
              ${toast.type === 'info' ? 'border-blue-500 shadow-blue-100' : ''}
              ${toast.type === 'warning' ? 'border-amber-500 shadow-amber-100' : ''}
            `}
          >
            <div className="flex-shrink-0">
                {toast.type === 'success' && <CheckCircle className="w-6 h-6 text-emerald-500" />}
                {toast.type === 'error' && <AlertCircle className="w-6 h-6 text-red-500" />}
                {toast.type === 'info' && <Info className="w-6 h-6 text-blue-500" />}
                {toast.type === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-500" />}
            </div>
            
            <p className="text-sm font-bold text-slate-700 flex-1">{toast.message}</p>
            
            <button onClick={() => removeToast(toast.id)} className="text-slate-300 hover:text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
