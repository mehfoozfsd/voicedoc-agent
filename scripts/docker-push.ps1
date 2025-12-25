# Build and push script for Docker Hub

$IMAGE_NAME = "voicedoc-agent"
$DOCKER_USER = "seehiong"
$FULL_IMAGE_NAME = "$DOCKER_USER/$IMAGE_NAME"

# Read VERTEX_PROJECT_ID from .env.local
$ENV_FILE = ".env.local"
if (Test-Path $ENV_FILE) {
    Write-Host "📄 Reading environment variables from $ENV_FILE..." -ForegroundColor Cyan
    $VERTEX_PROJECT_ID = (Get-Content $ENV_FILE | Select-String -Pattern "^VERTEX_PROJECT_ID=(.+)$").Matches.Groups[1].Value
    $GOOGLE_CLOUD_LOCATION = (Get-Content $ENV_FILE | Select-String -Pattern "^GOOGLE_CLOUD_LOCATION=(.+)$").Matches.Groups[1].Value
    
    if (-not $GOOGLE_CLOUD_LOCATION) {
        $GOOGLE_CLOUD_LOCATION = "us-central1"
    }
}
else {
    Write-Host "⚠️  .env.local not found. Please provide VERTEX_PROJECT_ID:" -ForegroundColor Yellow
    $VERTEX_PROJECT_ID = Read-Host "VERTEX_PROJECT_ID"
    $GOOGLE_CLOUD_LOCATION = Read-Host "GOOGLE_CLOUD_LOCATION (default: us-central1)"
    if (-not $GOOGLE_CLOUD_LOCATION) {
        $GOOGLE_CLOUD_LOCATION = "us-central1"
    }
}

Write-Host "🚀 Building Docker image: $FULL_IMAGE_NAME..." -ForegroundColor Cyan
Write-Host "   Using VERTEX_PROJECT_ID: $VERTEX_PROJECT_ID" -ForegroundColor Gray
Write-Host "   Using GOOGLE_CLOUD_LOCATION: $GOOGLE_CLOUD_LOCATION" -ForegroundColor Gray

docker build `
    --build-arg VERTEX_PROJECT_ID=$VERTEX_PROJECT_ID `
    --build-arg GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION `
    -t $FULL_IMAGE_NAME .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful. Pushing to Docker Hub..." -ForegroundColor Green
    docker push $FULL_IMAGE_NAME
    Write-Host "🏁 Finished! Image is now available at https://hub.docker.com/r/$FULL_IMAGE_NAME" -ForegroundColor Magenta
}
else {
    Write-Host "❌ Build failed. Please check the logs." -ForegroundColor Red
    exit 1
}
