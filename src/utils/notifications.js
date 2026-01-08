import toast from 'react-hot-toast';

// Notification utility for consistent UI feedback across the app
export const notify = {
    success: (message) => {
        toast.success(message, {
            duration: 3000,
            style: {
                background: '#1e1e1e',
                color: '#4ade80',
                border: '1px solid #22c55e',
                fontSize: '13px',
                fontFamily: 'monospace'
            },
            iconTheme: {
                primary: '#22c55e',
                secondary: '#1e1e1e',
            },
        });
    },
    
    error: (message) => {
        toast.error(message, {
            duration: 4000,
            style: {
                background: '#1e1e1e',
                color: '#f87171',
                border: '1px solid #ef4444',
                fontSize: '13px',
                fontFamily: 'monospace'
            },
            iconTheme: {
                primary: '#ef4444',
                secondary: '#1e1e1e',
            },
        });
    },
    
    warning: (message) => {
        toast(message, {
            duration: 3000,
            icon: '⚠️',
            style: {
                background: '#1e1e1e',
                color: '#fbbf24',
                border: '1px solid #f59e0b',
                fontSize: '13px',
                fontFamily: 'monospace'
            },
        });
    },
    
    info: (message) => {
        toast(message, {
            duration: 3000,
            icon: 'ℹ️',
            style: {
                background: '#1e1e1e',
                color: '#60a5fa',
                border: '1px solid #3b82f6',
                fontSize: '13px',
                fontFamily: 'monospace'
            },
        });
    }
};
