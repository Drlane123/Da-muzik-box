# Measure latest (or given) backup zip on E:\ — writes size + file count to stamp files.
param([string]$ZipPath)

$ErrorActionPreference = 'Stop'
$repoRoot = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE'
$logPath = Join-Path $repoRoot '.cache\temp\backup-verify-log.txt'

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Write-Host $line
}

try {
    if (-not $ZipPath) {
        $candidates = Get-ChildItem -LiteralPath 'E:\' -Filter 'Da-Music-Box-v4-SOURCE-COMPLETE_*.zip' -File |
            Sort-Object LastWriteTime -Descending
        if ($candidates.Count -eq 0) {
            throw 'No backup zip found on E:\ (expected Da-Music-Box-v4-SOURCE-COMPLETE_*.zip)'
        }
        $ZipPath = $candidates[0].FullName
    }

    if (-not (Test-Path -LiteralPath $ZipPath)) {
        throw "Zip not found: $ZipPath"
    }

    $zipItem = Get-Item -LiteralPath $ZipPath
    $zipSize = $zipItem.Length
    if ($zipSize -lt 100KB) { throw "Zip too small ($zipSize bytes): $ZipPath" }

    $fileCount = (& tar -tf $ZipPath | Measure-Object -Line).Lines
    $sizeMb = [math]::Round($zipSize / 1GB, 3)
    $sizeMbDisplay = [math]::Round($zipSize / 1MB, 2)
    $sizeGbDisplay = [math]::Round($zipSize / 1GB, 2)

    if ($ZipPath -match '_(\d{4}-\d{2}-\d{2}_\d{4})\.zip$') {
        $ts = $Matches[1]
    } else {
        $ts = $zipItem.LastWriteTime.ToString('yyyy-MM-dd_HHmm')
    }

    $freeE = $null
    if (Test-Path 'E:\') {
        $freeE = [math]::Round((Get-PSDrive E).Free / 1GB, 2)
    }

    $stampBody = @(
        "Saved: $ZipPath"
        "Files: $fileCount"
        "Size: $sizeMbDisplay MB ($sizeGbDisplay GB)"
        "Size bytes: $zipSize"
        "Timestamp: $ts"
        "Source: $repoRoot"
        "E: free space: ${freeE} GB"
        "Skipped: node_modules, dist, .cache, .vite-cache, *.zip"
    )

    $stampBody | Set-Content -LiteralPath (Join-Path $repoRoot "SAVE-STAMP-$ts.txt") -Encoding UTF8
    $stampBody | Set-Content -LiteralPath "E:\SAVE-STAMP-$ts.txt" -Encoding UTF8

    @(
        "Da Music Box v4 - source backup manifest"
        "Created: $ts"
        "Verified: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        ""
        "Zip: $ZipPath"
        "Files: $fileCount"
        "Size: $sizeMbDisplay MB ($sizeGbDisplay GB)"
        "Size bytes: $zipSize"
        "Live source: $repoRoot"
        "E: free space: ${freeE} GB"
        ""
        "Included: app, scripts, .git, config, public samples"
        "Excluded: node_modules, dist, .cache, .vite-cache, other zips"
    ) | Set-Content -LiteralPath "E:\BACKUP-MANIFEST-$ts.txt" -Encoding UTF8

    @(
        "BACKUP VERIFIED ON E: DRIVE"
        "======================="
        ""
        "Zip: $ZipPath"
        "Files: $fileCount"
        "Size: $sizeMbDisplay MB ($sizeGbDisplay GB)"
        "Size bytes: $zipSize"
        "Timestamp: $ts"
        "E: free space: ${freeE} GB"
        ""
        "Stamp: E:\SAVE-STAMP-$ts.txt"
        "Manifest: E:\BACKUP-MANIFEST-$ts.txt"
        "Live source: $repoRoot"
    ) | Set-Content -LiteralPath (Join-Path $repoRoot 'pack-result.txt') -Encoding UTF8

    @(
        "Da Music Box v4 - SOURCE (E: drive primary)"
        "Updated: $ts"
        "Path: $repoRoot"
        ""
        "Latest backup: $ZipPath"
        "Files: $fileCount | Size: $sizeMbDisplay MB ($sizeGbDisplay GB)"
        "E: free: ${freeE} GB"
        ""
        "Quick backup: double-click SAVE-SOURCE-NOW.bat"
        "Verify size: double-click CHECK-BACKUP-ON-E.bat"
    ) | Set-Content -LiteralPath (Join-Path $repoRoot 'FOLDER-STATUS-STAMP.txt') -Encoding UTF8

    Write-Log "OK zip=$ZipPath files=$fileCount sizeMB=$sizeMbDisplay freeE=${freeE}GB"
    exit 0
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    @("BACKUP VERIFY FAILED", $_.Exception.Message) | Set-Content -LiteralPath (Join-Path $repoRoot 'pack-result.txt') -Encoding UTF8
    exit 1
}
