// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

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
        console.log('=== Transcribe API Called ===');

        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            console.error('No audio file provided');
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        console.log(`📦 Received audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

        // Convert File to Blob
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBlob = new Blob([arrayBuffer], { type: audioFile.type || 'audio/webm' });

        console.log('🎙️ Calling ElevenLabs speechToText.convert()...');

        const transcription = await getClient().speechToText.convert({
            file: audioBlob,
            modelId: 'scribe_v1',
            tagAudioEvents: true,
            languageCode: 'eng',
            diarize: true,
        });

        console.log('✅ Transcription successful:', JSON.stringify(transcription, null, 2));

        // Handle different response structures
        let transcribedText = '';

        // Check various possible response structures
        if ((transcription as any).text) {
            transcribedText = (transcription as any).text;
        } else if ((transcription as any).transcription) {
            transcribedText = (transcription as any).transcription;
        } else if ((transcription as any).result) {
            transcribedText = (transcription as any).result;
        } else if ((transcription as any).chunks && Array.isArray((transcription as any).chunks)) {
            // If it's multichannel with chunks
            transcribedText = (transcription as any).chunks
                .map((chunk: any) => chunk.text || chunk.transcript || '')
                .join(' ');
        } else if (Array.isArray(transcription)) {
            // If it's an array response
            transcribedText = transcription
                .map((item: any) => item.text || item.transcript || '')
                .join(' ');
        }

        console.log('📝 Extracted text:', transcribedText);

        return NextResponse.json({
            text: transcribedText,
            success: true,
            transcription: transcription,
        });

    } catch (error) {
        console.error('❌ Transcription error:', error);

        // Log detailed error info
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                error: 'Transcription failed',
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}