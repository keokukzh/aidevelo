$headers = @{
    'Authorization' = 'Bearer rnd_bzIh6ZkBOg1WcKHYEQZe2WJNEeQI'
    'Content-Type' = 'application/json'
}

$yamlContent = Get-Content -Path "C:\Users\aidevelo\Desktop\aidevelo\render.yaml" -Raw

$blueprintBody = @{
    spec = $yamlContent
    ownerId = "tea-d36cuoggjchc73c703gg"
} | ConvertTo-Json -Depth 10

Write-Host "Creating Blueprint..."
try {
    $createResp = Invoke-WebRequest -Uri 'https://api.render.com/v1/blueprints' -Headers $headers -Method POST -Body $blueprintBody -TimeoutSec 120 -UseBasicParsing
    Write-Host "Status: $($createResp.StatusCode)"
    Write-Host "Content: $($createResp.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host "Response: $($reader.ReadToEnd())"
    }
}
