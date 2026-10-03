/**
 * =============================================================================
 * SCRIPT: js/app.js
 * CONSULTA DE IMÁGENES DE LA NASA - JAVASCRIPT NATIVO
 * Copyright (c) [2025] [René Peña Martínez]. Licensed under CC BY 4.0.
 * Full license text available at https://creativecommons.org/licenses/by/4.0/
 * =============================================================================
 *
 * GUÍA TÉCNICA:
 * 1. Manipulación de elementos del DOM mediante document.getElementById.
 * 2. Manejo de eventos (submit, input, click) y delegación de eventos.
 * 3. Consumo del servicio web con la API nativa fetch() y async / await.
 * 4. Control de excepciones mediante bloques try / catch / finally.
 * 5. Cancelación de peticiones anteriores con AbortController.
 * 6. Procesamiento de la estructura de datos JSON provista por la NASA.
 * 7. Generación dinámica de nodos HTML con escape de seguridad.
 * =============================================================================
 */

'use strict';

// 1. Configuración del servicio REST oficial
const NASA_BASE_URL = 'https://images-api.nasa.gov/search';
const MAX_RESULTADOS = 36;
const CONSULTA_INICIAL = 'planets';

// 2. Referencias a los elementos de la interfaz de usuario
const searchForm = document.getElementById('searchForm');
const queryInput = document.getElementById('queryInput');
const btnSubmit = document.getElementById('btnSubmit');
const queryPreviewText = document.getElementById('queryPreviewText');
const apiEndpointUrl = document.getElementById('apiEndpointUrl');
const statusContainer = document.getElementById('statusContainer');
const statusMessage = document.getElementById('statusMessage');
const resultsGrid = document.getElementById('resultsGrid');
const resultsCount = document.getElementById('resultsCount');
const quickOptions = document.getElementById('quickOptions');

// Elementos de la ventana modal
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalMeta = document.getElementById('modalMeta');
const modalDescription = document.getElementById('modalDescription');
const closeModalBtn = document.getElementById('closeModalBtn');

// Variables en memoria
let currentResults = [];      // Registros que realmente se muestran en pantalla
let controladorActual = null; // Permite cancelar la petición anterior

/**
 * Construye la URL del endpoint para un término de búsqueda
 */
function construirEndpoint(query) {
  return `${NASA_BASE_URL}?q=${encodeURIComponent(query)}&media_type=image`;
}

/**
 * Actualiza la confirmación en pantalla del término que se procesará
 */
function actualizarVistaPreviaQuery(query) {
  const cleanQuery = query.trim() || CONSULTA_INICIAL;
  queryPreviewText.textContent = `"${cleanQuery}"`;
  apiEndpointUrl.textContent = construirEndpoint(cleanQuery);
}

/**
 * Marca como activo el botón de categoría que coincide con la consulta
 * (si el usuario escribe algo distinto, ninguno queda activo)
 */
function sincronizarBotonActivo(query) {
  const valor = query.trim().toLowerCase();
  document.querySelectorAll('.btn-category').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.query === valor);
  });
}

/**
 * Realiza la solicitud HTTP GET asíncrona al servicio de la NASA
 * @param {string} searchKeyword - Criterio de búsqueda
 */
async function consultarNasaApi(searchKeyword) {
  const query = searchKeyword.trim();
  if (!query) {
    alert('Ingrese un término válido antes de realizar la consulta.');
    queryInput.focus();
    return;
  }

  // Si había una petición en curso, se cancela para evitar resultados mezclados
  if (controladorActual) {
    controladorActual.abort();
  }
  const controlador = new AbortController();
  controladorActual = controlador;

  // Notificar al usuario el inicio de la solicitud
  mostrarCargando(true, `Consultando servidores de la NASA para "${query}"...`);
  resultsGrid.innerHTML = '';
  resultsCount.textContent = 'Buscando...';
  currentResults = [];

  try {
    // Llamada HTTP con fetch() sin bloquear el hilo principal
    const response = await fetch(construirEndpoint(query), { signal: controlador.signal });

    if (!response.ok) {
      throw new Error(`Respuesta del servidor: HTTP ${response.status} ${response.statusText}`.trim());
    }

    // Conversión a objeto JavaScript
    const json = await response.json();
    const items = json.collection?.items || [];
    const totalServidor = json.collection?.metadata?.total_hits ?? items.length;

    // Renderizar resultados en la página
    mostrarResultados(items, query, totalServidor);

  } catch (error) {
    // Una cancelación intencional no es un error para el usuario
    if (error.name === 'AbortError') return;

    console.error('Error en la petición HTTP:', error);
    mostrarError(`No se pudo consultar la API: ${error.message}. Compruebe la conexión de red e intente de nuevo.`);
  } finally {
    // Solo la petición más reciente apaga el indicador de carga
    if (controladorActual === controlador) {
      mostrarCargando(false);
      controladorActual = null;
    }
  }
}

/**
 * Inserta las tarjetas de imágenes en el contenedor de resultados
 */
