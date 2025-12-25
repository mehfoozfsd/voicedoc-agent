# Datadog Environment Variables - Complete Reference

## Overview

VoiceDoc Agent uses Datadog for both APM (backend tracing) and RUM (frontend monitoring). Here's what each variable does:

## Required Variables

### 1. API Keys

```bash
# Your Datadog API key - used for sending metrics
DATADOG_API_KEY=your-datadog-api-key

# SAME key, but dd-trace looks for this specific name
DD_API_KEY=your-datadog-api-key
```

**Why both?** 
- `DATADOG_API_KEY` → Used by our custom metrics code (`datadog-metrics.ts`)
- `DD_API_KEY` → Required by the `dd-trace` library for APM

### 2. Site/Region

```bash
# Your Datadog region - must be consistent everywhere
DATADOG_SITE=ap1.datadoghq.com
DD_SITE=ap1.datadoghq.com
NEXT_PUBLIC_DATADOG_SITE=ap1.datadoghq.com
```

**Common values:**
- `datadoghq.com` (US1)
- `us3.datadoghq.com` (US3)
- `us5.datadoghq.com` (US5)
- `datadoghq.eu` (EU)
- `ap1.datadoghq.com` (Asia Pacific)

### 3. APM Trace Endpoint

```bash
# Where to send APM traces (agentless mode)
DD_TRACE_AGENT_URL=https://trace.agent.ap1.datadoghq.com
```

**Region-specific URLs:**
- US1: `https://trace.agent.datadoghq.com`
- US3: `https://trace.agent.us3.datadoghq.com`
- US5: `https://trace.agent.us5.datadoghq.com`
- EU: `https://trace.agent.datadoghq.eu`
- AP1: `https://trace.agent.ap1.datadoghq.com`

### 4. RUM Configuration

```bash
# RUM client token (different from API key!)
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=your-client-token

# RUM application ID
NEXT_PUBLIC_DATADOG_APPLICATION_ID=your-app-id
```

**Where to find these:**
1. Go to Datadog → UX Monitoring → Setup & Configuration
2. Click on your application
3. Copy the Client Token and Application ID

### 5. Service Identification

```bash
DATADOG_SERVICE=voicedoc-agent
DATADOG_ENV=development
```

## Variables You DON'T Need

### ❌ DD_AGENT_HOST and DD_AGENT_PORT

```bash
# DON'T USE THESE (only for local Datadog Agent)
# DD_AGENT_HOST=host.docker.internal
# DD_AGENT_PORT=8125
```

These are only needed if you're running a local Datadog Agent. In agentless mode (which we're using), traces go directly to Datadog's API.

## Complete .env.local Template

```bash
# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=service-account.json
VERTEX_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# ElevenLabs
ELEVENLABS_API_KEY=your-elevenlabs-key

# Datadog - API Keys (use the same key for both)
DATADOG_API_KEY=your-datadog-api-key
DD_API_KEY=your-datadog-api-key

# Datadog - Site/Region (must match everywhere)
DATADOG_SITE=ap1.datadoghq.com
DD_SITE=ap1.datadoghq.com
NEXT_PUBLIC_DATADOG_SITE=ap1.datadoghq.com

# Datadog - APM Trace Endpoint
DD_TRACE_AGENT_URL=https://trace.agent.ap1.datadoghq.com

# Datadog - RUM
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=your-client-token
NEXT_PUBLIC_DATADOG_APPLICATION_ID=your-app-id

# Datadog - Service Info
DATADOG_SERVICE=voicedoc-agent
DATADOG_ENV=development
```

## How to Verify

After setting these variables:

1. **Check they're loaded**:
   ```powershell
   docker exec voicedoc-agent printenv | Select-String "DD_\|DATADOG"
   ```

2. **Look for initialization logs**:
   ```powershell
   docker logs voicedoc-agent | Select-String "Datadog"
   ```

   You should see:
   ```
   [Datadog] Initializing APM tracer...
   [Datadog] APM tracer initialized successfully
   [Datadog] Initializing RUM for site: ap1.datadoghq.com
   ```

3. **Check for traces**:
   - Use the app (upload a document, ask questions)
   - Wait 1-2 minutes
   - Go to **APM → Traces → Explorer**
   - Filter by `service:voicedoc-agent`

## Troubleshooting

### Traces not appearing?

1. **Verify DD_API_KEY is set**:
   ```powershell
   docker exec voicedoc-agent printenv DD_API_KEY
   ```

2. **Check site consistency**:
   All three should match:
   - `DATADOG_SITE`
   - `DD_SITE`
   - `NEXT_PUBLIC_DATADOG_SITE`

3. **Verify trace URL matches your region**:
   If you're on `ap1.datadoghq.com`, use:
   `DD_TRACE_AGENT_URL=https://trace.agent.ap1.datadoghq.com`

### Metrics working but no traces?

This means `DATADOG_API_KEY` is set but `DD_API_KEY` is missing. Add:
```bash
DD_API_KEY=your-datadog-api-key  # Same as DATADOG_API_KEY
```
