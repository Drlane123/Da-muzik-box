# Pack Da Music Box source to E:\ - tar direct (no staging copy; saves disk space).
param(
    [string]$OutDir = 'E:\',
    [switch]$SkipMirror
)

$ErrorActionPreference = 'Stop'

function Test-ZipArchiveComplete {
    param(
        [Parameter(Mandatory)][string]$Path,
        [int]$MinFileCount = 4000
    )
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -lt 100KB) { return @{ Ok = $false; Reason = "Zip too small ($($item.Length) bytes)" } }

    $list = & tar -tf $Path 2>&1
    if ($LASTEXITCODE -ne 0) {
        return @{ Ok = $false; Reason = "tar -tf failed (exit $LASTEXITCODE)" }
    }
    $fileCount = ($list | Measure-Object -Line).Lines
    if ($fileCount -lt $MinFileCount) {
        return @{ Ok = $false; Reason = "Too few files ($fileCount; need at least $MinFileCount)" }
    }

    $fs = [System.IO.File]::OpenRead($Path)
    $readLen = [Math]::Min(65536L, $fs.Length)
    $buf = New-Object byte[] $readLen
    $fs.Seek($fs.Length - $readLen, [System.IO.SeekOrigin]::Begin) | Out-Null
    $null = $fs.Read($buf, 0, [int]$readLen)
    $fs.Close()
    $hasEocd = $false
    for ($i = $buf.Length - 4; $i -ge 0; $i--) {
        if ($buf[$i] -eq 0x50 -and $buf[$i + 1] -eq 0x4B -and $buf[$i + 2] -eq 0x05 -and $buf[$i + 3] -eq 0x06) {
            $hasEocd = $true
            break
        }
        # Zip64 end-of-central-directory (large archives)
        if ($buf[$i] -eq 0x50 -and $buf[$i + 1] -eq 0x4B -and $buf[$i + 2] -eq 0x06 -and $buf[$i + 3] -eq 0x06) {
            $hasEocd = $true
            break
        }
    }
    if (-not $hasEocd) {
        return @{ Ok = $false; Reason = 'Missing zip end record (archive incomplete - Windows will say invalid)' }
    }

    return @{ Ok = $true; FileCount = $fileCount; SizeBytes = $item.Length }
}

$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$folderName = Split-Path $repoRoot -Leaf
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$zipPath = Join-Path $OutDir "${folderName}_$stamp.zip"
$partPath = "$zipPath.part"
$lockPath = Join-Path $repoRoot '.cache\temp\backup-in-progress.lock'

if (-not (Test-Path (Split-Path $lockPath -Parent))) {
    New-Item -ItemType Directory -Path (Split-Path $lockPath -Parent) -Force | Out-Null
}

if (Test-Path -LiteralPath $lockPath) {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime
    if ($lockAge.TotalHours -lt 6) {
        throw "Backup already running (lock: $lockPath). Wait for it to finish. Do not start another copy."
    }
    Remove-Item -LiteralPath $lockPath -Force
}

if (Test-Path -LiteralPath $zipPath) {
    $existing = Get-Item -LiteralPath $zipPath
    if ($existing.Length -gt 100KB) {
        Write-Host "Backup already exists for this minute: $zipPath"
        Write-Host "Files/size: run scripts\verify-backup-on-e.ps1"
        return @{
            ZipPath   = $zipPath
            SizeBytes = $existing.Length
            FileCount = $null
            Skipped   = $true
        }
    }
    Remove-Item -LiteralPath $zipPath -Force
}

if (Test-Path -LiteralPath $partPath) {
    $partAge = (Get-Date) - (Get-Item -LiteralPath $partPath).LastWriteTime
    if ($partAge.TotalHours -lt 6) {
        throw "Partial backup in progress: $partPath ($([math]::Round((Get-Item -LiteralPath $partPath).Length/1MB,2)) MB so far). Wait or delete .part file manually."
    }
    Remove-Item -LiteralPath $partPath -Force
}

"started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -> $zipPath" | Set-Content -LiteralPath $lockPath -Encoding UTF8

$minFileCount = 4000
$countScript = Join-Path $repoRoot '.cache\temp\expected-backup-count.txt'
if (Test-Path -LiteralPath $countScript) {
    $countLine = Get-Content -LiteralPath $countScript -Raw
    if ($countLine -match '(\d+)') {
        $expected = [int]$Matches[1]
        $minFileCount = [Math]::Max(4000, [int]([math]::Floor($expected * 0.90)))
    }
}

# Stage on E: first - copy only source paths (skip Cursor workspace-data junction).
$stageRoot = Join-Path $repoRoot '.cache\temp\backup-staging'
$stageDir = Join-Path $stageRoot $stamp
$tarLog = Join-Path $repoRoot '.cache\temp\last-backup-tar.log'

function Invoke-BackupRobocopy {
    param([string]$Source, [string]$Dest)
    $null = robocopy $Source $Dest /E /R:1 /W:1 /NFL /NDL /NP
    return $LASTEXITCODE
}

