# Test de mecanografía (tipo Monkeytype, versión minimalista)

Aplicación web de una sola página para practicar mecanografía con un estilo oscuro y minimalista. El temporizador empieza al pulsar la primera tecla y se muestran estadísticas en directo.

## Tecnologías

- HTML
- CSS
- JavaScript

## Cómo ejecutar en local

- Abrir `docs/index.html` en el navegador.

## Despliegue en GitHub Pages (carpeta `/docs`)

1. Crear un repositorio en GitHub.
2. Subir el código a la rama `main`.
3. En GitHub → **Settings** → **Pages**:
   - **Source**: rama `main`
   - **Folder**: `/docs`
4. Guardar y usar la URL que genera GitHub Pages.

## Estadísticas

- **Tiempo restante**: segundos que quedan hasta 0.
- **Velocidad (WPM)**: `(caracteresCorrectos / 5) / minutosTranscurridos`.
- **Precisión**: `(caracteresCorrectos / caracteresTecleados) * 100`.
- **Errores**: número de caracteres tecleados que no coinciden con el texto objetivo.

