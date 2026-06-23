import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClick?: () => void;
    onClose: (id: string) => void;
}

const Toast = ({ id, message, type, duration = 3000, onClick, onClose }: ToastProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Exciting entrance
        requestAnimationFrame(() => setIsVisible(true));

        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => onClose(id), 300); // Wait for transition
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, id, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'info': default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    // 玻璃拟态外观所有类型一致，差异仅体现在左侧色条与图标颜色。
    const surfaceStyles = 'border-white/15 dark:border-white/10 bg-white/80 dark:bg-base-100/80';

    const getAccentColor = () => {
        switch (type) {
            case 'success': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            case 'warning': return 'bg-yellow-500';
            case 'info': default: return 'bg-blue-500';
        }
    };

    return (
        <div
            onClick={() => {
                if (onClick) {
                    onClick();
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }
            }}
            className={`flex items-center gap-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 transform overflow-hidden ${surfaceStyles} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
            style={{ minWidth: '300px' }}
        >
            {/* 左侧色条 */}
            <div className={`w-1 self-stretch shrink-0 ${getAccentColor()}`} />
            <div className="flex items-center gap-3 flex-1 py-3 pr-4">
                {getIcon()}
                <p className="flex-1 text-sm font-medium text-gray-700 dark:text-base-content whitespace-pre-line">{message}</p>
                <button
                    onClick={(e) => { 
                        e.stopPropagation();
                        setIsVisible(false); 
                        setTimeout(() => onClose(id), 300); 
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Toast;
