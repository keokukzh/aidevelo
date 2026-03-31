$headers = @{
    'Authorization' = 'Bearer rnd_bzIh6ZkBOg1WcKHYEQZe2WJNEeQI'
    'Content-Type' = 'application/json'
}

$apiBody = @{
    name = "aidevelo-api"
    type = "web_service"
    region = "oregon"
    runtime = "node"
    nodeVersion = "20"
    buildCommand = "npm exec -- pnpm@9.15.4 -- build"
    startCommand = "npx tsx server/src/index.ts"
    ownerId = "tea-d36cuoggjchc73c703gg"
    envVars = @(
        @{key = "NODE_ENV"; value = "production"}
        @{key = "PORT"; value = "10000"}
        @{key = "AIDEVELO_MIGRATION_AUTO_APPLY"; value = "true"}
        @{key = "AIDEVELO_MIGRATION_PROMPT"; value = "never"}
        @{key = "AIDEVELO_API_URL"; value = "https://api.aidevelo.ai"}
        @{key = "AIDEVELO_APP_URL"; value = "https://aidevelo.ai"}
    )
} | ConvertTo-Json -Depth 10

Write-Host "Creating aidevelo-api service..."
$createResp = Invoke-WebRequest -Uri 'https://api.render.com/v1/services' -Headers $headers -Method POST -Body $apiBody -UseBasicParsing
Write-Host "Status: $($createResp.StatusCode)"
Write-Host "Content: $($createResp.Content)"
