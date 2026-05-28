# Pack Da Music Box source to E:\ (staging on E: avoids empty cross-drive zips).
param([string]$OutDir = 'E:\')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$folderName = Split-Path $repoRoot -Leaf
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$zipPath = Join-Path $OutDir "${folderName}_$(Get-Date -Format 'yyyy-MM-dd_HHmm').zip"
$staging = Join-Path $OutDir "dmbox-staging-$(Get-Random)"
$stagingRoot = Join-Path $staging $folderName

try {
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

    $null = robocopy $repoRoot $stagingRoot /E /XD node_modules dist /XF *.zip /R:1 /W:1
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }

    $fileCount = @(Get-ChildItem -LiteralPath $stagingRoot -Recurse -File -Force).Count
    if ($fileCount -lt 20) { throw "Only $fileCount files copied." }

    $zipTemp = Join-Path $OutDir "dmbox-pack-$(Get-Random).zip"
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingRoot, $zipTemp, [System.IO.Compression.CompressionLevel]::Optimal, $true)

    $zipSize = (Get-Item -LiteralPath $zipTemp).Length
    if ($zipSize -lt 100KB) { throw "Zip too small ($zipSize bytes)." }

    Move-Item -LiteralPath $zipTemp -Destination $zipPath -Force
    Write-Host "Saved: $zipPath"
    Write-Host "Files: $fileCount | Size: $([math]::Round($zipSize / 1MB, 2)) MB"
}
finally {
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
}
