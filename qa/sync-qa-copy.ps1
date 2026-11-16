# Copies frontend/src and frontend/public into the QA copies of the app (a second `next dev` cannot run in the same folder as the
# developer's own, so QA serves a copy; HMR picks the change up). Never copies .env files.
# Usage: powershell -File sync-qa-copy.ps1 -Base <folder holding fe-qa and fe-auth>
param([Parameter(Mandatory = $true)][string]$Base)
$src = Split-Path -Parent $PSScriptRoot
foreach ($d in 'fe-qa', 'fe-auth') {
  foreach ($part in 'src', 'public') {
    robocopy (Join-Path $src $part) (Join-Path (Join-Path $Base $d) $part) /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  }
}
Write-Output "synced to $Base"
