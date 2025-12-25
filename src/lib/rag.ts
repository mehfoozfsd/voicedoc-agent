import { GoogleAuth } from 'google-auth-library';

// Lazy initialization to avoid errors during Next.js build
let auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
    if (!auth) {
        auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
    }
    return auth;
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const project = process.env.VERTEX_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    if (!project) {
        throw new Error('VERTEX_PROJECT_ID is not defined in environment variables');
    }

    console.log('[Embedding] Generating for text length:', text.length);
    console.log('[Embedding] Using location:', location);

    try {
        const client = await getAuth().getClient();

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/text-embedding-005:predict`;

        console.log('[Embedding] Calling endpoint:', endpoint);

        const response = await client.request({
            url: endpoint,
            method: 'POST',
            data: {
                instances: [
                    {
                        content: text
                    }
                ]
            }
        });

        const predictions = (response.data as any).predictions;

        if (!predictions || predictions.length === 0) {
            throw new Error('No predictions returned from API');
        }

        // Extract embedding from the nested response structure
        const embedding = predictions[0].embeddings?.values ||
            predictions[0].embedding?.values;

        if (!embedding || embedding.length === 0) {
            console.error('Response structure:', JSON.stringify(predictions[0], null, 2));
            throw new Error('No embedding values found in response');
        }

        console.log('[Embedding] ✅ Generated embedding, dimension:', embedding.length);
        return embedding;
    } catch (error) {
        console.error('[Embedding] ❌ Embedding generation failed:', error);
        throw error;
    }
}

export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        const endIndex = Math.min(startIndex + chunkSize, text.length);
        const chunk = text.slice(startIndex, endIndex);

        chunks.push(chunk);

        startIndex += chunkSize - overlap;
    }

    console.log('[ChunkText] Split text into', chunks.length, 'chunks');
    return chunks;
}