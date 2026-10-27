# Escenario Diario

App para practicar hablar en público todos los días: aprendes a armar un discurso, eliges uno de la biblioteca,
lo escuchas, lo practicas con teleprompter y Claude te califica según lo que dijiste. También puedes crear tu
propio discurso conversando con Claude.

## Qué tiene

- **Inicio:** el discurso del día y la rutina de 15 minutos (calentar, escuchar, practicar, calificarte).
- **Aprender:** cómo escribir y preparar un discurso: gancho, presentación, cuerpo y cierre con pregunta o historia.
- **Discursos:** 8 discursos originales de autoayuda, subconsciente y supraconciencia, al estilo de Tony Robbins,
  marcados por partes y con pausas (`/`). Escuchar (voz que lee), Practicar (teleprompter con cronómetro) y Calificarme.
- **Calificarme:** dices el discurso, el teléfono lo escribe y Claude califica gancho, estructura, claridad, ritmo,
  muletillas y cierre. También hay autoevaluación a mano.
- **Crear:** le cuentas a Claude de qué quieres hablar, te hace un par de preguntas y arma tu discurso.
- **Calentar** (rostro, boca y voz con temporizador), **Nervios** (escenario, postura, respiración guiada) y **Progreso**.

Todo se guarda en el teléfono.

## Cómo probarla

- **Web:** https://tdmb102026.github.io/escenario-diario/ (GitHub Pages desde `main` / root).
- **App Android:** https://github.com/tdmb102026/escenario-diario/releases/download/apk/escenario.apk
  La carpeta `android/` es una app pequeña que abre la web por dentro y agrega la voz de Android que lee los discursos
  y el reconocimiento de voz de Google sin cortes en las pausas. GitHub la compila sola (`.github/workflows/apk.yml`).
  Los cambios de pantallas llegan sin reinstalar.
- **IA:** ver `ia-servidor/LEEME.md`.

En la computadora: `python3 -m http.server` dentro de la carpeta y abre `http://localhost:8000`.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Toda la app web (pantallas, discursos, lógica) |
| `icon.svg`, `icon-*.png`, `manifest.webmanifest` | Ícono y datos para instalar |
| `android/` | App Android (Java, sin librerías): WebView + voz + micrófono |
| `ia-servidor/escenario-ia.gs` | Servidor de la IA en Apps Script |
