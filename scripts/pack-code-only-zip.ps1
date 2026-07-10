# Code-only backup: app + scripts + config. Skips node_modules, .git, caches, Cursor locks.
param(
    [string]$OutDir = 'E:\'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$folderName = Split-Path $repoRoot -Leaf
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$zipPath = Join-Path $OutDir "${folderName}-CODE_$stamp.zip"
$partPath = "$zipPath.part"
$lockPath = Join-Path $repoRoot '.cache\temp\backup-in-progress.lock'

function Test-CodeZipComplete {
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -lt 50KB) { return @{ Ok = $false; Reason = "Zip too small ($($item.Length) bytes)" } }
    $list = & tar -tf $Path 2>&1
    if ($LASTEXITCODE -ne 0) { return @{ Ok = $false; Reason = "tar -tf failed (exit $LASTEXITCODE)" } }
    $fileCount = ($list | Measure-Object -Line).Lines
    if ($fileCount -lt 200) { return @{ Ok = $false; Reason = "Too few files ($fileCount)" } }
    $fs = [System.IO.File]::OpenRead($Path)
    $readLen = [Math]::Min(65536L, $fs.Length)
    $buf = New-Object byte[] $readLen
    $fs.Seek($fs.Length - $readLen, [System.IO.SeekOrigin]::Begin) | Out-Null
    $null = $fs.Read($buf, 0, [int]$readLen)
    $fs.Close()
    for ($i = $buf.Length - 4; $i -ge 0; $i--) {
        if ($buf[$i] -eq 0x50 -and $buf[$i + 1] -eq 0x4B -and $buf[$i + 2] -eq 0x05 -and $buf[$i + 3] -eq 0x06) {
            return @{ Ok = $true; FileCount = $fileCount; SizeBytes = $item.Length }
        }
    }
    return @{ Ok = $false; Reason = 'Missing zip end record (incomplete)' }
}

if (-not (Test-Path (Split-Path $lockPath -Parent))) {
    New-Item -ItemType Directory -Path (Split-Path $lockPath -Parent) -Force | Out-Null
}
if (Test-Path -LiteralPath $lockPath) {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime
    if ($lockAge.TotalHours -lt 6) { Remove-Item -LiteralPath $lockPath -Force }
}

if (Test-Path -LiteralPath $partPath) { Remove-Item -LiteralPath $partPath -Force }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

"started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') code-only -> $zipPath" | Set-Content -LiteralPath $lockPath -Encoding UTF8

$includePaths = @('app', 'scripts', 'public', '.cursor/rules')
$rootFiles = @(
    'package.json', 'bun.lockb', 'bun.lock', 'vite.config.ts', 'tsconfig.json',
    'tsconfig.app.json', 'tsconfig.node.json', 'index.html', '.gitignore',
    'Da-Music-Box-v4.code-workspace'
)
foreach ($f in $rootFiles) {
    if (Test-Path -LiteralPath (Join-Path $repoRoot $f)) { $includePaths += $f }
}

try {
    Push-Location $repoRoot
    & tar -a -c -f $partPath @includePaths
    if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
    Pop-Location

    $check = Test-CodeZipComplete -Path $partPath
    if (-not $check.Ok) {
        throw "Code backup verification failed: $($check.Reason). Partial: $partPath"
    }
    Move-Item -LiteralPath $partPath -Destination $zipPath
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $lockPath) { Remove-Item -LiteralPath $lockPath -Force }
}

$verified = Test-CodeZipComplete -Path $zipPath
$fileCount = $verified.FileCount
$zipSize = $verified.SizeBytes
$sizeMb = [math]::Round($zipSize / 1MB, 2)

Write-Host "Saved: $zipPath"
Write-Host "Files: $fileCount | Size: $sizeMb MB"
Write-Host "Included: app, scripts, public, .cursor/rules, config"
Write-Host "Skipped: node_modules, dist, .cache, .vite-cache, .git, .cursor/workspace-data"

$stampBody = @(
    "Saved: $zipPath"
    "Files: $fileCount | Size: $sizeMb MB"
    "Timestamp: $stamp"
    "Type: CODE-ONLY backup"
    "Source: $repoRoot"
    "Included: app, scripts, public, .cursor/rules, root config"
    "Skipped: node_modules, dist, .cache, .vite-cache, .git, .cursor/workspace-data"
)
$stampBody | Set-Content -LiteralPath (Join-Path $repoRoot "SAVE-STAMP-CODE-$stamp.txt") -Encoding UTF8
$stampBody | Set-Content -LiteralPath "E:\SAVE-STAMP-CODE-$stamp.txt" -Encoding UTF8

@(
    "BACKUP COMPLETE - CODE ONLY - READY TO USE"
    "=========================================="
    ""
    "Zip: $zipPath"
    "Files: $fileCount"
    "Size: $sizeMb MB"
    "Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    ""
    "Rebuild after restore: bun install"
) | Set-Content -LiteralPath (Join-Path $repoRoot 'pack-result.txt') -Encoding UTF8

return @{ ZipPath = $zipPath; SizeBytes = $zipSize; FileCount = $fileCount }
