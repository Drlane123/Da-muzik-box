param(
  [int]$Id = 0,
  [string]$Label = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "agent-checkpoint-lib.ps1")

$store = Get-AgentCheckpointStore
$cps = @($store.checkpoints)
if ($cps.Count -eq 0) { throw "No checkpoints recorded." }

$target = $null
if ($Id -gt 0) {
  $target = $cps | Where-Object { $_.id -eq $Id } | Select-Object -First 1
} elseif ($Label) {
  $target = $cps | Where-Object { $_.label -eq $Label } | Select-Object -Last 1
} else {
  $target = $cps | Sort-Object id | Select-Object -Last 1
}
if (-not $target) { throw "Checkpoint not found." }

Write-Host "Checkpoint #$($target.id): $($target.label) @ $($target.createdAt)"
Push-Location $script:AgentCheckpointRoot
try {
  git reset --hard $target.headCommit | Out-Host
  git stash apply $target.stashRef 2>&1 | Out-Host
  # Drop this and later checkpoints from the store
  $store.checkpoints = @($cps | Where-Object { $_.id -lt $target.id })
  Save-AgentCheckpointStore $store
  Write-Host ""
  Write-Host "Reverted to checkpoint #$($target.id) ($($target.label))."
  Write-Host "This task and any later agent tasks were undone."
  Write-Host "Earlier checkpoints you accepted are still available:"
  Write-Host ""
  & (Join-Path $PSScriptRoot "agent-list-checkpoints.ps1")
}
finally {
  Pop-Location
}
