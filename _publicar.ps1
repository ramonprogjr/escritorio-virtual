# _publicar.ps1 — pré-voo de publicação Obra10+ (NÃO faz git push, NÃO deploya sozinho).
# Travas: sem push remoto; deploy só com GO humano; este script apenas valida e orienta.
param([switch]$Confirmado)
$ErrorActionPreference = "Stop"

Write-Host "== Pré-voo de publicação Obra10+ ==" -ForegroundColor Cyan

# 1) Contexto git
$branch = (git rev-parse --abbrev-ref HEAD)
Write-Host "Branch atual: $branch"
$dirty = (git status --porcelain)
if ($dirty) { Write-Host "AVISO: há mudanças não commitadas (faça commit pequeno antes)." -ForegroundColor Yellow }

# 2) Health-check
Write-Host "Rodando _chk23..."
node app/_chk23.js
if ($LASTEXITCODE -ne 0) {
  Write-Host "BLOQUEADO: _chk23 falhou — corrija antes de publicar." -ForegroundColor Red
  exit 1
}
Write-Host "_chk23 OK." -ForegroundColor Green

# 3) Portão humano (travas: sem push automático)
if (-not $Confirmado) {
  Write-Host ""
  Write-Host "PRONTO PARA DEPLOY MANUAL." -ForegroundColor Green
  Write-Host "Travas ativas: sem git push automático; o deploy é feito por você (Render)."
  Write-Host "Após seu GO, re-rode com:  ./_publicar.ps1 -Confirmado"
  exit 0
}

Write-Host "Confirmado pelo operador. Deploy é manual no Render — este script não faz push." -ForegroundColor Green
