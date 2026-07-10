# One-time / repair: move Da Music Box caches off C: onto E: and recreate junctions.
# Safe to re-run — skips paths that are already junctions.
$ErrorActionPreference = 'Stop'

$E = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE'
if (-not (Test-Path $E)) {
  Write-Error "Project not found at $E"
}

$dirs = @(
  (Join-Path $E '.cache\temp'),
  (Join-Path $E '.cache\bun\install\cache'),
  (Join-Path $E '.cache\bun-global'),
  (Join-Path $E '.cursor\workspace-data'),
  (Join-Path $E '.vite-cache'),
  (Join-Path $E 'dist')
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

function Ensure-Junction([string]$link, [string]$target) {
  if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      Write-Host "OK junction: $link"
      return
    }
    Write-Host "Merging $link -> $target"
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    robocopy $link $target /E /MOVE /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Remove-Item $link -Recurse -Force -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path $link)) {
    cmd /c mklink /J `"$link`" `"$target`" | Out-Null
    Write-Host "Created junction: $link -> $target"
  }
}

Ensure-Junction 'C:\Users\DELL\.cursor\projects\e-Da-Music-Box-v4-SOURCE-COMPLETE' (Join-Path $E '.cursor\workspace-data')
Ensure-Junction 'C:\Users\DELL\.bun' (Join-Path $E '.cache\bun-global')

Write-Host ''
Write-Host 'E: drive paths ready.'
Write-Host "  Project:  $E"
Write-Host "  Vite cache: $E\.vite-cache"
Write-Host "  Bun cache:  $E\.cache\bun-global (junction from C:\Users\DELL\.bun)"
Write-Host "  Cursor data: $E\.cursor\workspace-data (junction from .cursor\projects\...)"
