# Reliable source backup on E:\ — three smaller zips (app, public, git).
# Each part is zipped alone so a failure does not lose the whole archive.
param(
    [string]$OutDir = 'E:\'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$folderName = Split-Path $repoRoot -Leaf
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$lockPath = Join-Path $repoRoot '.cache\temp\backup-split-in-progress.lock'
$logPath = Join-Path $repoRoot '.cache\temp\last-split-backup.log'

function Test-ZipReadable {
    param(
        [Parameter(Mandatory)][string]$Path,
        [int]$MinFiles = 50
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        return @{ Ok = $false; Reason = 'File missing' }
    }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -lt 10KB) {
        return @{ Ok = $false; Reason = "Too small ($($item.Length) bytes)" }
    }
    $list = & tar -tf $Path 2>&1
    if ($LASTEXITCODE -ne 0) {
        return @{ Ok = $false; Reason = "tar -tf failed (exit $LASTEXITCODE)" }
    }
    $fileCount = ($list | Measure-Object -Line).Lines
    if ($fileCount -lt $MinFiles) {
        return @{ Ok = $false; Reason = "Too few entries ($fileCount; need $MinFiles)" }
    }
    return @{ Ok = $true; FileCount = $fileCount; SizeBytes = $item.Length }
}

function Write-SplitZip {
    param(
        [string]$Label,
        [string[]]$RelativePaths,
        [string]$ZipPath,
        [int]$MinFiles = 50
    )
    $partPath = "$ZipPath.part"
    if (Test-Path -LiteralPath $partPath) { Remove-Item -LiteralPath $partPath -Force }
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    $existing = @()
    foreach ($rel in $RelativePaths) {
        $full = Join-Path $repoRoot $rel
        if (Test-Path -LiteralPath $full) { $existing += $rel }
    }
    if ($existing.Count -eq 0) {
        throw "$Label - nothing to zip (paths missing)"
    }

    Write-Host ""
    Write-Host "=== $Label ==="
    Write-Host "Creating $ZipPath ..."
    Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format 'HH:mm:ss') START $Label -> $ZipPath"

    Push-Location $repoRoot
    try {
        & tar -a -c -f $partPath @existing
        if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE) for $Label" }
    }
    finally {
        Pop-Location
    }

    $check = Test-ZipReadable -Path $partPath -MinFiles $MinFiles
    if (-not $check.Ok) {
        throw "$Label verification failed: $($check.Reason). Partial: $partPath"
    }
    Move-Item -LiteralPath $partPath -Destination $ZipPath -Force

    $sizeMb = [math]::Round($check.SizeBytes / 1MB, 2)
    Write-Host "Saved: $ZipPath"
    Write-Host "Files: $($check.FileCount) | Size: $sizeMb MB"
    Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format 'HH:mm:ss') OK $Label files=$($check.FileCount) sizeMB=$sizeMb"

    return @{
        Label     = $Label
        ZipPath   = $ZipPath
        FileCount = $check.FileCount
        SizeBytes = $check.SizeBytes
        SizeMb    = $sizeMb
    }
}

if (-not (Test-Path (Split-Path $lockPath -Parent))) {
    New-Item -ItemType Directory -Path (Split-Path $lockPath -Parent) -Force | Out-Null
}
if (Test-Path -LiteralPath $lockPath) {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime
    if ($lockAge.TotalHours -lt 6) { Remove-Item -LiteralPath $lockPath -Force }
}

"started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') split -> $OutDir" | Set-Content -LiteralPath $lockPath -Encoding UTF8
"Split backup log $stamp" | Set-Content -LiteralPath $logPath -Encoding UTF8

$rootFiles = @(
    'package.json', 'bun.lockb', 'bun.lock', 'bunfig.toml', 'vite.config.ts',
    'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'index.html',
    '.gitignore', 'Da-Music-Box-v4.code-workspace', 'README.md', 'eslint.config.js',
    'main.tsx', 'vite-env.d.ts', 'netlify.toml'
)
$appPaths = @('app', 'scripts', '.cursor/rules') + ($rootFiles | Where-Object { Test-Path (Join-Path $repoRoot $_) })

$results = @()
try {
    $results += Write-SplitZip -Label 'APP SOURCE' -RelativePaths $appPaths `
        -ZipPath (Join-Path $OutDir "${folderName}-APP-SOURCE_$stamp.zip") -MinFiles 400

    $results += Write-SplitZip -Label 'PUBLIC ASSETS' -RelativePaths @('public') `
        -ZipPath (Join-Path $OutDir "${folderName}-PUBLIC_$stamp.zip") -MinFiles 10

    if (Test-Path (Join-Path $repoRoot '.git')) {
        $results += Write-SplitZip -Label 'GIT HISTORY' -RelativePaths @('.git') `
            -ZipPath (Join-Path $OutDir "${folderName}-GIT_$stamp.zip") -MinFiles 500
    }
}
finally {
    if (Test-Path -LiteralPath $lockPath) { Remove-Item -LiteralPath $lockPath -Force }
}

$manifest = @(
    'SOURCE BACKUP COMPLETE - ALL PARTS VERIFIED'
    '==========================================='
    ''
    "Timestamp: $stamp"
    "Source: $repoRoot"
    ''
)
foreach ($r in $results) {
    $manifest += "$($r.Label): $($r.ZipPath)"
    $manifest += "  Files: $($r.FileCount) | Size: $($r.SizeMb) MB"
    $manifest += ''
}
$manifest += 'Restore: unzip all three parts into the same folder, then run: bun install'
$manifest += 'Skipped: node_modules, dist, .cache, .vite-cache, .cursor/workspace-data'

$manifest | Set-Content -LiteralPath (Join-Path $repoRoot 'pack-result.txt') -Encoding UTF8
$manifest | Set-Content -LiteralPath (Join-Path $repoRoot "SAVE-STAMP-SPLIT-$stamp.txt") -Encoding UTF8
try {
    $manifest | Set-Content -LiteralPath "E:\SAVE-STAMP-SPLIT-$stamp.txt" -Encoding UTF8
} catch {
    Write-Warning "Could not write E:\SAVE-STAMP-SPLIT-$stamp.txt"
}

Write-Host ""
Write-Host 'SOURCE BACKUP COMPLETE - ALL PARTS VERIFIED'
foreach ($r in $results) {
    Write-Host "  $($r.Label): $($r.ZipPath) ($($r.SizeMb) MB)"
}

return $results
