# Backup automático do repositório para o GitHub de SEGURANÇA (remote "backup").
# Executado a cada 3 horas pelo Agendador de Tarefas do Windows (tarefa "Obra10-Backup-GitHub").
# Faz push dos branches committados; NÃO auto-commita trabalho não salvo (segurança).
# Log fora do repo (não polui o git): %TEMP%\obra10-backup-github.log
$ErrorActionPreference = "Continue"
$repo = "c:\Users\wende\Documents\escritorio-virtual-ramon"
$log  = Join-Path $env:TEMP "obra10-backup-github.log"
$ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Set-Location $repo
Add-Content $log "[$ts] --- backup iniciado ---"
try {
  $o1 = (git push backup wendel/dev 2>&1 | Out-String).Trim()
  Add-Content $log "[$ts] wendel/dev -> $o1"
} catch { Add-Content $log "[$ts] ERRO wendel/dev: $_" }
try {
  $o2 = (git push backup feature/escritorio-visual 2>&1 | Out-String).Trim()
  Add-Content $log "[$ts] feature/escritorio-visual -> $o2"
} catch { Add-Content $log "[$ts] ERRO feature: $_" }
Add-Content $log "[$ts] --- backup concluido ---"
