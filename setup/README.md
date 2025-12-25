# Setup Files

Configuration files and deployment guides for VoiceDoc Agent.

## Files

- **`cloud-run-deployment.md`** - Guide for deploying to Google Cloud Run
- **`datadog-dashboard.json`** - Datadog dashboard configuration showing metrics (latency, tokens, cost)
- **`datadog-monitors.json`** - Datadog monitors for alerts (high latency, error rates, cost spikes)
- **`firestore-setup.md`** - Firestore database setup and configuration
- **`service-account-permissions.md`** - Required GCP service account permissions

## Quick Start

1. **Import Dashboard**: Copy `datadog-dashboard.json` content and import in Datadog UI
2. **Import Monitors**: Copy monitor objects from `datadog-monitors.json` and create in Datadog UI
3. **Deploy**: Follow `cloud-run-deployment.md` for Cloud Run deployment
4. **Permissions**: Use `service-account-permissions.md` to configure GCP service account
