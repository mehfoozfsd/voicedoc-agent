'use client';

import { datadogRum } from '@datadog/browser-rum';
import { useEffect } from 'react';

export default function DatadogInit() {
    useEffect(() => {
        const clientToken = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN;
        const applicationId = process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID;
        const site = process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com';
        const service = process.env.NEXT_PUBLIC_DATADOG_SERVICE || 'voicedoc-agent';
        const env = process.env.NEXT_PUBLIC_DATADOG_ENV || 'development';

        if (clientToken && applicationId) {
            console.log('[Datadog] 🚀 Initializing RUM with config:', {
                site,
                service,
                env,
                applicationId: applicationId.substring(0, 8) + '...',
                clientToken: clientToken.substring(0, 10) + '...',
                sessionSampleRate: 100,
                sessionReplaySampleRate: 100
            });

            try {
                datadogRum.init({
                    applicationId,
                    clientToken,
                    site,
                    service,
                    env,
                    sessionSampleRate: 100,
                    sessionReplaySampleRate: 20, // 100% for development/testing
                    trackUserInteractions: true,
                    trackResources: true,
                    trackLongTasks: true,
                    trackBfcacheViews: true,
                    defaultPrivacyLevel: 'mask-user-input',
                    allowedTracingUrls: [
                        { match: window.location.origin + '/api/', propagatorTypes: ['datadog'] }
                    ],
                    traceSampleRate: 100,
                });

                console.log('[Datadog] ✅ RUM initialized successfully');

                // Start Session Replay Recording
                datadogRum.startSessionReplayRecording();
                console.log('[Datadog] 🎥 Session Replay recording started');

                // Verify session is active
                setTimeout(() => {
                    const context = datadogRum.getInternalContext?.();
                    if (context?.session_id) {
                        console.log('[Datadog] 📊 Active Session ID:', context.session_id);
                        console.log('[Datadog] 🔗 View in Datadog:', `https://${site}/rum/sessions/${context.session_id}`);
                    } else {
                        console.warn('[Datadog] ⚠️ No active session found after initialization');
                    }
                }, 1000);

            } catch (error) {
                console.error('[Datadog] ❌ Failed to initialize RUM:', error);
            }
        } else {
            console.warn('[Datadog] ⚠️ RUM not initialized - Missing credentials:', {
                hasClientToken: !!clientToken,
                hasApplicationId: !!applicationId
            });
        }
    }, []);

    return null;
}
