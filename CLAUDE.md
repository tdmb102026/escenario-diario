# Notas para Claude

- Dueño: fer (GitHub `tdmb102026`). Escribe en español; responde en español sencillo.
- App web estática en un solo `index.html` (HTML, CSS y JavaScript sin librerías), publicada con GitHub Pages desde `main` / root: https://tdmb102026.github.io/escenario-diario/
- Nació como artefacto de Claude; `index.html` sigue funcionando como artefacto: si existe `window.claude`, la IA usa `claude.use("sample")`; si no, el servidor de fer (`IA` y `servidor()` en index.html).
- IA: la app arma los prompts y manda `{ clave, tipo: "probar" | "ia", tarea, mensajes, max }` al Apps Script (`ia-servidor/escenario-ia.gs`), que responde `{ ok, texto }` con Claude Haiku 5.5 y la clave de API de fer. Nunca poner claves en el repo ni pedirlas en el chat. Cambios en el .gs: fer debe pegarlo y publicar una versión nueva; avisarle.
- Plan: para Play Store, mover el servidor a Railway (fer ya tiene "Tienda de mi barrio" ahí) con cuentas y límites, mismo contrato.
- App Android (`android/`, Java sin librerías, igual que finanzas-voz): WebView + puente `window.AndroidVoz` con `hablar(partesJson, vel)`, `callar()`, `escuchar()`, `detener()`. La página responde con `Voz.parte(i)`, `Voz.fin()`, `Voz.sinVoz()`, `Dictado.parcial(t)`, `Dictado.final(t)`, `Dictado.estado("escuchando" | "detenido" | "error:mensaje")`.
- Dictado: `SpeechRecognizer` continuo sin ventanita (se reinicia solo tras cada pausa, silencia el bip mientras escucha). En finanzas-voz la ventanita de `RecognizerIntent` se cerraba en las pausas; por eso aquí no se usa.
- El WebView de Android no tiene `speechSynthesis` ni `webkitSpeechRecognition`; tampoco el artefacto dentro de la app de Claude.
- Se compila solo en GitHub Actions (aquí no se puede: dl.google.com está bloqueado) y se publica en la release `apk`. Firma con `android/app/debug.keystore` (clave de depuración pública).
- Datos en `localStorage` con prefijo `ed_`: `hist` (prácticas), `mine` (discursos creados), `gen` (conversación de Crear), `ia` (enlace y contraseña del servidor).
