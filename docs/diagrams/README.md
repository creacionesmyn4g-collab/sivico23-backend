Diagrams UML (PlantUML) para SIVICO23
===================================

Archivos:

- `backend_class_diagram.puml` : Diagrama de clases y entidades del backend.
- `frontend_component_diagram.puml` : Componentes principales del frontend y dependencias.
- `sequence_login.puml` : Secuencia del flujo de login.

Renderizado rápido:

1) Usando PlantUML (requiere Java):

```bash
# instalar plantuml si no lo tiene (ej. Linux)
# renderizar PNG
java -jar plantuml.jar backend_class_diagram.puml
java -jar plantuml.jar frontend_component_diagram.puml
java -jar plantuml.jar sequence_login.puml
```

2) Usando la extensión PlantUML en VSCode: abra el archivo `.puml` y use la vista previa.

3) Usando Docker (si prefiere):

```bash
docker run --rm -v "$PWD":/workspace plantuml/plantuml -tpng /workspace/docs/diagrams/backend_class_diagram.puml
```

Salida de imágenes:

- Los PNG generados se colocarán en la carpeta `docs/diagrams/output`.

Automatización:

- Hay un workflow de GitHub Actions (`.github/workflows/render-diagrams.yml`) que renderiza los `.puml` usando Docker y comitea las imágenes resultantes en `docs/diagrams/output` cuando se hacen push de los `.puml`.

Notas:
- Los diagramas están generados a partir del código actual en `backend/server.js` y `frontend/src/services/apiService.js`.
- Si desea diagramas adicionales (ERD SQL directo, diagramas de despliegue, o más secuencias), indíquelo y los generaré.
