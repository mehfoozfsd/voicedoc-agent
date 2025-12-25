# Deploying to Google Cloud Run

This guide walks through deploying VoiceDoc Agent to Cloud Run with full Datadog observability (RUM + Metrics).

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Docker image** pushed to Docker Hub (`seehiong/voicedoc-agent`)
3. **Datadog account** with API key and RUM configured
4. **Service account** with required permissions

## Step 1: Prepare Environment Variables

Create a file `cloud-run-env.yaml` with your environment variables:

```yaml
VERTEX_PROJECT_ID: "voicedoc-agent"
GOOGLE_CLOUD_LOCATION: "us-central1"
ELEVENLABS_API_KEY: "your-elevenlabs-key"

# Datadog - Metrics
DATADOG_API_KEY: "your-datadog-api-key"
DATADOG_SITE: "ap1.datadoghq.com"
DATADOG_SERVICE: "voicedoc-agent"
DATADOG_ENV: "production"

# Datadog - APM (optional, won't work without agent but Cloud Run may support it)
DD_API_KEY: "your-datadog-api-key"
DD_SITE: "ap1.datadoghq.com"
DD_TRACE_AGENT_URL: "https://trace.agent.ap1.datadoghq.com"

# Datadog - RUM (public, safe to expose)
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN: "your-client-token"
NEXT_PUBLIC_DATADOG_APPLICATION_ID: "your-app-id"
NEXT_PUBLIC_DATADOG_SITE: "ap1.datadoghq.com"

# Browser RUM Configuration
NEXT_PUBLIC_DATADOG_ENV: "development"
NEXT_PUBLIC_DATADOG_SERVICE: "voicedoc-agent"
```

## Step 2: Deploy to Cloud Run

### Using gcloud CLI

```powershell
gcloud run deploy voicedoc-agent `
  --image docker.io/seehiong/voicedoc-agent:latest `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --env-vars-file cloud-run-env.yaml `
  --memory 1Gi `
  --cpu 1 `
  --timeout 300 `
  --max-instances 10 `
  --service-account voicedoc-agent@voicedoc-agent.iam.gserviceaccount.com
```

## Step 3: Test the Deployment

1. **Get the URL**:
   ```powershell
   gcloud run services describe voicedoc-agent `
     --region us-central1 `
     --format 'value(status.url)'
   ```

2. **Open in browser** and test:
   - Upload a document
   - Ask a few questions
   - Toggle expressive mode

3. **Check Datadog**:
   - **RUM**: Digital Experience → Real User Monitoring → Sessions
   - **Metrics**: Metrics → Explorer → Search for `voicedoc.*`

## Step 4: Verify Observability

### RUM (Should Work Immediately)

1. Go to **Digital Experience → Real User Monitoring → Sessions**
2. Filter by `@application.name:voicedoc-agent`
3. Click on a session to see Session Replay

### Metrics (Should Work Immediately)

1. Go to **Metrics → Explorer**
2. Search for `voicedoc.request.latency_ms`
3. Group by `voice_mode` to compare standard vs expressive

### APM Traces (May Not Work Without Agent)

APM traces likely won't appear without a Datadog Agent. For Cloud Run, you can:
- Focus on RUM + Metrics (already very impressive!)
- Or explore [Datadog Serverless Monitoring](https://docs.datadoghq.com/serverless/google_cloud_run/) for full APM

## Monitoring & Scaling

### View Logs

```powershell
gcloud run services logs read voicedoc-agent `
  --region us-central1 `
  --limit 50
```

### Update Service

After rebuilding your Docker image:

```powershell
gcloud run services update voicedoc-agent `
  --region us-central1 `
  --image docker.io/seehiong/voicedoc-agent:latest
```

### Auto-scaling Configuration

Cloud Run auto-scales based on traffic. Configure limits:

```powershell
gcloud run services update voicedoc-agent `
  --region us-central1 `
  --min-instances 0 `
  --max-instances 10 `
  --concurrency 80
```

## Cost Optimization

- **Min instances**: Set to 0 to scale to zero when idle
- **Memory**: 1 GiB is sufficient for most workloads
- **CPU**: 1 CPU handles moderate traffic well
- **Timeout**: 300s for long-running voice interactions
