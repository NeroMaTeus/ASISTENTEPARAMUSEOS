# Asistente IA para Museos

Prototipo web donde el visitante conversa con una IA (Google Gemini) que responde únicamente con la información de un museo guardada en `data/museo.json`.

## Estructura

```
asistente-museos/
├── data/museo.json      ← información del museo (salas, piezas, curiosidades, preguntas sugeridas)
├── public/
│   ├── index.html       ← interfaz
│   ├── styles.css       ← identidad visual
│   └── app.js           ← chat, historial, carga y errores
├── server.js            ← Express + llamada a Gemini (la clave solo vive aquí)
├── .env.example         ← plantilla de configuración
├── package.json
└── .gitignore
```

## Instalación (Visual Studio Code)

1. Instala **Node.js 18 o superior** (https://nodejs.org). Verifica con `node -v`.
2. Abre la carpeta del proyecto: *Archivo → Abrir carpeta*.
3. Abre la terminal (`Ctrl + ñ` o *Terminal → Nueva terminal*) y ejecuta:
   ```bash
   npm install
   ```
4. Consigue tu clave gratuita en https://aistudio.google.com/apikey.
5. Copia `.env.example` como `.env` y pega la clave en `GEMINI_API_KEY`.
6. Inicia el servidor:
   ```bash
   npm run dev      # reinicia solo al cambiar server.js
   # o: npm start
   ```
7. Abre http://localhost:3000.

## Cambiar de museo

Edita `data/museo.json` (o crea otro archivo en `data/` y pon su nombre en `MUSEO_FILE` del `.env`). Mantén los campos `museo`, `salas`, `piezas`, `exposiciones` y `preguntasSugeridas`; cada pieza referencia su sala con `sala` (el `id` de la sala). No se toca ni el HTML, ni el CSS, ni el JS. El archivo se lee en cada petición, así que no hace falta reiniciar.

> Los datos incluidos (Museo del Oro) son **de ejemplo**: verifícalos con fuentes oficiales antes de presentar.

## Cómo cumple el documento de requerimientos

| Requerimiento | Dónde |
|---|---|
| RF-01 a RF-03, RF-06 | Pantalla de bienvenida, formulario y conversación continua (`app.js`) |
| RF-04, RF-05 | `POST /api/chat` → Gemini (`server.js`) |
| RF-07, RF-08 | Panel «Explorar el museo» y consultas al JSON |
| RF-09 | Preguntas sugeridas y botón de curiosidades |
| RF-10, RNF-10 | Regla «no inventar» en el prompt y mensajes de error con «Reintentar» |
| RNF-03 | Diseño responsive (panel tipo cajón en celulares) |
| RNF-07, RNF-09 | Contenido separado en JSON |
| RNF-08 | La clave nunca llega al navegador; no se guardan conversaciones en el servidor |

## Problemas frecuentes

- **«Falta la clave GEMINI_API_KEY»**: el archivo `.env` no existe o está mal ubicado (debe estar junto a `server.js`). Reinicia el servidor tras crearlo.
- **«El servicio de IA rechazó la solicitud»**: clave incorrecta o modelo no disponible; prueba otro valor en `GEMINI_MODEL`.
- **Error de cuota (429)**: espera unos minutos; el plan gratuito tiene límites.
