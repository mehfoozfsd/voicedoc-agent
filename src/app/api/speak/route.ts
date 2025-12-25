// app/api/speak/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { getVoiceIdForPersona, Persona } from '@/lib/elevenlabs';

// Lazy initialization to avoid errors during Next.js build
let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
    if (!client) {
        client = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY
        });
    }
    return client;
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const {
            text,
            persona,
            expressiveMode = false,   // 🔑 mirrors Gemini pipeline
        }: {
            text: string;
            persona?: Persona;
            expressiveMode?: boolean;
        } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const voiceId = getVoiceIdForPersona(persona as Persona);

        // 🎭 Model selection
        const modelId = expressiveMode
            ? 'eleven_v3'
            : 'eleven_flash_v2_5';

        const inferredExpressive =
            expressiveMode || /\[[^\]]+\]/.test(text);

        const finalExpressiveMode = inferredExpressive;

        // 🧹 Strip emotion tags in standard mode
        const processedText = finalExpressiveMode
            ? text
            : text.replace(/\[[^\]]*?\]/g, '').trim();

        console.log(
            `🎙️ TTS Request | Persona: ${persona || 'narrative'} | ` +
            `Mode: ${expressiveMode ? 'expressive' : 'standard'} | ` +
            `Model: ${modelId} | VoiceID: ${voiceId}`
        );

        const audio = await getClient().textToSpeech.convert(voiceId, {
            text: processedText,
            modelId,
            outputFormat: 'mp3_44100_128',
        });

        return new NextResponse(audio as any, {
            headers: {
                'Content-Type': 'audio/mpeg',
            },
        });

    } catch (error: any) {
        console.error('❌ TTS Error:', {
            message: error.message,
            statusCode: error.statusCode,
            body: error.body,
        });

        return NextResponse.json(
            { error: error.message || 'TTS failed', details: error.body || '' },
            { status: error.statusCode || 500 }
        );
    }
}
