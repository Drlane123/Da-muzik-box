$repoRoot = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE'
$bat = Join-Path $repoRoot '!!! CLICK HERE TO SAVE SOURCE.bat'
$status = Join-Path $repoRoot 'BACKUP-STATUS.txt'

# Remove stale failed part from interrupted run
$stale = 'E:\Da-Music-Box-v4-SOURCE-COMPLETE-CODE_2026-06-14_1522.zip.part'
if (Test-Path -LiteralPath $stale) {
    Rename-Item -LiteralPath $stale -NewName 'Da-Music-Box-v4-SOURCE-COMPLETE-CODE_2026-06-14_1522.FAILED-part-do-not-use' -Force
}

"Starting detached backup at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Set-Content $status -Encoding UTF8

$proc = Start-Process -FilePath $bat -WorkingDirectory $repoRoot -PassThru -WindowStyle Normal
"Detached backup launched. PID=$($proc.Id). Watch the new window or BACKUP-STATUS.txt / pack-result.txt" | Add-Content $status -Encoding UTF8
Write-Host "Backup started in its own window (PID $($proc.Id)). It will not be stopped if Cursor closes."
