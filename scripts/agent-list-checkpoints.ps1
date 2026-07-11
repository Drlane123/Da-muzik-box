$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "agent-checkpoint-lib.ps1")

$store = Get-AgentCheckpointStore
$cps = @($store.checkpoints)
Write-Host ""
Write-Host "Agent checkpoints (each = state BEFORE that task started):"
Write-Host ""
if ($cps.Count -eq 0) {
  Write-Host "  (none)"
} else {
  foreach ($c in ($cps | Sort-Object id)) {
    Write-Host ("  [{0}] {1}  @ {2}" -f $c.id, $c.label, $c.createdAt)
  }
}
Write-Host ""
Write-Host "Revert latest task:  .\scripts\agent-revert-session.ps1"
Write-Host "Revert specific:     .\scripts\agent-revert-session.ps1 -Id 2"
Write-Host "Revert by label:     .\scripts\agent-revert-session.ps1 -Label audio-drops"
Write-Host ""
