# Docker run script with service account mounting

$SERVICE_ACCOUNT_FILE = "service-account-voicedoc-agent.json"
$CONTAINER_NAME = "voicedoc-agent"
$IMAGE_NAME = "seehiong/voicedoc-agent"
$PORT = 3000

# Check if service account file exists
if (-not (Test-Path $SERVICE_ACCOUNT_FILE)) {
    Write-Host "❌ Service account file not found: $SERVICE_ACCOUNT_FILE" -ForegroundColor Red
    Write-Host "   Please ensure the file exists in the current directory." -ForegroundColor Yellow
    exit 1
}

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local not found. Make sure environment variables are set." -ForegroundColor Yellow
}

# Stop and remove existing container if it exists
Write-Host "🧹 Cleaning up existing container..." -ForegroundColor Cyan
docker stop $CONTAINER_NAME 2>$null
docker rm $CONTAINER_NAME 2>$null

# Get absolute path for volume mounting
$ABSOLUTE_PATH = (Resolve-Path $SERVICE_ACCOUNT_FILE).Path

Write-Host "🚀 Starting Docker container..." -ForegroundColor Cyan
Write-Host "   Container: $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "   Image: $IMAGE_NAME" -ForegroundColor Gray
Write-Host "   Port: $PORT" -ForegroundColor Gray
Write-Host "   Service Account: $ABSOLUTE_PATH" -ForegroundColor Gray

docker run -d -p ${PORT}:3000 --name $CONTAINER_NAME `
    --env-file .env.local `
    -v "${ABSOLUTE_PATH}:/app/service-account.json" `
    -e GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json `
    $IMAGE_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host "🌐 Application available at: http://localhost:$PORT" -ForegroundColor Magenta
    Write-Host "" 
    Write-Host "📋 Useful commands:" -ForegroundColor Cyan
    Write-Host "   View logs:    docker logs $CONTAINER_NAME -f" -ForegroundColor Gray
    Write-Host "   Stop:         docker stop $CONTAINER_NAME" -ForegroundColor Gray
    Write-Host "   Remove:       docker rm $CONTAINER_NAME" -ForegroundColor Gray
}
else {
    Write-Host "❌ Failed to start container" -ForegroundColor Red
    exit 1
}
