'use client';

import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface VoiceOrbProps {
    mode: 'idle' | 'listening' | 'speaking' | 'processing';
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ mode }) => {
    const controls = useAnimation();

    useEffect(() => {
        // Animation logic based on mode
        switch (mode) {
            case 'idle':
                controls.start({
                    scale: [1, 1.1, 1],
                    opacity: 0.5,
                    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                });
                break;
            case 'listening':
                controls.start({
                    scale: [1, 1.2, 0.9, 1.1],
                    opacity: 0.8,
                    transition: { duration: 1.5, repeat: Infinity, ease: "linear" } // Jittery
                });
                break;
            case 'processing':
                controls.start({
                    rotate: 360,
                    scale: 1,
                    opacity: 1,
                    transition: { duration: 1, repeat: Infinity, ease: "linear" }
                });
                break;
            case 'speaking':
                controls.start({
                    scale: [1, 1.3, 1],
                    opacity: 1,
                    boxShadow: "0px 0px 20px 5px rgba(100, 200, 255, 0.5)",
                    transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
                });
                break;
        }
    }, [mode, controls]);

    // Dynamic colors based on mode
    const getColors = () => {
        switch (mode) {
            case 'idle': return ['#6366f1', '#a855f7']; // Indigo to Purple
            case 'listening': return ['#ef4444', '#f97316']; // Red to Orange
            case 'processing': return ['#eab308', '#22c55e']; // Yellow to Green
            case 'speaking': return ['#3b82f6', '#06b6d4']; // Blue to Cyan
            default: return ['#6366f1', '#a855f7'];
        }
    };

    const colors = getColors();

    return (
        <div className="relative flex items-center justify-center w-64 h-64">
            {/* Glow Effect */}
            <motion.div
                className="absolute w-40 h-40 rounded-full blur-xl opacity-30"
                animate={{
                    background: `conic-gradient(from 0deg, ${colors[0]}, ${colors[1]}, ${colors[0]})`,
                }}
            />

            {/* Core Orb */}
            <motion.div
                className="relative w-32 h-32 rounded-full overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                    boxShadow: `0 0 20px ${colors[0]}80`
                }}
                animate={controls}
            >
                {/* Inner shine/detail */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
            </motion.div>
        </div>
    );
};
