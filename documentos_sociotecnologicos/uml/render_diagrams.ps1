<#
Renderiza archivos PlantUML (.puml) a PNG usando Docker o plantuml.jar
Salida: documentos_sociotecnologicos/uml/output
#>
Param()
Set-StrictMode -Version Latest
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$diagrams = Join-Path $root 'documentos_sociotecnologicos\uml'
$out = Join-Path $diagrams 'output'
New-Item -ItemType Directory -Force -Path $out | Out-Null

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Usando Docker para renderizar..."
    docker run --rm -v "${root}:/work" plantuml/plantuml -tpng /work/documentos_sociotecnologicos/uml/*.puml -o /work/documentos_sociotecnologicos/uml/output
    Write-Host "Renderizado completado. Archivos en: $out"
} elseif (Test-Path "$root\plantuml.jar") {
    Write-Host "Usando plantuml.jar local para renderizar..."
    java -jar "$root\plantuml.jar" -tpng -o "$out" "$diagrams\*.puml"
    Write-Host "Renderizado completado. Archivos en: $out"
} else {
    Write-Error "Ni Docker ni plantuml.jar están disponibles. Instale Docker o coloque plantuml.jar en la raíz del repo."
    exit 1
}
