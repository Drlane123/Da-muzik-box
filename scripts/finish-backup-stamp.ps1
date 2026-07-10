# Finalize timestamped backup zip + stamp files on E:
$ErrorActionPreference = 'Stop'
$repoRoot = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE'
$testZip = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE_2026-06-14_test.zip'
$ts = Get-Date -Format 'yyyy-MM-dd_HHmm'
$finalZip = "E:\Da-Music-Box-v4-SOURCE-COMPLETE_$ts.zip"

if (Test-Path -LiteralPath $testZip) {
    if (Test-Path -LiteralPath $finalZip) { Remove-Item -LiteralPath $finalZip -Force }
    Move-Item -LiteralPath $testZip -Destination $finalZip
} elseif (-not (Test-Path -LiteralPath $finalZip)) {
    throw "No backup zip found (expected test zip or $finalZip)"
}

$zipSize = (Get-Item -LiteralPath $finalZip).Length
if ($zipSize -lt 100KB) { throw "Zip too small ($zipSize bytes)." }
$fileCount = (& tar -tf $finalZip | Measure-Object -Line).Lines
$sizeMb = [math]::Round($zipSize / 1MB, 2)

$stampBody = @(
    "Saved: $finalZip"
    "Files: $fileCount | Size: $sizeMb MB"
    "Timestamp: $ts"
    "Source: $repoRoot"
    "Skipped: node_modules, dist, .cache, .vite-cache, *.zip"
)

$stampBody | Set-Content -LiteralPath (Join-Path $repoRoot "SAVE-STAMP-$ts.txt") -Encoding UTF8
$stampBody | Set-Content -LiteralPath "E:\SAVE-STAMP-$ts.txt" -Encoding UTF8
@(
    "Da Music Box v4 - source backup manifest"
    "Created: $ts"
    ""
    "Zip: $finalZip"
    "Files: $fileCount"
    "Size: $sizeMb MB"
    "Live source: $repoRoot"
    ""
    "Included: app, scripts, .git, config, public samples"
    "Excluded: node_modules, dist, .cache, .vite-cache, other zips"
) | Set-Content -LiteralPath "E:\BACKUP-MANIFEST-$ts.txt" -Encoding UTF8

@(
    "Saved: $finalZip"
    "Files: $fileCount | Size: $sizeMb MB"
    "Timestamp: $ts"
    "Build output (when E: present): E:\Da-Music-Box-v4-SOURCE-COMPLETE\dist"
    "Run again: E:\Da-Music-Box-v4-SOURCE-COMPLETE\SAVE-SOURCE-NOW.bat"
) | Set-Content -LiteralPath (Join-Path $repoRoot 'pack-result.txt') -Encoding UTF8

Write-Host "OK: $finalZip ($fileCount files, $sizeMb MB)"
Write-Host "Stamp: E:\SAVE-STAMP-$ts.txt"
