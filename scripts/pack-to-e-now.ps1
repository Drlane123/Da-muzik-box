# Quick launcher: pack current repo to E:\ (zip + optional folder mirror).
param([switch]$ZipOnly)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$resultFile = Join-Path $repoRoot 'pack-result.txt'

$args = @{ OutDir = 'E:\' }
if ($ZipOnly) { $args.SkipMirror = $true }

$log = & (Join-Path $PSScriptRoot 'pack-source-zip.ps1') @args 2>&1 | Out-String
Write-Host $log

$zipLine = ($log -split "`n" | Where-Object { $_ -match '^Saved:' } | Select-Object -First 1)
$statsLine = ($log -split "`n" | Where-Object { $_ -match '^Files:' } | Select-Object -First 1)
$mirrorLine = ($log -split "`n" | Where-Object { $_ -match '^Folder mirror:' } | Select-Object -First 1)

$lines = @()
if ($zipLine) { $lines += $zipLine.Trim() }
if ($statsLine) { $lines += $statsLine.Trim() }
if ($mirrorLine) { $lines += $mirrorLine.Trim() }
$lines += 'Build output (when E: present): E:\Da-Music-Box-v4-SOURCE-COMPLETE\dist'
$lines += "Run again: scripts\pack-to-e-now.ps1  (zip-only: -ZipOnly)"
if ($lines.Count -gt 0) {
    $lines | Set-Content -LiteralPath $resultFile -Encoding UTF8
}
