// Robust metrics implementation supporting both Agent (UDP) and Agentless (HTTPS API)
// Agentless is preferred for Hackathons/Cloud Run to avoid sidecar complexity.

import * as dgram from 'dgram';

const DD_API_KEY = process.env.DATADOG_API_KEY;
const DD_SITE = process.env.DATADOG_SITE || 'datadoghq.com';
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || 'localhost';
const DD_AGENT_PORT = parseInt(process.env.DD_AGENT_PORT || '8125');

const SERVICE_TAG = 'service:voicedoc-agent';
const ENV_TAG = `env:${process.env.NODE_ENV || 'development'}`;

// Lazy initialization to avoid errors during Next.js build
let udpClient: dgram.Socket | null = null;

function getUdpClient(): dgram.Socket {
    if (!udpClient) {
        udpClient = dgram.createSocket('udp4');
        udpClient.on('error', (err) => console.log('[Metrics] UDP Error (Agent likely missing):', err.message));
    }
    return udpClient;
}

/**
 * Sends a metric to Datadog. 
 * If DD_API_KEY is present, it uses the HTTPS API (no agent needed).
 * Otherwise, it falls back to UDP/StatsD (requires local agent).
 */
async function sendMetric(metricName: string, value: number, type: 'g' | 'c' | 'ms', tags: string[] = []) {
    const allTags = [SERVICE_TAG, ENV_TAG, ...tags];
    const fullMetricName = `voicedoc.${metricName}`;

    // PATH 1: AGENTLESS (HTTPS API) - Best for Hackathons
    if (DD_API_KEY) {
        try {
            const agentlessTags = [...tags, ENV_TAG];
            if (!agentlessTags.some(t => t.startsWith('service:'))) {
                agentlessTags.push('service:voicedoc-agent');
            }

            const series = [{
                metric: fullMetricName,
                points: [[Math.floor(Date.now() / 1000), value]],
                type: type === 'c' ? 'count' : 'gauge',
                tags: agentlessTags
            }];

            console.log(`[Metrics] 📤 Sending ${fullMetricName}: ${value} (${type}) Tags: ${agentlessTags.join(',')}`);

            const response = await fetch(`https://api.${DD_SITE}/api/v1/series?api_key=${DD_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ series })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`[Metrics] ❌ HTTPS API Error (${response.status}):`, errText);
            } else {
                console.log(`[Metrics] ✅ Datadog accepted ${fullMetricName}`);
            }
        } catch (error) {
            console.error('[Metrics] ❌ HTTPS API Request Failed:', error);
        }
    }

    // PATH 2: AGENT-BASED (UDP/StatsD)
    const payload = `${fullMetricName}:${value}|${type}|#${allTags.join(',')}`;
    const buffer = Buffer.from(payload);
    return new Promise<void>((resolve) => {
        getUdpClient().send(buffer, 0, buffer.length, DD_AGENT_PORT, DD_AGENT_HOST, (error) => {
            if (error && (error as any).code !== 'ECONNREFUSED') {
                console.error('[Metrics] ❌ UDP Error:', error);
            }
            resolve();
        });
    });
}

export class MetricsCollector {
    // Track request duration (latency)
    static async recordRequestDuration(durationMs: number, voiceMode: 'standard' | 'expressive' = 'standard', isNarration: boolean = false, trafficType: string = 'user') {
        return sendMetric('request.latency_ms', durationMs, 'g', [
            `voice_mode:${voiceMode}`,
            `is_narration:${isNarration ? 'true' : 'false'}`,
            `traffic_type:${trafficType}`
        ]);
    }

    // Time to First Token (TTFT)
    static async recordTTFT(durationMs: number, voiceMode: 'standard' | 'expressive' = 'standard', isNarration: boolean = false, trafficType: string = 'user') {
        return sendMetric('llm.ttft', durationMs, 'g', [
            `voice_mode:${voiceMode}`,
            `is_narration:${isNarration ? 'true' : 'false'}`,
            `traffic_type:${trafficType}`
        ]);
    }

    // Track attempt - should be called at the START of a request
    static async recordHit(voiceMode: 'standard' | 'expressive' = 'standard', isNarration: boolean = false, trafficType: string = 'user') {
        return sendMetric('request.hits', 1, 'c', [
            `voice_mode:${voiceMode}`,
            `is_narration:${isNarration ? 'true' : 'false'}`,
            `traffic_type:${trafficType}`
        ]);
    }

    // Track successful completion
    static async recordSuccess(voiceMode: 'standard' | 'expressive' = 'standard', trafficType: string = 'user') {
        return sendMetric('request.success', 1, 'c', [
            `voice_mode:${voiceMode}`,
            `traffic_type:${trafficType}`
        ]);
    }

    // Track errors
    static async recordError(errorType: string = 'unknown', voiceMode: 'standard' | 'expressive' = 'standard', trafficType: string = 'user') {
        return sendMetric('request.errors', 1, 'c', [
            `error_type:${errorType}`,
            `voice_mode:${voiceMode}`,
            `traffic_type:${trafficType}`
        ]);
    }

    static async recordTokens(promptTokens: number, completionTokens: number, voiceMode: 'standard' | 'expressive' = 'standard', trafficType: string = 'user') {
        const totalTokens = promptTokens + completionTokens;
        const tags = [
            `voice_mode:${voiceMode}`,
            `traffic_type:${trafficType}`
        ];

        return Promise.all([
            sendMetric('llm.prompt_tokens', promptTokens, 'g', tags),
            sendMetric('llm.completion_tokens', completionTokens, 'g', tags),
            sendMetric('llm.total_tokens', totalTokens, 'g', tags),
            sendMetric('llm.tokens.total', totalTokens, 'c', tags)
        ]);
    }

    static async recordLLMCost(promptTokens: number, completionTokens: number, voiceMode: 'standard' | 'expressive' = 'standard', trafficType: string = 'user') {
        const promptPrice = 0.000000075;
        const completionPrice = 0.0000003;
        const cost = (promptTokens * promptPrice) + (completionTokens * completionPrice);
        const tags = [
            `voice_mode:${voiceMode}`,
            `currency:usd`,
            `traffic_type:${trafficType}`
        ];

        return Promise.all([
            sendMetric('llm.cost', cost, 'g', tags),
            sendMetric('llm.cost.total', cost, 'c', tags)
        ]);
    }

    static async recordResponseLength(lengthChars: number, voiceMode: 'standard' | 'expressive' = 'standard', trafficType: string = 'user') {
        return sendMetric('response.length', lengthChars, 'g', [
            `voice_mode:${voiceMode}`,
            `traffic_type:${trafficType}`
        ]);
    }

    static async recordPersona(persona: string, trafficType: string = 'user') {
        return sendMetric('persona.classified', 1, 'c', [
            `persona_type:${persona}`,
            `traffic_type:${trafficType}`
        ]);
    }

    static async flush() {
        return new Promise<void>((resolve) => {
            getUdpClient().close(() => resolve());
        });
    }
}

export default MetricsCollector;
