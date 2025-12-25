# 🔥 Firestore Setup Guide

For the RAG (Retrieval Augmented Generation) pipeline to work, you must create a Firestore database and configure a Vector Index.

## 1. Create Database
1. Go to the [Firestore Console](https://console.cloud.google.com/firestore).
2. Click **Create Database**, name it `voicedoc-fs`.
3. **Select Mode**: Choose **Native Mode** (Required for Vector Search).
4. **Location**: Select `us-southeast1` (or the same region as your Vertex AI setup).
5. Click **Create**.

## 2. API Enablement
Ensure the following APIs are enabled in your Google Cloud Project:
*   **Cloud Firestore API**
*   **Vertex AI API**

## 3. Data Schema

### Collection: `documents`
Used for **Smart Ingestion** (Deduplication). Before processing a file, we check if its hash exists here.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Auto-generated |
| `hash` | String | SHA-256 hash of the file content |
| `filename` | String | Original filename |
| `persona` | String | Detected persona (e.g., 'legal', 'academic') |
| `summary` | String | Short summary of the document |
| `created_at` | Timestamp | Upload time |

### Collection: `document_chunks`
Stores the actual text segments and embeddings for RAG.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Auto-generated |
| `text` | String | The actual text chunk |
| `embedding` | Vector (Array) | 768-dim vector from `text-embedding-004` |
| `metadata.filename` | String | **Critical**: Used to filter search results to the active document only |
| `metadata.persona` | String | Persona of the source document |

## 4. Create Vector Index
To enable efficient similarity search (KNN), you need a Vector Index on the `embedding` field.

```bash
gcloud firestore indexes composite create \
--collection-group=document_chunks \
--query-scope=COLLECTION \
--field-config=field-path=embedding,vector-config='{"dimension":"768","flat": {}}' \
--database='voicedoc-fs'
```

*   **Collection**: `document_chunks` (matches our code in `src/lib/firestore.ts`)
*   **Field**: `embedding`
*   **Dimension**: `768` (Output dimension of `text-embedding-004`)
*   **Mode**: `flat` (Good for small to medium datasets, exact search)

> ⏳ **Note**: Index creation can take a few minutes.

## 5. Security Rules (Production)

Since our application runs server-side (Next.js API Routes) and uses the **Admin SDK** (via `@google-cloud/firestore`), we bypass Security Rules and rely on IAM permissions. 

Therefore, we can **lock down the database completely** to prevent any public access from browsers or mobile devices.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Why this works**:
*   **Public/Client Access**: BLOCKED (Read/Write: false).
*   **VoiceDoc Agent (Server)**: ALLOWED (Uses Service Account credentials which ignore these rules).
