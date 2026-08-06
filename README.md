# ⚡ EmergencyCord — Discord Backup Web App

Un clon de Discord ultra rápido, ligero y con un diseño moderno diseñado para ser alojado en tu propio servidor con Docker. 

**Ideal como respaldo de emergencia:** Si Discord deja de funcionar, levantas este contenedor en segundos y toda tu comunidad o equipo puede comunicarse inmediatamente sin crear cuentas.

---

## ✨ Características Principal

- 🚀 **Cero Cuentas / Registro**: Solo ingresas tu nombre de usuario y entras instantáneamente.
- 🎨 **Diseño idéntico a Discord Dark Mode**: Blurple (#5865F2), paneles de cristal, lista de canales, miembros conectados e interfaz fluida.
- 💬 **Mensajería en Tiempo Real con WebSockets**: Soporte para múltiples canales (`#general`, `#emergencia`, `#gaming`), formato Markdown (`**negrita**`, `\`código\``, enlaces), adjunto de imágenes y selector de emojis.
- 🔊 **Voz Avanzada con Slots Ilimitados**:
  - **Activación por Voz Automática (VAD)** con filtro de sensibilidad.
  - **Pulsar para Hablar (Push-To-Talk)** con tecla configurable.
  - **Cancelación de Ruido Inteligente (Krisp style)** y cancelación de eco vía WebRTC.
  - **Indicador de habla**: Anillos de luz verde palpitante en el avatar de quien está hablando.
- 🐳 **Despliegue con Docker en 1 Comando**: Consumo inferior a 30 MB de RAM.

---

## 🚀 Cómo Desplegar con Docker (1 Paso)

En tu servidor VPS o equipo local, ejecuta:

```bash
docker compose up -d
```

¡Y listo! La aplicación estará disponible en:
`http://tu-servidor:9090` (o `http://localhost:9090`)

### Detener el contenedor
```bash
docker compose down
```

---

## 💻 Ejecución en Modo Desarrollo (sin Docker)

Si deseas probarlo localmente con Node.js:

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Abre en tu navegador [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS Vanilla (Discord Dark Theme), JavaScript ES6
- **Audio & Voz**: WebRTC Audio API + Web Audio API (Analizadores de Frecuencia VAD & Supresión de Ruido)
- **Contenedor**: Docker / Docker Compose (Alpine base)
