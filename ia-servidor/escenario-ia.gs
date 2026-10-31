// Servidor de la IA para «Escenario Diario» (practicar hablar en público).
// La app manda la conversación ya armada (instrucciones + discurso + lo que dijiste); aquí se revisa
// la contraseña de la app, se le pasa a Claude (Anthropic) con TU clave de API y se devuelve el texto.
// La clave nunca sale de aquí: el celular solo conoce la contraseña de la app.
// Se pega en Extensiones → Apps Script de una hoja nueva y se implementa como "Aplicación web"
// (ejecutar como: yo; acceso: cualquier persona). Los pasos están en ia-servidor/LEEME.md.
// Mismo contrato que tendrá el servidor de Railway: { clave, tipo, tarea, mensajes, max } → { ok, texto }.
// Calificar un video (voz, cuerpo y lo que dijiste) va con Gemini de Google, que sí ve y escucha video:
// { clave, tipo: "video", mime, video (base64), prompt } → { ok, texto }. Usa tu clave de Google AI Studio.

// Haiku: el más barato. Si las calificaciones o los discursos no te convencen, cambia a "claude-sonnet-5-5".
const MODELO = "claude-haiku-5-5";
// Precio de Haiku 5.5 en dólares por millón de tokens (entrada, salida), para la pestaña «Uso».
const PRECIO = [0.10, 0.50];
// Gemini para el video. Precio estándar en dólares por millón de tokens (entrada, salida) hasta el 31-12-2026;
// desde 2027 sube a 1.50 / 7.50. Con la capa gratis no se cobra.
const MODELO_VIDEO = "gemini-3.8-flash";
const PRECIO_VIDEO = [0.75, 3.75];
const HOJA = "Uso";
const TITULOS = ["Fecha", "Tarea", "Tokens entrada", "Tokens salida", "Costo (USD)"];

// ---------- menú de la hoja ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Escenario IA")
    .addItem("Guardar clave de Anthropic", "guardarClaveAnthropic")
    .addItem("Guardar clave de Gemini (video)", "guardarClaveGemini")
    .addItem("Guardar contraseña de la app", "guardarContrasena")
    .addToUi();
}
function guardarClaveAnthropic() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Clave de API de Anthropic", "Pega la clave «Escenario» (empieza con sk-ant-). Queda guardada en el script, no en la hoja.", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const k = r.getResponseText().trim();
  if (!/^sk-ant-/.test(k)) return ui.alert("Esa no parece una clave de Anthropic (debe empezar con sk-ant-).");
  PropertiesService.getScriptProperties().setProperty("ANTHROPIC_API_KEY", k);
  ui.alert("Clave guardada.");
}
function guardarClaveGemini() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Clave de API de Gemini", "Pega la clave de Google AI Studio (aistudio.google.com → Get API key; empieza con AQ. o AIza). Queda guardada en el script, no en la hoja.", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const k = r.getResponseText().trim();
  // Las claves viejas empiezan con AIza; las nuevas de AI Studio con AQ.
  if (!/^(AIza|AQ\.)/.test(k) || k.length < 20) return ui.alert("Esa no parece una clave de Gemini (empieza con AQ. o con AIza).");
  PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY", k);
  ui.alert("Clave de Gemini guardada.");
}
function guardarContrasena() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Contraseña de la app", "Invéntala (por ejemplo una frase corta). La escribirás una vez en la app, en Inicio → Conecta la IA.", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const k = r.getResponseText().trim();
  if (k.length < 6) return ui.alert("Usa al menos 6 letras o números.");
  PropertiesService.getScriptProperties().setProperty("APP_CLAVE", k);
  ui.alert("Contraseña guardada.");
}

// ---------- llamada a Claude ----------
// Solo turnos user/assistant, que empiecen y terminen en user, con límites para que nadie gaste de más.
function mensajes_(lista) {
  const m = (Array.isArray(lista) ? lista : []).slice(-30)
    .filter(x => x && (x.role === "user" || x.role === "assistant") && String(x.content || "").trim())
    .map(x => ({ role: x.role, content: String(x.content).slice(0, 15000) }));
  while (m.length && m[0].role !== "user") m.shift();
  if (!m.length || m[m.length - 1].role !== "user") return null;
  if (m.reduce((a, x) => a + x.content.length, 0) > 60000) return null;
  return m;
}

