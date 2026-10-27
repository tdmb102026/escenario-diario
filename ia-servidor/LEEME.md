# Servidor de la IA de Escenario Diario

Calificar tus discursos y crear discursos nuevos usa Claude. La app manda el pedido a un servidor tuyo en Google
(Apps Script), que revisa la contraseña de la app y se lo pasa a Claude (Anthropic) con **tu** clave de API.
La clave nunca llega al celular ni a este repositorio. No usa tu plan Pro de Claude: gasta del saldo de la API.

## Preparar el servidor (una sola vez, unos 10 minutos)

1. **Clave nueva.** Entra a https://console.anthropic.com → **API Keys** → *Create Key*. Nómbrala
   **Escenario** (no reuses la de Finanzas ni la del Despacho). Cópiala y no la pegues en ningún chat.
   El saldo es el mismo de siempre (Billing).
2. **Hoja nueva.** En Google Drive crea una hoja de cálculo, por ejemplo «Escenario IA».
3. Menú **Extensiones → Apps Script**. Borra lo que haya, pega todo `escenario-ia.gs` y guarda (ícono del disquete).
4. **Implementar → Nueva implementación → tipo: Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso:
   **Cualquier persona**. Implementar, autorizar con tu cuenta y copiar el enlace que termina en `/exec`.
5. Vuelve a la hoja y recárgala: aparece el menú **Escenario IA**.
   - **Guardar clave de Anthropic**: pega la clave del paso 1.
   - **Guardar contraseña de la app**: inventa una contraseña (6 letras o más).
6. **En el celular:** abre la app → **Inicio → Conecta la IA**. Pega el enlace `/exec`, escribe la contraseña y
   toca **Guardar y probar**. Debe decir "Listo".

## Cuánto cuesta

Cada uso queda anotado en la pestaña **Uso** de la hoja: fecha, tarea, tokens y costo en dólares.
Con Haiku, calificar un discurso cuesta menos de 0,1 centavos de dólar y crear uno unos 0,2 centavos.

## Si cambias el script

Usa **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión**. Así el enlace no cambia.

## Más adelante: Railway

Para lanzarla a más personas (Play Store), este mismo pedido `{ clave, tipo, tarea, mensajes, max } → { ok, texto }`
se pasa a un servidor en Railway con cuentas de usuario y límites por persona. La app solo cambia el enlace.
