import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, Skull, Trophy, CheckCircle, Zap } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'warning' | 'info' | 'danger' | 'success' | 'victory' | 'elimination';

export interface ToastData {
    id: string;
    type: ToastType;
    title: string;
    message: string;
}

const icons = {
    warning: <AlertTriangle className="w-5 h-5 text-orange-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    danger: <Zap className="w-5 h-5 text-red-500" />,
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    victory: <Trophy className="w-5 h-5 text-yellow-500" />,
    elimination: <Skull className="w-5 h-5 text-gray-500" />
};

const bgColors = {
    warning: 'bg-orange-500/10 border-orange-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
    danger: 'bg-red-500/10 border-red-500/20',
    success: 'bg-green-500/10 border-green-500/20',
    victory: 'bg-yellow-500/10 border-yellow-500/20',
    elimination: 'bg-gray-500/10 border-gray-500/20'
};

export default function GameToast({ toasts, removeToast }: { toasts: ToastData[], removeToast: (id: string) => void }) {
    return (
        <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
                ))}
            </AnimatePresence>
        </div>
    );
}

function ToastItem({ toast, removeToast }: { toast: ToastData, removeToast: (id: string) => void }) {
    useEffect(() => {
        const t = setTimeout(() => {
            removeToast(toast.id);
        }, 4000);
        return () => clearTimeout(t);
    }, [toast.id, removeToast]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-xl bg-[#1e1c1a] ${bgColors[toast.type]} pointer-events-auto min-w-[280px] max-w-[320px]`}
        >
            <div className="mt-0.5 p-2 bg-white/5 rounded-xl">
                {icons[toast.type]}
            </div>
            <div className="flex-1">
                <h4 className="text-white font-bold text-sm tracking-wide">{toast.title}</h4>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{toast.message}</p>
            </div>
        </motion.div>
    );
}
