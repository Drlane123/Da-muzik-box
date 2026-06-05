# Quick launcher: pack current repo to E:\ (zip + folder mirror) and write pack-result.txt at repo root.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$folderName = Split-Path $repoRoot -Leaf
$resultFile = Join-Path $repoRoot 'pack-result.txt'
$mirrorRoot = Join-Path 'E:\' $folderName

$log = & (Join-Path $PSScriptRoot 'pack-source-zip.ps1') -OutDir 'E:\' 2>&1 | Out-String
Write-Host $log

# Folder mirror on E: (canonical save location — keeps C: Desktop copy lean).
if (Test-Path 'E:\') {
    if (-not (Test-Path $mirrorRoot)) { New-Item -ItemType Directory -Path $mirrorRoot -Force | Out-Null }
    $null = robocopy $repoRoot $mirrorRoot /E /XD node_modules dist .vite-cache /XF *.zip /R:1 /W:1
    if ($LASTEXITCODE -ge 8) { Write-Warning "Folder mirror robocopy exit $LASTEXITCODE" }
    else { Write-Host "Folder mirror: $mirrorRoot" }
}

$zipLine = ($log -split "`n" | Where-Object { $_ -match '^Saved:' } | Select-Object -First 1)
$statsLine = ($log -split "`n" | Where-Object { $_ -match '^Files:' } | Select-Object -First 1)
$lines = @()
if ($zipLine) { $lines += $zipLine.Trim() }
if ($statsLine) { $lines += $statsLine.Trim() }
if (Test-Path $mirrorRoot) { $lines += "Folder mirror: $mirrorRoot" }
$lines += 'Build output (when E: present): E:\Da-Music-Box-v4-SOURCE-COMPLETE\dist'
if ($lines.Count -gt 0) {
    $lines | Set-Content -LiteralPath $resultFile -Encoding UTF8
}
