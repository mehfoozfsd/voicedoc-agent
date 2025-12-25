'use client';

import React from 'react';
import { Activity, Mic, Cpu, MessageSquare, Volume2, Clock } from 'lucide-react';
import { VoiceAgentMetrics } from '@/lib/metrics';

interface MetricsSidebarProps {
    metrics: Partial<VoiceAgentMetrics>;
}

export function MetricsSidebar({ metrics }: MetricsSidebarProps) {
    // Helper to format duration - auto-converts to seconds if >= 1000ms
    const fmt = (ms: number | undefined) => {
        if (ms === undefined || ms === null) return '-';
        if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.round(ms)}ms`;
    };

    // Helper specifically for durations that should always be in seconds
    const fmtSec = (ms: number | undefined) => {
        if (ms === undefined || ms === null) return '-';
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="w-80 border-l border-white/10 bg-black/20 backdrop-blur-xl flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-white/10">
                <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Real-time Metrics
                </h2>
            </div>

            <div className="flex-1 p-4 space-y-6">

                {/* End-to-End Latency - Key Metric */}
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-indigo-300">Perceivable Latency</span>
                        <Clock className="w-3 h-3 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                        {fmt(metrics.e2e?.perceivableLatency)}
                    </div>
                    <div className="text-[10px] text-indigo-400/80">
                        Total Round Trip: {fmt(metrics.e2e?.totalRoundTripLatency)}
                    </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-4">

                    {/* Speech / VAD */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                            <Mic className="w-3 h-3" /> Speech Input
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="Speech Duration" value={fmtSec(metrics.vad?.speechDuration)} />
                            <MetricCard label="Confidence" value={metrics.vad?.confidence ? `${(metrics.vad.confidence * 100).toFixed(0)}%` : '-'} />
                        </div>
                    </div>

                    {/* STT */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                            <MessageSquare className="w-3 h-3" /> Transcribe
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="Latency" value={fmt(metrics.stt?.totalSttLatency)} />
                            <MetricCard label="First Token" value={fmt(metrics.stt?.firstTokenTime)} />
                        </div>
                    </div>

                    {/* LLM */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                            <Cpu className="w-3 h-3" /> Intelligence
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="Total Latency" value={fmt(metrics.llm?.totalLlmLatency)} highlight />
                            <MetricCard label="TTFT" value={fmt(metrics.llm?.timeToFirstToken)} />
                            <div className="col-span-2">
                                <MetricCard label="Tokens" value={`${metrics.llm?.inputTokens || 0} in / ${metrics.llm?.outputTokens || 0} out`} fullWidth />
                            </div>
                        </div>
                    </div>

                    {/* TTS */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                            <Volume2 className="w-3 h-3" /> Voice Gen
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <MetricCard label="Latency" value={fmt(metrics.tts?.totalTtsLatency)} />
                            <MetricCard label="TTFB" value={fmt(metrics.tts?.timeToFirstByte)} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Sub-component for individual metric cards
function MetricCard({ label, value, highlight, fullWidth }: { label: string, value: string | number, highlight?: boolean, fullWidth?: boolean }) {
    return (
        <div className={`p-2 rounded-lg bg-white/5 border border-white/5 flex flex-col ${fullWidth ? 'w-full' : ''}`}>
            <span className="text-[10px] text-gray-500 mb-0.5">{label}</span>
            <span className={`text-sm font-mono font-medium ${highlight ? 'text-green-400' : 'text-gray-300'}`}>
                {value}
            </span>
        </div>
    );
}
