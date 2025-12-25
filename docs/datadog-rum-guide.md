# Datadog RUM & Session Replay Guide

This document explains how to access and demonstrate the Datadog Real User Monitoring (RUM) and Session Replay features for VoiceDoc Agent.

## 🎥 What is Session Replay?

Session Replay captures and replays actual user sessions, showing exactly what users see and do in the application. This is incredibly powerful for:
- **Debugging UX issues** - See exactly what went wrong from the user's perspective
- **Understanding user behavior** - Watch how users interact with voice features
- **Correlating frontend actions with backend traces** - Click on a user action and see the corresponding API calls

## 📊 Accessing RUM Data

### 1. Navigate to RUM in Datadog

1. Log into your Datadog account
2. Go to **UX Monitoring** > **Sessions** (or **RUM** > **Sessions**)
3. You'll see a list of all user sessions

### 2. Filter Sessions

You can filter sessions by:
- **Application**: `voicedoc-agent`
- **User Actions**: Look for sessions with actions like:
  - `Voice Input Toggle`
  - `Document Upload Start`
  - `Gemini Query Start`
- **Time Range**: Recent sessions from your testing

### 3. View Session Replay

1. Click on any session to open the details
2. Click the **Session Replay** tab
3. You'll see a video-like playback of the user's session showing:
   - Mouse movements and clicks
   - Voice input button interactions
   - Document uploads
   - AI responses appearing in real-time
   - Expressive mode toggles

## 🔗 RUM-APM Linking

VoiceDoc Agent connects frontend user actions to backend traces:

### How It Works

1. **User clicks "Voice Input"** → RUM captures this action
2. **Frontend sends request to `/api/gemini`** → RUM creates a resource entry
3. **Backend processes with dd-trace** → APM creates spans
4. **RUM and APM are linked** → You can click from the session replay directly to the backend trace

### To See This:

1. In a Session Replay, look for network requests (shown in the timeline)
2. Click on a request to `/api/gemini` or `/api/upload`
3. Click **View Trace** to jump to the APM trace
4. You'll see the full backend execution including:
   - Gemini API latency
   - Token usage
   - RAG retrieval time
   - Firestore operations

## 📈 Key RUM Metrics to Showcase

### User Actions Tracked

```typescript
// Voice Input Toggle
datadogRum.addAction('Voice Input Toggle', { status: 'started' });

// Document Upload
datadogRum.addAction('Document Upload Start', {
  filename: file.name,
  fileSize: file.size
});

// Gemini Query
datadogRum.addAction('Gemini Query Start', {
  query: query.substring(0, 50),
  persona: persona,
  expressiveMode: expressiveMode
});
```

### Performance Metrics

- **Page Load Time**: How fast the app loads
- **Time to Interactive**: When users can start interacting
- **API Response Times**: `/api/gemini`, `/api/upload`, etc.
- **Error Rate**: Any frontend errors