function mostrarResultados(items, query, totalServidor) {
  resultsGrid.innerHTML = '';

  // Solo se conservan los registros que tienen imagen de vista previa
  currentResults = items
    .filter((item) => item.links && item.links[0] && item.links[0].href)
    .slice(0, MAX_RESULTADOS);

  if (currentResults.length === 0) {
    resultsCount.textContent = '0 imágenes encontradas';
    resultsGrid.innerHTML = `
      <div class="grid-message empty">
        <p><strong>No se encontraron registros para "${escaparHtml(query)}"</strong></p>
        <p>Sugerencia: ingrese términos en inglés como Jupiter, Saturn, Mars, Hubble o Apollo.</p>
      </div>
    `;
    return;
  }

  resultsCount.textContent =
    `Mostrando ${currentResults.length} de ${Number(totalServidor).toLocaleString('es-MX')} imágenes encontradas`;

  const fragmento = document.createDocumentFragment();

  currentResults.forEach((item, index) => {
    const data = obtenerDatos(item);
    const title = data.title || 'Registro de la NASA';
    const description = data.description || 'Sin descripción provista en el archivo oficial.';
    const nasaId = data.nasa_id || 'N/A';
    const previewLink = item.links[0].href;

    const card = document.createElement('article');
    card.className = 'card-item';
    card.innerHTML = `
      <div class="card-image-box">
        <img
          src="${escaparHtml(previewLink)}"
          alt="${escaparHtml(title)}"
          loading="lazy"
          data-index="${index}"
        >
        <span class="card-id-tag" title="${escaparHtml(nasaId)}">${escaparHtml(nasaId)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escaparHtml(title)}</h3>
        <div class="card-date">Fecha: ${escaparHtml(formatearFecha(data.date_created))}</div>
        <p class="card-description">${escaparHtml(limpiarTexto(description))}</p>
        <div class="card-footer">
          <button type="button" class="btn-detail" data-index="${index}">
            Ver detalle completo
          </button>
        </div>
      </div>
    `;

    fragmento.appendChild(card);
  });

  resultsGrid.appendChild(fragmento);
}

/**
 * Abre el diálogo con la imagen ampliada y la descripción completa
 */
function abrirModal(index) {
  const item = currentResults[index];
  if (!item) return;

  const data = obtenerDatos(item);
  const thumbLink = item.links && item.links[0] ? item.links[0].href : '';

  modalTitle.textContent = data.title || 'Detalle del registro';
  modalDescription.textContent = limpiarTexto(data.description) || 'Sin descripción disponible.';

  const partesMeta = [`Fecha: ${formatearFecha(data.date_created)}`];
  if (data.nasa_id) partesMeta.push(`ID NASA: ${data.nasa_id}`);
  if (data.center) partesMeta.push(`Centro: ${data.center}`);
  modalMeta.textContent = partesMeta.join(' | ');

  // Se intenta cargar una versión de mayor resolución; si no existe, se usa la miniatura
  modalImage.alt = data.title || 'Vista previa';
  modalImage.onerror = () => {
    modalImage.onerror = null;
    modalImage.src = thumbLink;
  };
  modalImage.src = thumbLink.includes('~thumb')
    ? thumbLink.replace('~thumb', '~medium')
    : thumbLink;

  if (typeof imageModal.showModal === 'function') {
    imageModal.showModal();
  } else {
    imageModal.setAttribute('open', '');
  }
}

function cerrarModal() {
  if (typeof imageModal.close === 'function') {
    imageModal.close();
  } else {
    imageModal.removeAttribute('open');
  }
}

// ----------------------------------------------------------------------------
// Eventos
// ----------------------------------------------------------------------------

// Delegación: un solo listener para las imágenes y botones de todas las tarjetas
resultsGrid.addEventListener('click', (event) => {
  const objetivo = event.target.closest('[data-index]');
  if (!objetivo) return;
  abrirModal(Number(objetivo.dataset.index));
});

closeModalBtn.addEventListener('click', cerrarModal);

// Cerrar el modal al hacer clic fuera del contenido (sobre el fondo oscuro)
imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal) cerrarModal();
});

// Limpiar la imagen al cerrar para que no aparezca la anterior en la siguiente apertura
imageModal.addEventListener('close', () => {
  modalImage.removeAttribute('src');
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sincronizarBotonActivo(queryInput.value);
  consultarNasaApi(queryInput.value);
});

queryInput.addEventListener('input', () => {
  actualizarVistaPreviaQuery(queryInput.value);
  sincronizarBotonActivo(queryInput.value);
});

quickOptions.addEventListener('click', (event) => {
  const button = event.target.closest('.btn-category');
  if (!button) return;

  const selectedQuery = button.dataset.query;
  queryInput.value = selectedQuery;
  sincronizarBotonActivo(selectedQuery);
  actualizarVistaPreviaQuery(selectedQuery);
  consultarNasaApi(selectedQuery);
});

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------

function obtenerDatos(item) {
  return item.data && item.data[0] ? item.data[0] : {};
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return 'Fecha no especificada';
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no especificada';
  return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Algunas descripciones de la NASA traen etiquetas HTML (<a>, <br>, etc.).
 * Se convierten a texto plano para mostrarlas de forma segura y legible.
 */
function limpiarTexto(texto) {
  if (!texto) return '';
  // DOMParser crea un documento inerte: no ejecuta scripts ni carga imágenes
  const html = String(texto).replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
}

function mostrarCargando(isLoading, message = '') {
  statusContainer.hidden = !isLoading;
  btnSubmit.disabled = isLoading;
  btnSubmit.textContent = isLoading ? 'Procesando...' : 'Procesar Solicitud';
  if (isLoading) statusMessage.textContent = message;
}

function mostrarError(errorMessage) {
  resultsGrid.innerHTML = `
    <div class="grid-message error">
      <p><strong>Error en la consulta</strong></p>
      <p>${escaparHtml(errorMessage)}</p>
    </div>
  `;
  resultsCount.textContent = 'Error';
}

function escaparHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ----------------------------------------------------------------------------
// Carga inicial (el script está al final del <body>, el DOM ya existe)
// ----------------------------------------------------------------------------
actualizarVistaPreviaQuery(queryInput.value);
sincronizarBotonActivo(queryInput.value);
consultarNasaApi(queryInput.value || CONSULTA_INICIAL);
