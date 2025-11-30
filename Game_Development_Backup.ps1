# Navigate to your game dev repo
cd "C:\Users\jorda\OneDrive\Desktop\Game Development"

# Stage all changes (files + folders)
git add .

# Commit with timestamp
git commit -m "[FORCE] Backup $(Get-Date -Format 'yyyy/MM/dd HH:mm:ss')"

# Push to remote
git push

# Log confirmation silently
"[Backup run at $(Get-Date)]" | Out-File ".\BackupLog.txt" -Append