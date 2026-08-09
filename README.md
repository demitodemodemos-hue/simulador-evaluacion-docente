# Simulador de Evaluación Docente - Nivel Inicial

Aplicación web estática para practicar el cuadernillo **A01-EBRI-11 / Inicial (Convocatoria 2023)**.

## Funciones incluidas
- Acceso por nombre + correo, validado contra `data/usuarios.csv`.
- Modo Repaso: sin tiempo, comprobación inmediata y respuesta correcta.
- Modo Evaluación: 60 preguntas, temporizador de 60 minutos y envío automático al terminar.
- Navegación por preguntas, contador de respondidas y revisión final.
- Resultado: correctas, incorrectas, omitidas, porcentaje y tiempo.
- Referencia de mínimos por escala de la Convocatoria 2023.
- Historial de los últimos 10 intentos guardado solo en el navegador del participante.
- Exportación del resultado a CSV.
- Diseño responsive para celular, tablet y PC.

## Usuarios autorizados
Edita `data/usuarios.csv` manteniendo este formato:

```csv
nombre,correo
María Pérez,maria@correo.com
Juan Torres,juan@correo.com
```

Se incluye un usuario de prueba:
- Nombre: `Usuario Demo`
- Correo: `demo@practica.pe`

> Importante: al ser una web estática, la lista de usuarios puede ser consultada por una persona con conocimientos técnicos. Sirve como control básico de acceso para práctica, no como autenticación segura.

## Probar en tu computadora
No abras `index.html` con doble clic porque algunos navegadores bloquean la lectura del CSV. Ejecuta un servidor local, por ejemplo:

```bash
python -m http.server 8080
```

Luego abre `http://localhost:8080`.

## Publicar gratis en GitHub Pages
1. Crea un repositorio nuevo en GitHub.
2. Sube todo el contenido de esta carpeta a la raíz del repositorio.
3. En **Settings > Pages**, selecciona **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda. GitHub mostrará la dirección pública del simulador.

También puede desplegarse sin cambios en Cloudflare Pages, Netlify o Vercel.

## Cambiar duración
En `app.js`, busca `remaining:3600`. El valor está en segundos. Para 90 minutos usar `5400`..

## Privacidad de resultados
No existe una base de datos central. El historial se almacena con `localStorage` únicamente en el dispositivo de cada participante. El botón **Exportar resultado CSV** permite que el participante descargue su resultado.
