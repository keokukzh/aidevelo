# START_AIDEVELO.ps1 - One-click AIDEVELO startup script
# Run from project root: .\START_AIDEVELO.ps1

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = "C:\Users\aidevelo\Desktop\aidevelo"
$ServerPort = 3100
$PostgresPort = 54329

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AIDEVELO Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill processes on ports
Write-Host "[1/4] Checking for processes on ports $ServerPort, $PostgresPort..." -ForegroundColor Yellow

$ports = @($ServerPort, $PostgresPort)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Killing $($process.ProcessName) (PID: $($conn.OwningProcess)) on port $port" -ForegroundColor Red
                Stop-Process -Id $conn.OwningProcess -Force
            }
        }
    } else {
        Write-Host "  Port $port is free" -ForegroundColor Green
    }
}

# Step 2: Kill any orphaned node/tsx processes for this project
Write-Host ""
Write-Host "[2/4] Checking for orphaned node processes..." -ForegroundColor Yellow
$orphanProcesses = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $cmd = $_.CommandLine
    $cmd -and ($cmd -like "*tsx*" -or $cmd -like "*aidevelo*")
}
foreach ($proc in $orphanProcesses) {
    Write-Host "  Killing orphaned node process PID: $($proc.ProcessId)" -ForegroundColor Red
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

# Step 3: Wait for ports to be released
Write-Host ""
Write-Host "[3/4] Waiting for ports to be released..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Verify ports are free
$portsInUse = Get-NetTCPConnection -LocalPort $ServerPort,$PostgresPort -ErrorAction SilentlyContinue
if ($portsInUse) {
    Write-Host "  WARNING: Ports still in use, waiting longer..." -ForegroundColor Red
    Start-Sleep -Seconds 5
}

# Step 4: Start the server
Write-Host ""
Write-Host "[4/4] Starting AIDEVELO server on port $ServerPort..." -ForegroundColor Yellow
Write-Host ""

$serverDir = "$ProjectRoot\server"

# Start in background using cmd.exe with semicolon (PowerShell compatible)
$serverProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","cd /d `"$serverDir`" && npm exec -- tsx src/index.ts" -WorkingDirectory $serverDir -NoNewWindow -PassThru -WindowStyle Hidden

# Wait for server to start
Write-Host "  Server starting (PID: $($serverProcess.Id))..." -ForegroundColor Cyan

# Poll health endpoint until ready or timeout
$maxAttempts = 15
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++

    $healthCheck = try {
        Invoke-WebRequest -Uri "http://localhost:$ServerPort/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    } catch {
        $null
    }

    if ($healthCheck -and $healthCheck.StatusCode -eq 200) {
        $serverReady = $true
        break
    }

    Write-Host "  Waiting for server... (attempt $attempt/$maxAttempts)" -ForegroundColor DarkGray
}

if ($serverReady) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  AIDEVELO is RUNNING!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Dashboard: http://localhost:$ServerPort" -ForegroundColor Cyan
    Write-Host "  API:       http://localhost:$ServerPort/api" -ForegroundColor Cyan
    Write-Host "  Health:    http://localhost:$ServerPort/api/health" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  SERVER STARTUP FAILED!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Could not connect to http://localhost:$ServerPort/api/health" -ForegroundColor Yellow
    Write-Host "  Please check server logs for errors." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
