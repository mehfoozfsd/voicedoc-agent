
export interface VoiceAgentMetrics {
    // Speech Input Metrics
    vad: {
        detectionStartTime: number; // when speech detected
        detectionEndTime: number;
        silenceDuration: number;
        speechDuration: number;
        confidence: number; // 0-1
    };

    // Speech-to-Text Metrics
    stt: {
        requestTime: number;
        firstTokenTime: number; // time to first transcription result
        finalTranscriptTime: number;
        totalSttLatency: number;
        confidence: number;
    };

    // LLM Processing Metrics
    llm: {
        requestTime: number;
        timeToFirstToken: number; // TTFT - critical metric
        timeToLastToken: number;
        totalLlmLatency: number;
        tokenCount: number;
        inputTokens: number;
        outputTokens: number;
    };

    // Text-to-Speech Metrics
    tts: {
        requestTime: number;
        timeToFirstByte: number; // TTFB - when audio starts streaming
        totalAudioDuration: number;
        totalTtsLatency: number;
        characterCount: number;
        audioBytesSent: number;
    };

    // End-to-End Metrics
    e2e: {
        userStartSpeech: number;
        agentStartResponse: number;
        agentFinishResponse: number;
        totalRoundTripLatency: number; // complete cycle
        perceivableLatency: number; // when user hears audio
    };
}

// Metric Collection Class
export class VoiceAgentMetricsCollector {
    private metrics: Partial<VoiceAgentMetrics> = {};
    private timers: Map<string, number> = new Map();

    // ============ VAD METRICS ============
    startVadDetection() {
        this.timers.set('vad_start', Date.now());
    }

    endVadDetection(speechConfidence: number = 0.8) {
        const startTime = this.timers.get('vad_start') || Date.now();
        const endTime = Date.now();

        this.metrics.vad = {
            detectionStartTime: startTime,
            detectionEndTime: endTime,
            silenceDuration: 0, // measure from last VAD end
            speechDuration: endTime - startTime,
            confidence: speechConfidence,
        };
    }

    // ============ STT METRICS ============
    startStt() {
        this.timers.set('stt_start', Date.now());
    }

    recordFirstSttToken() {
        const sttStart = this.timers.get('stt_start') || Date.now();
        const now = Date.now();
        this.timers.set('stt_first_token', now);

        if (!this.metrics.stt) this.metrics.stt = {} as any;
        // @ts-ignore
        this.metrics.stt.firstTokenTime = now - sttStart;
    }

    completeStt(confidence: number = 0.95) {
        const sttStart = this.timers.get('stt_start') || Date.now();
        const now = Date.now();

        this.metrics.stt = {
            requestTime: this.timers.get('stt_start') || 0,
            firstTokenTime: this.timers.get('stt_first_token')
                ? Math.max(0, this.timers.get('stt_first_token')! - sttStart)
                : 0,
            finalTranscriptTime: now,
            totalSttLatency: Math.max(0, now - sttStart),
            confidence: confidence,
        };
    }

    // ============ LLM METRICS ============
    startLlm() {
        this.timers.set('llm_start', Date.now());
    }

    recordFirstLlmToken() {
        const llmStart = this.timers.get('llm_start') || Date.now();
        const now = Date.now();
        this.timers.set('llm_first_token', now);

        if (!this.metrics.llm) this.metrics.llm = {} as any;
        // @ts-ignore
        this.metrics.llm.timeToFirstToken = now - llmStart;
    }

    completeLlm(
        inputTokens: number,
        outputTokens: number
    ) {
        const llmStart = this.timers.get('llm_start') || Date.now();
        const now = Date.now();

        this.metrics.llm = {
            requestTime: this.timers.get('llm_start') || 0,
            timeToFirstToken: this.timers.get('llm_first_token')
                ? Math.max(0, this.timers.get('llm_first_token')! - llmStart)
                : 0,
            timeToLastToken: now,
            totalLlmLatency: Math.max(0, now - llmStart),
            tokenCount: inputTokens + outputTokens,
            inputTokens,
            outputTokens,
        };
    }

    // ============ TTS METRICS ============
    startTts() {
        this.timers.set('tts_start', Date.now());
    }

    recordFirstByte() {
        const ttsStart = this.timers.get('tts_start') || Date.now();
        const now = Date.now();
        this.timers.set('tts_first_byte', now);

        if (!this.metrics.tts) this.metrics.tts = {} as any;
        // @ts-ignore
        this.metrics.tts.timeToFirstByte = now - ttsStart;
    }

    completeTts(
        characterCount: number,
        audioDuration: number,
        audioBytes: number
    ) {
        const ttsStart = this.timers.get('tts_start') || Date.now();
        const now = Date.now();

        this.metrics.tts = {
            requestTime: this.timers.get('tts_start') || 0,
            timeToFirstByte: this.timers.get('tts_first_byte')
                ? Math.max(0, this.timers.get('tts_first_byte')! - ttsStart)
                : 0,
            totalAudioDuration: audioDuration,
            totalTtsLatency: Math.max(0, now - ttsStart),
            characterCount,
            audioBytesSent: audioBytes,
        };
    }

    // ============ END-TO-END METRICS ============
    startUserSpeech() {
        this.timers.set('e2e_start', Date.now());
    }

    recordAgentResponseStart() {
        const e2eStart = this.timers.get('e2e_start') || Date.now();
        const now = Date.now();
        this.timers.set('e2e_response_start', now);

        if (!this.metrics.e2e) this.metrics.e2e = {} as any;
        // @ts-ignore
        this.metrics.e2e.userStartSpeech = e2eStart;
        // @ts-ignore
        this.metrics.e2e.agentStartResponse = now;
    }

    recordAgentResponseComplete(totalAudioDuration: number) {
        const responseStart =
            this.timers.get('e2e_response_start') || Date.now();
        const e2eStart = this.timers.get('e2e_start') || Date.now();
        const now = Date.now();

        this.metrics.e2e = {
            userStartSpeech: e2eStart,
            agentStartResponse: responseStart,
            agentFinishResponse: now,
            totalRoundTripLatency: Math.max(0, now - e2eStart),
            perceivableLatency: Math.max(0, responseStart - e2eStart), // when user hears first audio
        };
    }

    // ============ REPORTING ============
    getMetrics(): Partial<VoiceAgentMetrics> {
        return { ...this.metrics };
    }

    getMetricsSummary() {
        return {
            ttfb: this.metrics.tts?.timeToFirstByte || 0, // Time to First Byte
            ttft: this.metrics.llm?.timeToFirstToken || 0, // Time to First Token (LLM)
            sttLatency: this.metrics.stt?.totalSttLatency || 0,
            llmLatency: this.metrics.llm?.totalLlmLatency || 0,
            ttsLatency: this.metrics.tts?.totalTtsLatency || 0,
            e2eLatency: this.metrics.e2e?.totalRoundTripLatency || 0,
            perceivableLatency:
                this.metrics.e2e?.perceivableLatency || 0,
            vadDuration: this.metrics.vad?.speechDuration || 0,
        };
    }

    reset() {
        this.metrics = {};
        this.timers.clear();
    }
}