try {
    if (Test-Path -LiteralPath $stageDir) { Remove-Item -LiteralPath $stageDir -Recurse -Force }
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    Write-Host 'Staging source folders (app, scripts, public, .git)...'
    $robWorst = 0
    foreach ($dir in @('app', 'scripts', 'public', '.git')) {
        $src = Join-Path $repoRoot $dir
        if (-not (Test-Path -LiteralPath $src)) { continue }
        $dst = Join-Path $stageDir $dir
        New-Item -ItemType Directory -Path $dst -Force | Out-Null
        $exit = Invoke-BackupRobocopy -Source $src -Dest $dst
        if ($exit -ge 8) { $robWorst = [Math]::Max($robWorst, $exit) }
    }

    $rootFiles = @(
        'package.json', 'bun.lockb', 'bun.lock', 'bunfig.toml', 'vite.config.ts',
        'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'index.html',
        '.gitignore', 'Da-Music-Box-v4.code-workspace', 'README.md', 'eslint.config.js'
    )
    foreach ($f in $rootFiles) {
        $src = Join-Path $repoRoot $f
        if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $stageDir $f) -Force }
    }

    $rulesSrc = Join-Path $repoRoot '.cursor\rules'
    if (Test-Path -LiteralPath $rulesSrc) {
        $rulesDst = Join-Path $stageDir '.cursor\rules'
        New-Item -ItemType Directory -Path (Split-Path $rulesDst -Parent) -Force | Out-Null
        $exit = Invoke-BackupRobocopy -Source $rulesSrc -Dest $rulesDst
        if ($exit -ge 8) { $robWorst = [Math]::Max($robWorst, $exit) }
    }

    if ($robWorst -ge 8) { throw "Staging robocopy failed (worst exit $robWorst). Log: $tarLog" }

    $stagedFiles = (Get-ChildItem -LiteralPath $stageDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($stagedFiles -lt 500) { throw "Staging too small ($stagedFiles files) - aborting." }
    $minFileCount = [Math]::Max(4000, [int]([math]::Floor($stagedFiles * 0.90)))
    Write-Host "Staged $stagedFiles files -> $stageDir"

    Write-Host 'Creating zip on E:\ (from staging)...'
    & tar -a -c -f $partPath -C $stageDir . 2>&1 | Tee-Object -FilePath $tarLog
    if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE). Log: $tarLog" }

    $check = Test-ZipArchiveComplete -Path $partPath -MinFileCount $minFileCount
    if (-not $check.Ok) {
        throw "Backup verification failed: $($check.Reason). Partial kept at $partPath - run again after fixing (do not use as backup)."
    }

    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Move-Item -LiteralPath $partPath -Destination $zipPath
}
finally {
    if (Test-Path -LiteralPath $lockPath) { Remove-Item -LiteralPath $lockPath -Force }
    if (Test-Path -LiteralPath $stageDir) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$zipSize = (Get-Item -LiteralPath $zipPath).Length
if ($zipSize -lt 100KB) { throw "Zip too small ($zipSize bytes)." }

$verified = Test-ZipArchiveComplete -Path $zipPath
if (-not $verified.Ok) { throw "Final zip failed verification: $($verified.Reason)" }
$fileCount = $verified.FileCount
$sizeMb = [math]::Round($zipSize / 1MB, 2)

Write-Host "Saved: $zipPath"
Write-Host "Files: $fileCount | Size: $sizeMb MB"
Write-Host "Timestamp: $stamp"

$stampBody = @(
    "Saved: $zipPath"
    "Files: $fileCount | Size: $sizeMb MB"
    "Timestamp: $stamp"
    "Source: $repoRoot"
    "Skipped: node_modules, dist, .cache, .vite-cache, .cursor/workspace-data, *.zip"
)

$stampBody | Set-Content -LiteralPath (Join-Path $repoRoot "SAVE-STAMP-$stamp.txt") -Encoding UTF8
if (Test-Path 'E:\') {
    $stampBody | Set-Content -LiteralPath "E:\SAVE-STAMP-$stamp.txt" -Encoding UTF8
    @(
        "Da Music Box v4 - source backup manifest"
        "Created: $stamp"
        ""
        "Zip: $zipPath"
        "Files: $fileCount"
        "Size: $sizeMb MB"
        "Live source: $repoRoot"
        ""
        "Included: app, scripts, .git, config, public samples"
        "Excluded: node_modules, dist, .cache, .vite-cache, .cursor/workspace-data, other zips"
    ) | Set-Content -LiteralPath "E:\BACKUP-MANIFEST-$stamp.txt" -Encoding UTF8
}

if (-not $SkipMirror -and (Test-Path 'E:\')) {
    $mirrorRoot = Join-Path 'E:\' $folderName
    if (-not (Test-Path $mirrorRoot)) { New-Item -ItemType Directory -Path $mirrorRoot -Force | Out-Null }
    $null = robocopy $repoRoot $mirrorRoot /E /XD node_modules dist .cache .vite-cache /XF *.zip /R:1 /W:1
    if ($LASTEXITCODE -ge 8) { Write-Warning "Folder mirror robocopy exit $LASTEXITCODE" }
    else { Write-Host "Folder mirror: $mirrorRoot" }
}

return @{
    ZipPath   = $zipPath
    SizeBytes = $zipSize
    FileCount = $fileCount
}
