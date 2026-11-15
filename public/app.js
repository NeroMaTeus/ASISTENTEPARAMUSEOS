const $ = (s) => document.querySelector(s);
const mensajesEl = $('#mensajes'), form = $('#form'), entrada = $('#entrada'), btnEnviar = $('#enviar'), panel = $('#panel');

let museo = null;
let historial = [];   // [{role:'user'|'model', text}]
let ocupado = false;

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Convierte el texto de la IA (negrita, cursiva y listas) en HTML seguro
function md(texto) {
  const inline = (s) => escapar(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>');
  let html = '', lista = false;
  for (const linea of texto.split('\n')) {
    const item = linea.match(/^\s*[-*•]\s+(.*)/);
    if (item) { if (!lista) { html += '<ul>'; lista = true; } html += `<li>${inline(item[1])}</li>`; }
    else { if (lista) { html += '</ul>'; lista = false; } if (linea.trim()) html += `<p>${inline(linea)}</p>`; }
  }
  return html + (lista ? '</ul>' : '');
}

function bajar() { mensajesEl.scrollTop = mensajesEl.scrollHeight; }

function pintarBienvenida() {
  mensajesEl.innerHTML = '';
  const c = document.createElement('section');
  c.className = 'cartela';
  c.innerHTML = `<div class="cartela-in">
    <h1>Asistente IA para Museos</h1>
    <p class="museo">${escapar(museo.museo.nombre)} · ${escapar(museo.museo.ciudad)}</p>
    <p class="desc">${escapar(museo.museo.descripcion)}</p>
    <div class="chips"></div></div>`;
  const chips = c.querySelector('.chips');
  (museo.preguntasSugeridas || []).forEach((q) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.textContent = q;
    b.onclick = () => enviar(q);
    chips.appendChild(b);
  });
  mensajesEl.appendChild(c);
}

function agregarMensaje(tipo, texto) {
  const d = document.createElement('div');
  d.className = `msg ${tipo}`;
  if (tipo === 'user') d.innerHTML = `<div class="txt">${escapar(texto)}</div>`;
  else d.innerHTML = `<div class="avatar" aria-hidden="true">M</div><div class="txt">${tipo === 'error' ? `<p>${escapar(texto)}</p>` : md(texto)}</div>`;
  mensajesEl.appendChild(d);
  bajar();
  return d;
}

function agregarCarga() {
  const d = document.createElement('div');
  d.className = 'msg ia';
  d.innerHTML = '<div class="avatar" aria-hidden="true">M</div><div class="puntos" role="status" aria-label="El asistente está escribiendo"><span></span><span></span><span></span></div>';
  mensajesEl.appendChild(d); bajar();
  return d;
}

function bloquear(v) { ocupado = v; entrada.disabled = v; btnEnviar.disabled = v; if (!v) entrada.focus(); }

async function pedirRespuesta() {
  bloquear(true);
  const carga = agregarCarga();
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: historial })
    });
    const data = await r.json().catch(() => ({}));
    carga.remove();
    if (!r.ok) throw new Error(data.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    historial.push({ role: 'model', text: data.reply });
    agregarMensaje('ia', data.reply);
  } catch (e) {
    carga.remove();
    const msg = e instanceof TypeError ? 'No se pudo conectar con el servidor. Verifica que esté en ejecución y tu conexión.' : e.message;
    const err = agregarMensaje('error', msg);
    const b = document.createElement('button');
    b.className = 'reintentar'; b.type = 'button'; b.textContent = 'Reintentar';
    b.onclick = () => { err.remove(); pedirRespuesta(); };
    err.querySelector('.txt').appendChild(b);
  } finally {
    bloquear(false);
  }
}

function enviar(texto) {
  texto = texto.trim();
  if (!texto || ocupado) return;
  if (!historial.length) mensajesEl.innerHTML = '';
  // Si el último turno quedó sin respuesta (error), se fusiona para mantener turnos alternados
  const ultimo = historial[historial.length - 1];
  if (ultimo && ultimo.role === 'user') ultimo.text += '\n' + texto;
  else historial.push({ role: 'user', text: texto });
  agregarMensaje('user', texto);
  panel.classList.remove('abierto');
  $('#btnPanel').setAttribute('aria-expanded', 'false');
  pedirRespuesta();
}

function pintarPanel() {
  const cont = $('#salas');
  museo.salas.forEach((s) => {
    const d = document.createElement('details');
    d.innerHTML = `<summary>${escapar(s.nombre)}</summary><p class="sala-desc">${escapar(s.descripcion)}</p>`;
    const preguntaSala = document.createElement('button');
    preguntaSala.className = 'pieza'; preguntaSala.type = 'button';
    preguntaSala.textContent = 'Ver qué hay en esta sala';
    preguntaSala.onclick = () => enviar(`¿Qué piezas hay en la ${s.nombre}?`);
    d.appendChild(preguntaSala);
    museo.piezas.filter((p) => p.sala === s.id).forEach((p) => {
      const b = document.createElement('button');
      b.className = 'pieza'; b.type = 'button'; b.textContent = p.nombre;
      b.onclick = () => enviar(`Cuéntame sobre ${p.nombre}`);
      d.appendChild(b);
    });
    cont.appendChild(d);
  });
}

form.addEventListener('submit', (e) => { e.preventDefault(); const t = entrada.value; entrada.value = ''; enviar(t); });
$('#btnNueva').onclick = () => { if (ocupado) return; historial = []; pintarBienvenida(); };
$('#btnPanel').onclick = () => { const a = panel.classList.toggle('abierto'); $('#btnPanel').setAttribute('aria-expanded', a); };
$('#btnCuriosidad').onclick = () => {
  const p = museo.piezas[Math.floor(Math.random() * museo.piezas.length)];
  enviar(`Cuéntame una curiosidad sobre ${p.nombre}`);
};

(async function iniciar() {
  try {
    const r = await fetch('/api/museo');
    if (!r.ok) throw new Error();
    museo = await r.json();
    document.title = `${museo.museo.nombre} · Asistente IA`;
    $('#brand').textContent = museo.museo.nombre;
    pintarPanel();
    pintarBienvenida();
  } catch {
    agregarMensaje('error', 'No se pudo cargar la información del museo. Revisa que el servidor esté en ejecución y que data/museo.json sea válido.');
    bloquear(true);
  }
})();

