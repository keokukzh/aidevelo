# START_AIDEVELO.ps1 - One-click AIDEVELO startup script
# Run from project root: .\START_AIDEVELO.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\aidevelo\Desktop\aidevelo"
$ServerPort = 3100
$UIPort = 5173
$PostgresPort = 54329

function Get-ProcessOnPort {
    param([int]$Port)
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 }
}

function Kill-ProcessOnPort {
    param([int]$Port, [string]$Name)
    $conns = Get-ProcessOnPort $Port
    if ($conns) {
        foreach ($conn in $conns) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Killing $($proc.ProcessName) (PID: $($conn.OwningProcess)) on port $Port" -ForegroundColor Red
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Host "  Port $Port is free" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AIDEVELO Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# Step 1: Kill all processes on all ports
# ============================================================
Write-Host "[1/6] Killing processes on ports $ServerPort, $UIPort, $PostgresPort..." -ForegroundColor Yellow

foreach ($port in @($ServerPort, $UIPort, $PostgresPort)) {
    Kill-ProcessOnPort $port
}

# ============================================================
# Step 2: Kill orphaned node/tsx/vite processes
# ============================================================
Write-Host ""
Write-Host "[2/6] Killing orphaned node/tsx/vite processes..." -ForegroundColor Yellow

$orphanNames = @("node.exe", "tsx.exe", "vite")
$allProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $cmd = $_.CommandLine
    $cmd -and ($cmd -like "*tsx*" -or $cmd -like "*aidevelo*" -or $cmd -like "*vite*")
}
foreach ($proc in $allProcs) {
    Write-Host "  Killing orphaned PID: $($proc.ProcessId) - $($proc.CommandLine.Split(' ')[0])" -ForegroundColor Red
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

# ============================================================
# Step 3: Clear Vite cache
# ============================================================
Write-Host ""
Write-Host "[3/6] Clearing Vite cache..." -ForegroundColor Yellow

$viteCache = "$ProjectRoot\ui\node_modules\.vite"
if (Test-Path $viteCache) {
    Remove-Item -Path $viteCache -Recurse -Force
    Write-Host "  Cleared $viteCache" -ForegroundColor Green
} else {
    Write-Host "  No Vite cache found" -ForegroundColor DarkGray
}

# ============================================================
# Step 4: Wait for all ports to be released
# ============================================================
Write-Host ""
Write-Host "[4/6] Waiting for ports to be released..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

$stillInUse = @()
foreach ($port in @($ServerPort, $UIPort, $PostgresPort)) {
    if (Get-ProcessOnPort $port) {
        $stillInUse += $port
    }
}
if ($stillInUse.Count -gt 0) {
    Write-Host "  WARNING: Ports still in use: $($stillInUse -join ', ') — waiting longer..." -ForegroundColor Red
    Start-Sleep -Seconds 5
}

# ============================================================
# Step 5: Start server and UI in separate windows
# ============================================================
Write-Host ""
Write-Host "[5/6] Starting AIDEVELO server and UI..." -ForegroundColor Yellow
Write-Host ""

$serverDir = "$ProjectRoot\server"
$uiDir = "$ProjectRoot\ui"

# Start server in its own console window
Start-Process -FilePath "cmd.exe" -ArgumentList "/k","title AIDEVELO-SERVER && cd /d `"$serverDir`" && npm exec -- tsx src/index.ts"

# Start Vite UI in its own console window
Start-Process -FilePath "cmd.exe" -ArgumentList "/k","title AIDEVELO-UI && cd /d `"$uiDir`" && npm exec -- vite --host 127.0.0.1 --port 5173"

# ============================================================
# Step 6: Poll until both services are ready
# ============================================================
Write-Host ""
Write-Host "[6/6] Waiting for services to be ready..." -ForegroundColor Yellow
Write-Host ""

$maxAttempts = 20
$attempt = 0
$serverReady = $false
$uiReady = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++

    # Check server
    if (-not $serverReady) {
        try {
            $health = Invoke-WebRequest -Uri "http://localhost:$ServerPort/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($health.StatusCode -eq 200) {
                $serverReady = $true
                Write-Host "  Server (port $ServerPort) READY" -ForegroundColor Green
            }
        } catch { }
    }

    # Check Vite UI
    if (-not $uiReady) {
        try {
            $viteCheck = Invoke-WebRequest -Uri "http://localhost:$UIPort" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($viteCheck.StatusCode -eq 200) {
                $uiReady = $true
                Write-Host "  Vite UI (port $UIPort) READY" -ForegroundColor Green
            }
        } catch { }
    }

    if ($serverReady -and $uiReady) { break }

    Write-Host "  Waiting... (attempt $attempt/$maxAttempts)" -ForegroundColor DarkGray
}

Write-Host ""
if ($serverReady -and $uiReady) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  AIDEVELO is RUNNING!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Full App:  http://localhost:$UIPort" -ForegroundColor Cyan
    Write-Host "  API:       http://localhost:$ServerPort/api" -ForegroundColor Cyan
    Write-Host "  Health:    http://localhost:$ServerPort/api/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Server logs:  close the 'AIDEVELO-SERVER' console window" -ForegroundColor DarkGray
    Write-Host "  UI logs:      close the 'AIDEVELO-UI' console window" -ForegroundColor DarkGray
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  STARTUP ISSUES DETECTED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    if (-not $serverReady) { Write-Host "  Server not ready on port $ServerPort" -ForegroundColor Yellow }
    if (-not $uiReady) { Write-Host "  UI not ready on port $UIPort" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "  Check the 'AIDEVELO-SERVER' and 'AIDEVELO-UI' console windows for errors." -ForegroundColor Cyan
    Write-Host ""
}
