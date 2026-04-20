<#
  scripts/auto_workflow.ps1
  Automatiza: commit/push de cambios, levantar backend, y arrancar Expo (Windows PowerShell).

  Requisitos previos en la máquina local:
  - Git instalado y configurado (user.name, user.email) y remote `origin` definido.
  - Node.js y npm instalados.
  - Expo CLI disponible vía `npx expo` (se instalará si hace falta).

  Uso:
    PowerShell -ExecutionPolicy Bypass -File .\scripts\auto_workflow.ps1

  El script no puede forzar push si no hay acceso a la remota; en ese caso mostrará instrucciones.
#>

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

Set-StrictMode -Version Latest

Push-Location (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent) | Out-Null
Push-Location ..\ | Out-Null

# Detect git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Err "Git no está instalado o no está en PATH. Instálalo y vuelve a ejecutar el script."; exit 1
}

# Detect current branch
$branch = (git rev-parse --abbrev-ref HEAD) -replace '\r',''
Write-Info "Rama actual: $branch"

# Files to commit
$files = @("backend/server.js","frontend/src/services/apiService.js","frontend/src/utils/constants.js")

Write-Info "Creando rama temporal 'fix/patologia-cie10' y preparando commit..."
try{
  git checkout -b fix/patologia-cie10 2>$null | Out-Null
} catch {
  Write-Warn "La rama ya existe o no se pudo crear. Cambiando a la rama si existe..."
  git checkout fix/patologia-cie10 2>$null | Out-Null
}

git add $files
if ((git status --porcelain) -eq ''){
  Write-Info "No hay cambios nuevos para commitear.";
} else {
  git commit -m "fix: normalizar patologia (aceptar string u objeto) y asegurar cie10 en payload frontend" || Write-Warn "Commit falló (posible conflicto o configuración de git)."
  try{
    git push -u origin fix/patologia-cie10
    Write-Info "Push realizado a origin/fix/patologia-cie10"
  } catch {
    Write-Warn "No se pudo hacer push automáticamente. Ejecuta manualmente: git push -u origin fix/patologia-cie10"
  }
}

# Actualizar API_BASE_URL en frontend si es 'localhost' -> usar IP local para dispositivos físicos
try{
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias '*' | Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1).IPAddress
} catch {
  $ip = $null
}
if (-not $ip){
  # Fallback: obtener mediante DNS
  try{ $ip = [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName()).AddressList | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1; $ip = $ip.IPAddressToString } catch { $ip = $null }
}

if ($ip){
  $constFile = "frontend/src/utils/constants.js"
  if (Test-Path $constFile) {
    $content = Get-Content $constFile -Raw
    $new = $content -replace "API_BASE_URL\s*=\s*'http://localhost:3000'", "API_BASE_URL = 'http://$ip:3000'"
    if ($new -ne $content) {
      Write-Info "Actualizando API_BASE_URL en $constFile -> http://$ip:3000"
      $new | Set-Content $constFile -Encoding UTF8
      git add $constFile
      git commit -m "chore: set API_BASE_URL to local IP for device testing ($ip)" || Write-Warn "No se pudo commitear el cambio de constants.js"
    } else { Write-Info "API_BASE_URL ya configurado o no usa localhost." }
  }
}

# Levantar backend en segundo plano
Write-Info "Instalando dependencias del backend e iniciando servidor en background (server.log)..."
Push-Location backend
if (Test-Path package.json) { npm install } else { Write-Warn "No se encontró package.json en backend" }

$env:NODE_ENV='development'; $env:DEV_TOKEN='devtoken123'
if (Get-Process node -ErrorAction SilentlyContinue) { Get-Process node | Stop-Process -Force -ErrorAction SilentlyContinue }
Start-Job -ScriptBlock { Set-Location (Join-Path $PSScriptRoot '..\backend'); $env:NODE_ENV='development'; $env:DEV_TOKEN='devtoken123'; node server.js *> server.log } | Out-Null
Start-Sleep -Seconds 3
Write-Info "Backend iniciado (logs en backend/server.log)."
Pop-Location

# Arrancar Expo (frontend)
Write-Info "Instalando dependencias del frontend e iniciando Expo (Metro) en una nueva ventana..."
Push-Location frontend
if (Test-Path package.json) { npm install } else { Write-Warn "No se encontró package.json en frontend" }

# Usar Start-Process para abrir una nueva ventana con npx expo start -c
Start-Process -FilePath "cmd.exe" -ArgumentList "/k npx expo start -c" -WorkingDirectory (Get-Location).Path
Write-Info "Expo arrancado en nueva ventana. Escanea el QR o abre el emulador." 
Pop-Location

Write-Info "Automatización completada. Revisa server logs en backend/server.log y la ventana de Expo para mensajes (pantalla azul)."

Pop-Location | Out-Null
