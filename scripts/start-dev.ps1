[CmdletBinding()]
param(
  [switch]$OpenBrowser,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot '.run'
$frontendOutLog = Join-Path $runtimeDir 'frontend.out.log'
$frontendErrLog = Join-Path $runtimeDir 'frontend.err.log'
$backendOutLog = Join-Path $runtimeDir 'backend.out.log'
$backendErrLog = Join-Path $runtimeDir 'backend.err.log'
$venvPython = Join-Path $repoRoot 'backend\.venv\Scripts\python.exe'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$frontendProcess = $null
$backendProcess = $null

function Invoke-CommandChecked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [string]$Description
  )

  Write-Host $Description -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "$Description failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Stop-ServiceProcesses {
  param([System.Diagnostics.Process]$Process, [string]$Name)

  if (-not $Process) { return }

  try {
    $proc = Get-Process -Id $Process.Id -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped $Name (PID $($Process.Id))" -ForegroundColor Yellow
    }
  } catch {}
}

function Resolve-BasePython {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    return @{
      FilePath = $py.Source
      Arguments = @('-3')
      Display = 'py -3'
    }
  }

  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) {
    return @{
      FilePath = $python.Source
      Arguments = @()
      Display = 'python'
    }
  }

  throw 'Python not found. Install Python 3.11+ and try again.'
}

function Ensure-FrontendDependencies {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm not found. Install Node.js 20+ first.'
  }

  $nodeModules = Join-Path $repoRoot 'node_modules'
  if ((Test-Path $nodeModules) -or $SkipInstall) { return }

  $lockFile = Join-Path $repoRoot 'package-lock.json'
  if (Test-Path $lockFile) {
    Invoke-CommandChecked -FilePath 'npm' -ArgumentList @('ci') -WorkingDirectory $repoRoot -Description 'Installing frontend dependencies with npm ci...'
  } else {
    Invoke-CommandChecked -FilePath 'npm' -ArgumentList @('install') -WorkingDirectory $repoRoot -Description 'Installing frontend dependencies with npm install...'
  }
}

function Ensure-BackendEnvironment {
  $basePython = Resolve-BasePython

  if (-not (Test-Path $venvPython)) {
    Write-Host "Creating Python virtual environment with $($basePython.Display)..." -ForegroundColor Cyan
    & $basePython.FilePath @($basePython.Arguments + @('-m', 'venv', 'backend/.venv'))
    if ($LASTEXITCODE -ne 0) {
      throw "Creating Python virtual environment failed with exit code $LASTEXITCODE."
    }
  }

  if (-not $SkipInstall) {
    Invoke-CommandChecked `
      -FilePath $venvPython `
      -ArgumentList @('-m', 'pip', 'install', '-r', 'backend/requirements.txt') `
      -WorkingDirectory $repoRoot `
      -Description 'Installing backend dependencies...'
  }

  return @{
    FilePath = $venvPython
    ArgumentList = @('backend/main.py')
  }
}

function Get-ListeningProcessInfo {
  param([int]$Port)

  $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if (-not $conn) { return $null }

  $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue

  [pscustomobject]@{
    Port = $Port
    Pid = $conn.OwningProcess
    Name = if ($process) { $process.ProcessName } else { 'unknown' }
  }
}

try {
  Set-Location $repoRoot
  Ensure-FrontendDependencies
  $pythonCommand = Ensure-BackendEnvironment

  $backendInfo = Get-ListeningProcessInfo -Port 8000
  if ($backendInfo) {
    Write-Host "Backend already running: http://localhost:8000 (PID $($backendInfo.Pid))" -ForegroundColor Yellow
  } else {
    foreach ($logPath in @($backendOutLog, $backendErrLog)) {
      if (Test-Path $logPath) { Remove-Item -LiteralPath $logPath -Force }
    }
    $backendProcess = Start-Process `
      -FilePath $pythonCommand.FilePath `
      -ArgumentList $pythonCommand.ArgumentList `
      -WorkingDirectory $repoRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $backendOutLog `
      -RedirectStandardError $backendErrLog `
      -PassThru
    Write-Host "Started backend: http://localhost:8000 (PID $($backendProcess.Id))" -ForegroundColor Green
  }

  $frontendInfo = Get-ListeningProcessInfo -Port 3000
  if ($frontendInfo) {
    Write-Host "Frontend already running: http://localhost:3000 (PID $($frontendInfo.Pid))" -ForegroundColor Yellow
  } else {
    foreach ($logPath in @($frontendOutLog, $frontendErrLog)) {
      if (Test-Path $logPath) { Remove-Item -LiteralPath $logPath -Force }
    }
    $frontendProcess = Start-Process `
      -FilePath 'cmd.exe' `
      -ArgumentList @('/c', 'npm run dev') `
      -WorkingDirectory $repoRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $frontendOutLog `
      -RedirectStandardError $frontendErrLog `
      -PassThru
    Write-Host "Started frontend: http://localhost:3000 (PID $($frontendProcess.Id))" -ForegroundColor Green
  }

  Write-Host ''
  Write-Host '========================================' -ForegroundColor Cyan
  Write-Host '  FundScope Dev Server' -ForegroundColor Cyan
  Write-Host '========================================' -ForegroundColor Cyan
  Write-Host ''
  Write-Host '  Frontend:  http://localhost:3000' -ForegroundColor White
  Write-Host '  Backend:   http://localhost:8000' -ForegroundColor White
  Write-Host ''
  Write-Host "  Logs: $runtimeDir" -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '  Close this window or press Ctrl+C to stop services started by this script.' -ForegroundColor Yellow
  Write-Host '========================================' -ForegroundColor Cyan

  if ($OpenBrowser) {
    Start-Process 'http://localhost:3000'
  }

  while ($true) {
    Start-Sleep -Milliseconds 500

    if ($backendProcess -and -not (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)) {
      Write-Host 'Backend process exited unexpectedly. Check .run/backend.err.log.' -ForegroundColor Red
      break
    }

    if ($frontendProcess -and -not (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)) {
      Write-Host 'Frontend process exited unexpectedly. Check .run/frontend.err.log.' -ForegroundColor Red
      break
    }
  }
} finally {
  Write-Host ''
  Write-Host 'Shutting down...' -ForegroundColor Yellow
  Stop-ServiceProcesses -Process $backendProcess -Name 'backend'
  Stop-ServiceProcesses -Process $frontendProcess -Name 'frontend'
  Write-Host 'Services started by this script have stopped.' -ForegroundColor Green
}
