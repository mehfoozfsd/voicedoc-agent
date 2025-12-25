import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, RefreshCw, X } from 'lucide-react';

interface MicPermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRetry: () => void;
    errorType?: 'permission' | 'not-found' | 'unknown';
}

export const MicPermissionModal: React.FC<MicPermissionModalProps> = ({
    isOpen,
    onClose,
    onRetry,
    errorType = 'unknown'
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl"
                    >
                        {/* Header / Icon Area */}
                        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-b from-indigo-500/10 to-transparent">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 animate-pulse" />
                                <div className="w-16 h-16 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center relative z-10">
                                    <MicOff className="w-8 h-8 text-red-400" />
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-white text-center">
                                {errorType === 'permission' ? 'Microphone Access Denied' :
                                    errorType === 'not-found' ? 'Microphone Not Found' :
                                        'Microphone Issue Detected'}
                            </h2>
                        </div>

                        {/* Body */}
                        <div className="px-6 pb-6 text-center space-y-4">
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {errorType === 'permission' ? (
                                    "We need access to your microphone to enable voice interactions. Please check your browser permissions settings and try again."
                                ) : errorType === 'not-found' ? (
                                    "We couldn't detect a microphone on your device. Please ensure your microphone is connected and working effectively."
                                ) : (
                                    "There was an alerting confirming your microphone access. Please ensure your device is connected and permissions are granted."
                                )}
                            </p>

                            <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-gray-500 border border-white/5 mx-2">
                                <p>Status: <span className="text-red-400 font-mono">NotAllowedError: Permission denied</span></p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-3 pt-2">
                                <button
                                    onClick={onRetry}
                                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Wait, I Fixed It - Retry
                                </button>

                                <button
                                    onClick={onClose}
                                    className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    Continue Without Voice
                                </button>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
