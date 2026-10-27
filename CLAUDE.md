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
- Niveles (2026-10-27): 1 Estructura, 2 Storytelling, 3 Voz y emoción, 4 Improvisación (`#improvisar`), 5 Preguntas del público (`#preguntas`). Se sube con `META`=3 prácticas con nota ≥ `APRUEBA`=3.5 en el nivel actual (`nivelActual()`); cada práctica guarda `nivel`. Ajustes → "Desbloquear todos los niveles" (`ed_todos`) para probar.
- Marcas en discursos del nivel 3: `^texto^` subir, `~texto~` bajar, ` // ` silencio largo (`withPauses`, `plain`, `trozos`).
- Crear es un paso a paso (`ed_flujo`, `viewFlujo`): 1 idea (chat) → 2 discurso → 3 Claude recomienda qué historia contar y conversa → 4 historia → 5 discurso unido; guarda el final y la historia. Solo se resalta (`.siguiente`) el botón que toca. En "Otras opciones" siguen los modos sueltos (`ed_crearModo`: historia `ed_genh`, unir `ed_genu`).
- Calentar con profesor: `GUIONES` (por título del ejercicio) con acciones di, cuenta, alterna, espera, tuTurno, repite; `guiaCalentar(desde, solo)` las ejecuta con `decir()` (voz nativa o del navegador). Pausa, Siguiente, Terminar y barra de velocidad (`ed_gvel`, multiplica voz y ritmo de la cuenta). Botón "Guíame" por ejercicio.
- Ajustes es una pestaña de la barra de abajo (recordatorio, IA, niveles).
- Recordatorio diario (solo app Android): `AndroidVoz.recordatorio(activo, hora, minuto)`, `recordatorioEstado()`, `practique()`; `Recordatorio.java` usa `AlarmManager.setWindow` (sin permiso de alarmas exactas), no avisa si ese día ya practicaste y se reprograma al reiniciar el teléfono.
- Dictado: si una tanda de Google termina sin resultado final o con error, se guarda lo último oído (`ultimoParcial` en Java, `dictParcial` en la página); antes la tanda nueva borraba lo anterior.
- La página publica `window.Voz` y `window.Dictado`: la app Android los llama como `window.Voz && Voz.fin()` (un `const` no queda en `window`).
