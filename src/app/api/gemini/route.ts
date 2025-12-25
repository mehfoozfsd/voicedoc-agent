// app/api/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server';
import tracer from '@/lib/datadog-init';
import { getGeminiStream } from '@/lib/vertex';
import { MetricsCollector } from '@/lib/datadog-metrics';
import { generateEmbedding, chunkText } from '@/lib/rag';
import { searchSimilarChunks } from '@/lib/firestore';

// Force dynamic rendering - don't try to build this route statically
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const requestStartTime = Date.now(); // 📊 START TIMER

    return tracer.trace('gemini.request', async (span) => {
        let body: any = {};
        try {
            body = await req.json();
            const { history, query, context, filename, persona, expressiveMode, forceError } = body;

            // ✅ Log the filename
            console.log('[API/Gemini] 📥 Received Request:', {
                queryPreview: query?.substring(0, 50),
                filename,
                persona,
                expressiveMode,
                forceError,
                hasContext: !!context
            });

            // 🏷️ Tag synthetic traffic
            const trafficSource = req.headers.get('x-voicedoc-traffic') || 'user';
            const scenario = req.headers.get('x-voicedoc-scenario') || 'normal';
            span?.setTag('traffic.type', trafficSource);
            span?.setTag('traffic.scenario', scenario);

            const voice_mode = expressiveMode ? 'expressive' : 'standard';
            span?.setTag('llm.query', query);
            span?.setTag('llm.filename', filename);
            span?.setTag('llm.persona', persona);
            span?.setTag('llm.expressive_mode', expressiveMode);
            span?.setTag('voice_mode', voice_mode);

            // ⚡ Check for narration early
            const isNarrationRequest = /^(read|narrate|tell me|recite|play|start|begin|chapter|section)/i.test(query);

            // 📊 RECORD HIT AT THE START
            await MetricsCollector.recordHit(voice_mode, isNarrationRequest, trafficSource);
            await MetricsCollector.recordPersona(persona || 'narrative', trafficSource);

            // 💥 Deterministic error for Datadog Monitors/Runbooks demo
            if (forceError) {
                console.error('[API/Gemini] 💥 Forced synthetic error triggered');
                MetricsCollector.recordError('forced_error', voice_mode, trafficSource);
                throw new Error('Synthetic Gemini failure for Datadog demo');
            }

            if (!query) {
                span?.setTag('error', true);
                await MetricsCollector.recordError('no_query', voice_mode, trafficSource);
                return NextResponse.json({ error: 'Query required' }, { status: 400 });
            }

            // RAG Retrieval Step
            let augmentedContext = context || '';

            try {
                console.log('[RAG] 🔍 Starting RAG retrieval...');
                span?.setTag('rag.enabled', true);

                const queryEmbedding = await generateEmbedding(query);
                const similarChunks = await searchSimilarChunks(queryEmbedding, 3, filename);

                span?.setTag('rag.chunk_count', similarChunks.length);

                if (similarChunks.length > 0) {
                    const retrievedText = similarChunks.map(c => c.text).join('\n\n');
                    augmentedContext += `\n\nRelevant Document Excerpts:\n${retrievedText}`;
                }
            } catch (e: any) {
                console.warn('[RAG] ⚠️ RAG retrieval failed:', e);
                span?.setTag('rag.error', e.message);
            }

            // Create a streaming response
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    const generatorStartTime = Date.now(); // 📊 START TIMER
                    let hasError = false;

                    try {
                        const generator = getGeminiStream(history || [], query, augmentedContext, isNarrationRequest, expressiveMode, persona, trafficSource);

                        let chunkCount = 0;
                        let totalText = '';
                        let firstTokenSent = false;

                        for await (const chunk of generator) {
                            try {
                                if (chunk && typeof chunk === 'string') {
                                    const trimmed = chunk.trim();
                                    if (trimmed) {
                                        if (!firstTokenSent) {
                                            const ttft = Date.now() - generatorStartTime;
                                            console.log(`[API] 🚀 First token received! TTFT: ${ttft}ms`);
                                            MetricsCollector.recordTTFT(ttft, voice_mode, isNarrationRequest, trafficSource);
                                            firstTokenSent = true;
                                        }
                                        controller.enqueue(encoder.encode(chunk));
                                        chunkCount++;
                                        totalText += chunk;
                                    }
                                }
                            } catch (enqueueErr) {
                                console.error('[Stream] ❌ Error enqueuing chunk:', enqueueErr);
                                hasError = true;
                                break;
                            }
                        }

                        span?.setTag('llm.chunks', chunkCount);
                        span?.setTag('llm.response_length', totalText.length);

                        // 📊 RECORD METRICS AT THE END (duration measured inside generator)
                        const duration = Date.now() - generatorStartTime;
                        await MetricsCollector.recordSuccess(voice_mode, trafficSource);
                        await MetricsCollector.recordRequestDuration(duration, voice_mode, isNarrationRequest, trafficSource);
                        await MetricsCollector.recordResponseLength(totalText.length, voice_mode, trafficSource);
                        console.log(`[API] ✅ Request completed in ${duration}ms`);

                        controller.close();

                    } catch (generatorError: any) {
                        hasError = true;
                        span?.setTag('error', true);
                        span?.setTag('error.message', generatorError.message);

                        // 📊 RECORD ERROR
                        const duration = Date.now() - generatorStartTime;
                        await MetricsCollector.recordError('generator_error', voice_mode, trafficSource);
                        await MetricsCollector.recordRequestDuration(duration, voice_mode, isNarrationRequest, trafficSource);

                        controller.close();
                    }
                }
            });

            return new NextResponse(stream, {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Transfer-Encoding': 'chunked',
                    'Cache-Control': 'no-cache',
                },
            });

        } catch (error: any) {
            console.error('[Route] ❌ Fatal error:', error);
            span?.setTag('error', true);
            span?.setTag('error.message', error.message);

            // 📊 RECORD ERROR METRIC
            const trafficSource = req.headers.get('x-voicedoc-traffic') || 'user';
            const voice_mode = body?.expressiveMode ? 'expressive' : 'standard';
            const duration = Date.now() - requestStartTime;

            await MetricsCollector.recordError('api_error', voice_mode, trafficSource);
            await MetricsCollector.recordRequestDuration(duration, voice_mode, false, trafficSource);

            return NextResponse.json(
                {
                    error: 'Failed to generate response',
                    details: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                },
                { status: 500 }
            );
        }
    });
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: '/api/gemini',
        method: 'POST',
        requiredFields: ['query', 'history'],
        optionalFields: ['context', 'filename']
    });
}