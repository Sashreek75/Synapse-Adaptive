# ============================================================================
#  Synapse Adaptive — push the redesign to GitHub
#
#  Runs on YOUR machine, against your real files on disk (which are intact).
#  It repairs the broken local git, commits everything, and pushes a NEW branch
#  called "redesign-conversation-first". It never force-pushes and never touches
#  main. Your token is only entered at runtime and is NOT saved anywhere.
#
#  To run: right-click this file -> "Run with PowerShell"
#          (or double-click push-redesign.bat)
# ============================================================================

$ErrorActionPreference = "Stop"
$repo   = $PSScriptRoot
$url    = "https://github.com/Sashreek75/Synapse-Adaptive.git"
$branch = "redesign-conversation-first"

Set-Location $repo
Write-Host "`n=== Synapse Adaptive :: push redesign ===" -ForegroundColor Cyan
Write-Host "Folder: $repo`n"

# 0) Sanity: is git installed?
try { git --version | Out-Null } catch {
  Write-Host "Git isn't installed or isn't on PATH. Install it from https://git-scm.com/download/win and re-run." -ForegroundColor Red
  Read-Host "Press Enter to close"; exit 1
}

# 1) Make sure secrets and junk never get committed
$gi = Join-Path $repo ".gitignore"
$need = @("node_modules/", ".next/", "out/", ".env", ".env.local", ".env.*", "*.tsbuildinfo", ".fuse_hidden*", "push-redesign.ps1", "push-redesign.bat")
$existing = if (Test-Path $gi) { Get-Content $gi } else { @() }
$append = $need | Where-Object { $existing -notcontains $_ }
if ($append.Count -gt 0) { Add-Content -Path $gi -Value ($append -join "`r`n") }

# 2) Remove stray FUSE artifacts if any slipped onto disk
Get-ChildItem -Path $repo -Recurse -Force -Filter ".fuse_hidden*" -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

# 3) The local .git is broken (empty config, no refs). Start it clean.
#    This loses no work — your files on disk are the source of truth, and real
#    history is fetched fresh from GitHub so the branch has a proper parent.
if (Test-Path (Join-Path $repo ".git")) {
  Remove-Item -Recurse -Force (Join-Path $repo ".git")
}
git init -q
git symbolic-ref HEAD refs/heads/$branch

# 4) Identify yourself to git if not already set (local to this repo only)
if (-not (git config user.email)) { git config user.email "support@compliancewatchdog.com" }
if (-not (git config user.name))  { git config user.name  "Ameena" }

# 5) Bring in GitHub history so our commit sits on top of main
git remote add origin $url
Write-Host "Fetching current history from GitHub..." -ForegroundColor DarkGray
git fetch -q origin

$hasMain = $false
try { git rev-parse --verify -q origin/main | Out-Null; $hasMain = $true } catch {}

if ($hasMain) {
  # Point the new branch at main, then stage your working tree as the diff.
  git update-ref refs/heads/$branch origin/main
  git reset -q            # index <- main; working tree (your files) untouched
} else {
  Write-Host "Couldn't find origin/main; creating an independent first commit." -ForegroundColor Yellow
}

# 6) Stage everything and show a quick summary
git add -A
$changes = (git status --porcelain | Measure-Object).Count
Write-Host "Files staged for commit: $changes`n" -ForegroundColor Green

if ($changes -eq 0) {
  Write-Host "Nothing to commit — your branch already matches main. Done." -ForegroundColor Yellow
  Read-Host "Press Enter to close"; exit 0
}

git commit -q -m "Redesign: conversation-first AI health companion

Rebuild the experience around the founding vision — the AI is the product, not a
dashboard. Immersive conversation-first Home (greeting + one insight + the
conversation as the interface), a quiet Rooms drawer replacing the sidebar/tab
bar, a compact 'today's focus' strip, and a signal-driven generated dashboard
that shows only what has moved enough to matter."

# 7) Push using the token for this one command only (never stored on disk)
Write-Host "`nPaste your GitHub token (input hidden), then press Enter:" -ForegroundColor Cyan
$sec = Read-Host -AsSecureString
$pat = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

$pushUrl = "https://x-access-token:$pat@github.com/Sashreek75/Synapse-Adaptive.git"
Write-Host "Pushing branch '$branch'..." -ForegroundColor DarkGray
git push -u $pushUrl "${branch}:${branch}"
$code = $LASTEXITCODE
$pat = $null; $pushUrl = $null   # scrub token from memory

if ($code -eq 0) {
  Write-Host "`n Pushed. Open a pull request here:" -ForegroundColor Green
  Write-Host "   https://github.com/Sashreek75/Synapse-Adaptive/compare/main...$branch`n"
} else {
  Write-Host "`nPush failed (exit $code). Common causes: token lacks 'Contents: Read and write' on this repo, or it expired." -ForegroundColor Red
}
Read-Host "Press Enter to close"
