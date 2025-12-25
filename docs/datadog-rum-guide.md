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

## 🎬 Creating a Demo Video

For your hackathon submission, you can:

1. **Record a Session**:
   - Open the app
   - Upload a document
   - Ask a few questions using voice
   - Toggle expressive mode
   - This creates a rich session in Datadog

2. **Access the Replay**:
   - Go to Datadog RUM Sessions
   - Find your session
   - Click Session Replay

3. **Show the Integration**:
   - Play the session replay
   - Pause at a Gemini query
   - Click on the network request
   - Show the linked APM trace
   - Highlight the token usage and latency metrics

## 🔍 Advanced: Custom Dashboards

You can create a custom RUM dashboard showing:

### Widget Ideas

1. **Session Count Over Time**
   - Shows user activity patterns

2. **Top User Actions**
   - Which features are used most (voice vs. text)

3. **Error Rate by Action**
   - Are uploads failing? Voice input issues?

4. **Performance by Persona**
   - Compare latency across different document types

5. **Expressive Mode Adoption**
   - How many users toggle expressive mode?

### Creating the Dashboard

```
1. Go to Dashboards > New Dashboard
2. Add widgets using RUM metrics:
   - @type:action
   - @action.name:*
   - @view.url_path:/
3. Group by custom attributes:
   - @context.persona
   - @context.expressiveMode
```

## 📸 Screenshots for Documentation

Capture these for your submission:

1. **Session List View** - Shows multiple user sessions
2. **Session Replay in Action** - Video playback of a voice interaction
3. **RUM-APM Link** - Clicking from replay to trace
4. **Performance Waterfall** - Network requests timeline
5. **Custom Dashboard** - Your RUM metrics dashboard

## 🚀 Pro Tips

- **Tag Everything**: Use custom context to make filtering easier
- **Name Actions Clearly**: Use descriptive names like "Voice Input Toggle" not just "click"
- **Link to Traces**: Always include trace IDs in RUM context
- **Monitor Errors**: Set up error tracking for failed uploads or API calls

## 📝 For Judges

To demonstrate the RUM integration:

1. Visit the deployed app
2. Perform a few interactions (upload, voice query)
3. Go to Datadog RUM Sessions
4. Show the session replay
5. Click through to backend traces
6. Highlight the end-to-end observability

This shows that VoiceDoc Agent treats observability as a **first-class feature**, not an afterthought.
