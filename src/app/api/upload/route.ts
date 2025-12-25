import { NextRequest, NextResponse } from 'next/server';
import tracer from '@/lib/datadog-init';
import { getClassifiedPersona } from '@/lib/vertex';
import { chunkText, generateEmbedding } from '@/lib/rag';
import { saveChunks, Chunk, getDocumentByHash, saveDocumentMetadata } from '@/lib/firestore';
import crypto from 'crypto';

// Force dynamic rendering - don't try to build this route statically
export const dynamic = 'force-dynamic';

// Polyfills for pdf-parse in server environment
if (typeof Promise.withResolvers === 'undefined') {
    // @ts-ignore
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

// Minimal polyfill for DOMMatrix/Path2D if missing
if (!global.DOMMatrix) {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;

        constructor() { }
        translate() { return this; }
        scale() { return this; }
        transformPoint(p: any) { return p; }
        multiply() { return this; }
        inverse() { return this; }
    };
}
if (!global.Path2D) {
    // @ts-ignore
    global.Path2D = class Path2D {
        constructor() { }
        addPath() { }
    };
}

// @ts-ignore
const pdf = require('pdf-parse');


// Disable body parser generally handled by Next.js for FormData, but good to know
// Next.js App Router handles FormData automatically

export async function POST(req: NextRequest) {
    return tracer.trace('api.upload', async (span) => {
        try {
            const formData = await req.formData();
            const file = formData.get('file') as File;

            if (!file) {
                span?.setTag('error', true);
                return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
            }

            span?.setTag('file.name', file.name);
            span?.setTag('file.type', file.type);
            span?.setTag('file.size', file.size);

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 1. Calculate Hash for Deduplication
            const hash = crypto.createHash('sha256').update(buffer).digest('hex');
            console.log(`📄 Processing file: ${file.name} | Hash: ${hash.substring(0, 8)}...`);
            span?.setTag('file.hash', hash);

            // 2. Check for Duplicate
            const existingDoc = await getDocumentByHash(hash);
            if (existingDoc) {
                console.log(`✨ Duplicate detected! Skipping ingestion for ${file.name}`);
                span?.setTag('upload.duplicate', true);
                return NextResponse.json({
                    filename: existingDoc.filename,
                    persona: existingDoc.persona,
                    textSummary: existingDoc.summary || "Document previously uploaded.",
                    ingestedChunks: 0,
                    isDuplicate: true
                });
            }

            let text = '';

            if (file.type === 'application/pdf') {
                const data = await pdf(buffer);
                text = data.text;
                span?.setTag('file.is_pdf', true);
            } else {
                // Assume text/* or similar
                text = buffer.toString('utf-8');
                span?.setTag('file.is_pdf', false);
            }

            // 🏷️ Tag traffic type
            const trafficSource = req.headers.get('x-voicedoc-traffic') || 'user';
            span?.setTag('traffic.type', trafficSource);

            const persona = await getClassifiedPersona(text, trafficSource);
            console.log(`📄 Document Classification - File: ${file.name} | Detected Persona: ${persona} | Traffic: ${trafficSource}`);
            span?.setTag('file.persona', persona);

            // RAG Ingestion Process
            // 1. Chunk the text
            const textChunks = chunkText(text);
            span?.setTag('rag.chunk_count', textChunks.length);

            // 2. Generate Embeddings & Prepare for Firestore
            const chunksToSave: Chunk[] = [];

            // Process in parallel
            await Promise.all(textChunks.map(async (chunkText) => {
                try {
                    const embedding = await generateEmbedding(chunkText);
                    chunksToSave.push({
                        text: chunkText,
                        embedding: embedding,
                        metadata: {
                            filename: file.name,
                            persona: persona
                        }
                    });
                } catch (e) {
                    console.error('Error embedding chunk:', e);
                }
            }));

            // 3. Save to Firestore (Chunks)
            if (chunksToSave.length > 0) {
                console.log(`Saving ${chunksToSave.length} chunks to Firestore...`);
                await saveChunks(chunksToSave);
                console.log('Chunks saved successfully.');

                // 4. Save Document Metadata (for future dedup)
                await saveDocumentMetadata({
                    hash: hash,
                    filename: file.name,
                    persona: persona,
                    summary: text.slice(0, 200) + '...'
                });
            } else {
                console.warn('No chunks generated to save.');
                span?.setTag('upload.warning', 'no_chunks');
            }

            return NextResponse.json({
                filename: file.name,
                persona,
                textSummary: text.slice(0, 200) + '...',
                ingestedChunks: chunksToSave.length
            });

        } catch (error: any) {
            console.error('Upload error:', error);
            span?.setTag('error', true);
            span?.setTag('error.message', error.message);
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        }
    });
}
