param(
  [Parameter(Mandatory = $true)]
  [string]$Label
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "agent-checkpoint-lib.ps1")

$slug = ($Label -replace '[^a-zA-Z0-9\-]+', '-').Trim('-').ToLowerInvariant()
if (-not $slug) { $slug = "task" }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$createdAt = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$branch = "agent-checkpoint/$stamp-$slug"
$stashMsg = "agent-session-start: $Label @ $createdAt"

Push-Location $script:AgentCheckpointRoot
try {
  $head = (git rev-parse HEAD).Trim()
  git stash push -u -m $stashMsg | Out-Host
  $stashRef = (git rev-parse "stash@{0}").Trim()
  # Keep working tree as it was: re-apply stash without dropping it
  git stash apply --index "stash@{0}" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    git stash apply "stash@{0}" | Out-Null
  }

  $store = Get-AgentCheckpointStore
  $nextId = 1
  if ($store.checkpoints -and $store.checkpoints.Count -gt 0) {
    $nextId = ([int]($store.checkpoints | Measure-Object -Property id -Maximum).Maximum) + 1
  }
  $entry = [pscustomobject]@{
    id         = $nextId
    label      = $Label
    headCommit = $head
    createdAt  = $createdAt
    branch     = $branch
    stashMsg   = $stashMsg
    stashRef   = $stashRef
  }
  if (-not $store.checkpoints) { $store.checkpoints = @() }
  $store.checkpoints = @($store.checkpoints) + @($entry)
  Save-AgentCheckpointStore $store

  Write-Host ""
  Write-Host "Checkpoint #$nextId saved: $Label"
  Write-Host "  (State before this task - your accepted work is preserved)"
  Write-Host ""
  Write-Host "Revert THIS task only:"
  Write-Host "  .\scripts\agent-revert-session.ps1"
  Write-Host ""
  Write-Host "See all checkpoints / pick one to revert:"
  Write-Host "  .\scripts\agent-list-checkpoints.ps1"
  Write-Host ""
}
finally {
  Pop-Location
}
