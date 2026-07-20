#!/usr/bin/env bash
# Renderiza archivos PlantUML (.puml) a PNG usando Docker o plantuml.jar
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIAGRAMS_DIR="$ROOT_DIR/docs/diagrams"
OUTPUT_DIR="$DIAGRAMS_DIR/output"

mkdir -p "$OUTPUT_DIR"

if command -v docker >/dev/null 2>&1; then
  echo "Usando Docker para renderizar..."
  docker run --rm -v "$ROOT_DIR":/work plantuml/plantuml -tpng /work/docs/diagrams/*.puml -o /work/docs/diagrams/output
  echo "Renderizado completado. Archivos en: $OUTPUT_DIR"
else
  if [ -f "plantuml.jar" ]; then
    echo "Usando plantuml.jar local para renderizar..."
    java -jar plantuml.jar -tpng -o "$OUTPUT_DIR" "$DIAGRAMS_DIR"/*.puml
    echo "Renderizado completado. Archivos en: $OUTPUT_DIR"
  else
    echo "Ni Docker ni plantuml.jar están disponibles. Instale Docker o coloque plantuml.jar en la raíz del repo."
    exit 1
  fi
fi
