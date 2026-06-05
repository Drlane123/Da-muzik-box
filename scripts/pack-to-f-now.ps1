# Full source + git history → F:\ (same as pack-source-zip.ps1; includes .git, current work).
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$resultFile = Join-Path $repoRoot 'pack-result.txt'

$log = & (Join-Path $PSScriptRoot 'pack-source-zip.ps1') -OutDir 'F:\' 2>&1 | Out-String
Write-Host $log

$zipLine = ($log -split "`n" | Where-Object { $_ -match '^Saved:' } | Select-Object -First 1)
$statsLine = ($log -split "`n" | Where-Object { $_ -match '^Files:' } | Select-Object -First 1)
$gitLine = if (Test-Path (Join-Path $repoRoot '.git')) { 'Git history: included (.git folder in zip)' } else { 'Git history: no .git folder in repo' }
if ($zipLine -and $statsLine) {
    @($zipLine.Trim(), $statsLine.Trim(), $gitLine) | Set-Content -LiteralPath $resultFile -Encoding UTF8
}
