require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

const MUSEO_PATH = path.join(
  __dirname,
  'data',
  process.env.MUSEO_FILE || 'museo.json'
);

const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const cargarMuseo = () =>
  JSON.parse(fs.readFileSync(MUSEO_PATH, 'utf8'));

function construirInstrucciones(datos) {
  return `Eres el asistente virtual de "${datos.museo.nombre}".

Tu función es ayudar a los visitantes a conocer las obras, piezas, salas y exposiciones del museo.

REGLAS:
1. Responde utilizando únicamente la información del museo.
2. No inventes datos, fechas, autores ni información.
3. Si no tienes información suficiente, indícalo amablemente.
4. Responde en español, con un tono natural y cercano.
5. Mantén el contexto de la conversación.
6. Responde de forma breve, con un máximo de 150 palabras.
7. Si preguntan por curiosidades, utiliza las registradas en el museo.
8. Si preguntan algo que no tiene relación con el museo, redirige la conversación amablemente.

INFORMACIÓN DEL MUSEO:
${JSON.stringify(datos)}`;
}

app.get('/api/museo', (req, res) => {
  try {
    const datos = cargarMuseo();
    res.json(datos);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      error: 'museo',
      message: 'No se pudo cargar la información del museo.'
    });
  }
});

const visitas = new Map();

function limitar(req, res, next) {
  const ahora = Date.now();

  const lista = (visitas.get(req.ip) || [])
    .filter(t => ahora - t < 60000);

  if (lista.length >= 20) {
    return res.status(429).json({
      error: 'limite',
      message: 'Has realizado demasiadas preguntas. Intenta nuevamente en un momento.'
    });
  }

  lista.push(ahora);
  visitas.set(req.ip, lista);

  next();
}

app.post('/api/chat', limitar, async (req, res) => {

  if (!API_KEY) {
    return res.status(500).json({
      error: 'config',
      message: 'Falta configurar GROQ_API_KEY en el archivo .env.'
    });
  }

  const historial = (
    Array.isArray(req.body.messages)
      ? req.body.messages
      : []
  )
    .filter(m =>
      m &&
      (m.role === 'user' || m.role === 'model') &&
      typeof m.text === 'string' &&
      m.text.trim()
    )
    .slice(-8)
    .map(m => ({
      role: m.role === 'model'
        ? 'assistant'
        : 'user',
      content: m.text.slice(0, 1200)
    }));

  while (
    historial.length &&
    historial[0].role !== 'user'
  ) {
    historial.shift();
  }

  if (
    !historial.length ||
    historial[historial.length - 1].role !== 'user'
  ) {
    return res.status(400).json({
      error: 'peticion',
      message: 'Escribe una pregunta.'
    });
  }

  try {
    const datos = cargarMuseo();

    const respuesta = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`
        },

        body: JSON.stringify({
          model: MODEL,

          messages: [
            {
              role: 'system',
              content: construirInstrucciones(datos)
            },
            ...historial
          ],

          temperature: 0.3,

          max_completion_tokens: 500,

          ...(MODEL.startsWith('qwen/')
            ? { reasoning_effort: 'none' }
            : MODEL.startsWith('openai/gpt-oss-')
            ? { reasoning_effort: 'low' }
            : {})
        }),

        signal: AbortSignal.timeout(15000)
      }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text();

      console.error(
        `Groq respondió ${respuesta.status}:`,
        detalle
      );

      return res.status(502).json({
        error: 'ia',
        message: 'No se pudo obtener una respuesta de la IA. Revisa la terminal.'
      });
    }

    const resultado = await respuesta.json();

    const texto =
      resultado.choices?.[0]?.message?.content?.trim();

    if (!texto) {
      return res.status(502).json({
        error: 'vacia',
        message: 'No se generó una respuesta. Intenta nuevamente.'
      });
    }

    res.json({
      reply: texto
    });

  } catch (error) {

    console.error(
      'Error llamando a Groq:',
      error.message
    );

    if (error.name === 'TimeoutError') {
      return res.status(504).json({
        error: 'timeout',
        message: 'La IA tardó demasiado en responder. Intenta nuevamente.'
      });
    }

    res.status(502).json({
      error: 'red',
      message: 'No se pudo conectar con la inteligencia artificial.'
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Asistente IA para Museos en http://localhost:${PORT}`
  );

  console.log(`Modelo utilizado: ${MODEL}`);

  if (!API_KEY) {
    console.warn('Falta configurar GROQ_API_KEY');
  }
});