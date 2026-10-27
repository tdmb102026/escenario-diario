// Servidor de la IA para «Escenario Diario» (practicar hablar en público).
// La app manda la conversación ya armada (instrucciones + discurso + lo que dijiste); aquí se revisa
// la contraseña de la app, se le pasa a Claude (Anthropic) con TU clave de API y se devuelve el texto.
// La clave nunca sale de aquí: el celular solo conoce la contraseña de la app.
// Se pega en Extensiones → Apps Script de una hoja nueva y se implementa como "Aplicación web"
// (ejecutar como: yo; acceso: cualquier persona). Los pasos están en ia-servidor/LEEME.md.
// Mismo contrato que tendrá el servidor de Railway: { clave, tipo, tarea, mensajes, max } → { ok, texto }.

// Haiku: el más barato. Si las calificaciones o los discursos no te convencen, cambia a "claude-sonnet-5-5".
const MODELO = "claude-haiku-5-5";
// Precio de Haiku 5.5 en dólares por millón de tokens (entrada, salida), para la pestaña «Uso».
const PRECIO = [0.10, 0.50];
const HOJA = "Uso";
const TITULOS = ["Fecha", "Tarea", "Tokens entrada", "Tokens salida", "Costo (USD)"];

// ---------- menú de la hoja ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Escenario IA")
    .addItem("Guardar clave de Anthropic", "guardarClaveAnthropic")
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
    model: MODELO, max_tokens: Math.min(Math.max(Number(max) || 1500, 200), 3000),
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
  return { ok: true, texto: texto, uso: j.usage };
}

function anotar_(tarea, uso) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA);
  if (!h) { h = ss.insertSheet(HOJA); h.appendRow(TITULOS); h.setFrozenRows(1); }
  const e = (uso && uso.input_tokens) || 0, s = (uso && uso.output_tokens) || 0;
  h.appendRow([new Date(), tarea, e, s, (e * PRECIO[0] + s * PRECIO[1]) / 1e6]);
}

// ---------- aplicación web ----------
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({ ok: true, servicio: "escenario-ia" }); }
// El celular manda { clave, tipo: "probar" | "ia", tarea: "calificar" | "conversar" | "armar", mensajes, max }
function doPost(e) {
  try {
    const q = JSON.parse(e.postData.contents);
    const clave = PropertiesService.getScriptProperties().getProperty("APP_CLAVE");
    if (!clave || String(q.clave || "") !== clave) return json_({ ok: false, error: "contraseña" });
    if (q.tipo === "probar") return json_({ ok: true });
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