function claude_(mensajes, max) {
  const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, error: "sin-clave-api" };
  const cuerpo = {
    // Haiku 5.5 piensa por defecto y ese pensamiento gasta max_tokens: con textos largos (unir historia y discurso)
    // se comía todo y la respuesta llegaba vacía o cortada. Para esta app no hace falta pensar.
    model: MODELO, max_tokens: Math.min(Math.max(Number(max) || 1500, 200), 6000),
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    messages: mensajes,
  };
  const r = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2026-10-21" },
    payload: JSON.stringify(cuerpo),
  });
  const code = r.getResponseCode(), j = JSON.parse(r.getContentText() || "{}");
  if (code === 401 || code === 403) return { ok: false, error: "clave-api" };
  if (code === 429 || /credit|balance/i.test(((j.error || {}).message) || "")) return { ok: false, error: "saldo" };
  if (code !== 200) return { ok: false, error: "api", detalle: code + " " + ((j.error || {}).message || "") };
  if (j.stop_reason === "refusal") return { ok: false, error: "rechazo" };
  const texto = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (!texto) return { ok: false, error: "vacio" };
  if (j.stop_reason === "max_tokens") return { ok: false, error: "corto" };
  return { ok: true, texto: texto, uso: j.usage };
}

// ---------- calificar video con Gemini ----------
// Videos chicos van dentro del pedido; si pesan más de ~14 MB se suben antes con la Files API.
const GEMINI = "https://generativelanguage.googleapis.com";
function gemini_(q) {
  const key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!key) return { ok: false, error: "sin-clave-gemini" };
  const mime = /^video\/(mp4|webm|3gpp|quicktime)/.test(String(q.mime || "")) ? String(q.mime).split(";")[0] : "video/webm";
  const b64 = String(q.video || ""), prompt = String(q.prompt || "").slice(0, 12000);
  if (!b64 || !prompt) return { ok: false, error: "pedido" };
  if (b64.length > 48e6) return { ok: false, error: "video-grande" };
  let parte;
  if (b64.length < 14e6) parte = { inline_data: { mime_type: mime, data: b64 } };
  else {
    const f = subirArchivo_(key, Utilities.newBlob(Utilities.base64Decode(b64), mime, "practica"));
    if (!f.ok) return f;
    parte = { file_data: { mime_type: mime, file_uri: f.uri } };
  }
  const base = { contents: [{ role: "user", parts: [parte, { text: prompt }] }] };
  // Pensar poco, resolución baja (más barato; para postura y gestos alcanza) y respuesta en JSON.
  // Si la API no reconoce alguna opción, se vuelve a pedir sin opciones.
  const extra = { generationConfig: { responseMimeType: "application/json", mediaResolution: "MEDIA_RESOLUTION_LOW", thinkingConfig: { thinkingLevel: "minimal" }, maxOutputTokens: 4000 } };
  // Cada paso deja su tiempo en Ejecuciones (toca la fila para ver los registros).
  console.log("video: " + Math.round(b64.length * 0.75 / 1e3) + " KB, " + mime + (parte.file_data ? ", subido con Files API" : ", directo"));
  let r = pedirGemini_(key, Object.assign({}, base, extra));
  if (!r.ok && r.error === "api" && /400/.test(r.detalle || "")) {
    // Primero se quita solo la resolución; pensar poco se mantiene porque sin eso tarda mucho más.
    r = pedirGemini_(key, Object.assign({}, base, { generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" } } }));
    if (!r.ok && r.error === "api" && /400/.test(r.detalle || "")) r = pedirGemini_(key, base);
  }
  return r;
}
function pedirGemini_(key, cuerpo) {
  const t0 = Date.now();
  const r = UrlFetchApp.fetch(GEMINI + "/v1beta/models/" + MODELO_VIDEO + ":generateContent", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-goog-api-key": key }, payload: JSON.stringify(cuerpo),
  });
  const code = r.getResponseCode(), j = JSON.parse(r.getContentText() || "{}"), msg = ((j.error || {}).message) || "";
  const u0 = j.usageMetadata || {}, c0 = (j.candidates || [])[0] || {};
  console.log("Gemini " + code + " en " + Math.round((Date.now() - t0) / 1000) + " s" + (cuerpo.generationConfig ? " (config: " + JSON.stringify(cuerpo.generationConfig.thinkingConfig || {}) + ")" : " (sin config)") +
    " · entrada " + (u0.promptTokenCount || 0) + ", pensar " + (u0.thoughtsTokenCount || 0) + ", salida " + (u0.candidatesTokenCount || 0) + " tokens · fin " + (c0.finishReason || "-") + (msg ? " · " + msg.slice(0, 300) : ""));
  if (code === 401 || code === 403 || /API key/i.test(msg)) return { ok: false, error: "gemini-clave" };
  if (code === 429) return { ok: false, error: "gemini-limite" };
  if (code !== 200) return { ok: false, error: "api", detalle: code + " " + msg };
  const c = (j.candidates || [])[0] || {};
  const texto = ((c.content || {}).parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("");
  if (!texto) return { ok: false, error: c.finishReason === "SAFETY" ? "rechazo" : "vacio" };
  if (c.finishReason === "MAX_TOKENS") return { ok: false, error: "corto" };
  const u = j.usageMetadata || {};
  return { ok: true, texto: texto, uso: { input_tokens: u.promptTokenCount || 0, output_tokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
}
// Subida reanudable: se pide una dirección, se mandan los bytes y se espera a que Google termine de procesar el video.
function subirArchivo_(key, blob) {
  const ini = UrlFetchApp.fetch(GEMINI + "/upload/v1beta/files", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-goog-api-key": key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(blob.getBytes().length), "X-Goog-Upload-Header-Content-Type": blob.getContentType() },
    payload: JSON.stringify({ file: { display_name: "practica" } }),
  });
  const h = ini.getAllHeaders(), url = h["x-goog-upload-url"] || h["X-Goog-Upload-URL"];
  if (!url) return { ok: false, error: "api", detalle: "subida " + ini.getResponseCode() + " " + ini.getContentText().slice(0, 200) };
  const sub = UrlFetchApp.fetch(url, { method: "post", muteHttpExceptions: true, contentType: blob.getContentType(),
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, payload: blob.getBytes() });
  let f = (JSON.parse(sub.getContentText() || "{}").file) || {};
  for (let i = 0; i < 30 && f.name && f.state === "PROCESSING"; i++) {
    Utilities.sleep(2000);
    f = JSON.parse(UrlFetchApp.fetch(GEMINI + "/v1beta/" + f.name, { headers: { "x-goog-api-key": key }, muteHttpExceptions: true }).getContentText() || "{}");
  }
  if (!f.uri || f.state === "FAILED") return { ok: false, error: "api", detalle: "el video no se pudo procesar" };
  return { ok: true, uri: f.uri };
}

function anotar_(tarea, uso, precio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA);
  if (!h) { h = ss.insertSheet(HOJA); h.appendRow(TITULOS); h.setFrozenRows(1); }
  const e = (uso && uso.input_tokens) || 0, s = (uso && uso.output_tokens) || 0;
  const pr = precio || PRECIO;
  h.appendRow([new Date(), tarea, e, s, (e * pr[0] + s * pr[1]) / 1e6]);
}

// ---------- aplicación web ----------
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({ ok: true, servicio: "escenario-ia" }); }
// El celular manda { clave, tipo: "probar" | "ia", tarea: "calificar" | "conversar" | "armar", mensajes, max }
// o { clave, tipo: "video", mime, video, prompt } para calificar un video con Gemini.
function doPost(e) {
  try {
    const q = JSON.parse(e.postData.contents);
    const clave = PropertiesService.getScriptProperties().getProperty("APP_CLAVE");
    if (!clave || String(q.clave || "") !== clave) return json_({ ok: false, error: "contraseña" });
    if (q.tipo === "probar") return json_({ ok: true, video: !!PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") });
    if (q.tipo === "video") {
      const v = gemini_(q);
      if (v.ok) anotar_("video (Gemini)", v.uso, PRECIO_VIDEO);
      delete v.uso;
      return json_(v);
    }
    const m = mensajes_(q.mensajes);
    if (!m) return json_({ ok: false, error: "pedido" });
    const r = claude_(m, q.max);
    if (r.ok) anotar_(String(q.tarea || "").slice(0, 30), r.uso);
    delete r.uso;
    return json_(r);
  } catch (err) {
    return json_({ ok: false, error: "servidor", detalle: String(err) });
  }
}
