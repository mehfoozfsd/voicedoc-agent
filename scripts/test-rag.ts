import { generateEmbedding } from '../src/lib/rag';
import { searchSimilarChunks } from '../src/lib/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

// Force load .env.local if available, or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    console.log('Testing RAG Retrieval...');
    console.log('Project ID:', process.env.VERTEX_PROJECT_ID);

    // 1. Generate Embedding
    const query = "financial report summary";
    console.log(`Generating embedding for query: "${query}"...`);

    try {
        const embedding = await generateEmbedding(query);
        console.log(`Embedding generated. Length: ${embedding.length}`);

        // 2. Search Firestore
        console.log('Searching Firestore for similar chunks...');
        const chunks = await searchSimilarChunks(embedding);

        console.log(`Found ${chunks.length} chunks.`);

        chunks.forEach((chunk, i) => {
            console.log(`\n--- Chunk ${i + 1} ---`);
            console.log(`Text Preview: ${chunk.text.substring(0, 100)}...`);
            console.log(`Metadata:`, chunk.metadata);
        });

    } catch (error) {
        console.error('RAG Test Failed:', error);
        console.error(error);
    }
}

main();
