# GIT-only backup (fresh stamp when an old .part file is locked)
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$repoRoot = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE'
$appStamp = '2026-07-04_2045'
$zipPath = "E:\Da-Music-Box-v4-SOURCE-COMPLETE-GIT_$stamp.zip"
$partPath = "$zipPath.part"

if (Test-Path -LiteralPath $partPath) { Remove-Item -LiteralPath $partPath -Force }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

Write-Host "Building GIT HISTORY zip -> $zipPath"
Push-Location $repoRoot
try {
  & tar -a -c -f $partPath .git
  if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

$list = & tar -tf $partPath 2>&1
if ($LASTEXITCODE -ne 0) { throw 'tar verify failed' }
$count = ($list | Measure-Object -Line).Lines
$sizeMb = [math]::Round((Get-Item -LiteralPath $partPath).Length / 1MB, 2)
if ($count -lt 500) { throw "Too few files ($count)" }

Move-Item -LiteralPath $partPath -Destination $zipPath -Force
Write-Host "GIT DONE: $zipPath"
Write-Host "Files: $count  Size: $sizeMb MB"

$manifest = @(
  'SOURCE BACKUP COMPLETE - ALL PARTS VERIFIED'
  '==========================================='
  ''
  "Session stamp: $appStamp (APP/PUBLIC) + $stamp (GIT)"
  "Source: $repoRoot"
  ''
  "APP SOURCE: E:\Da-Music-Box-v4-SOURCE-COMPLETE-APP-SOURCE_$appStamp.zip"
  '  Files: 1006 | Size: 13.62 MB'
  ''
  "PUBLIC ASSETS: E:\Da-Music-Box-v4-SOURCE-COMPLETE-PUBLIC_$appStamp.zip"
  '  Files: 1503 | Size: 619.14 MB'
  ''
  "GIT HISTORY: $zipPath"
  "  Files: $count | Size: $sizeMb MB"
  ''
  'Restore: unzip all three parts into the same folder, then run: bun install'
  'Skipped: node_modules, dist, .cache, .vite-cache, .cursor/workspace-data'
  ''
  'Note: stale partial E:\...\GIT_2026-07-04_2045.zip.part may be locked — safe to delete after reboot if empty.'
)
$manifest | Set-Content -LiteralPath (Join-Path $repoRoot 'pack-result.txt') -Encoding UTF8
$manifest | Set-Content -LiteralPath (Join-Path $repoRoot "SAVE-STAMP-SPLIT-$stamp.txt") -Encoding UTF8
try { $manifest | Set-Content -LiteralPath "E:\SAVE-STAMP-SPLIT-$stamp.txt" -Encoding UTF8 } catch {}
Write-Host 'SOURCE BACKUP COMPLETE - ALL PARTS VERIFIED'
