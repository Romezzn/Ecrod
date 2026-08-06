# ⚡ EmergencyCord — Ultra Glassmorphism (Web & Cliente Windows)

Un clon de Discord ultra rápido, ligero y con un diseño de **Cristal Ultra Glassmorphism** diseñado para ser alojado en tu servidor Docker y usado desde la **Web** o como **Cliente Nativo de Escritorio para Windows (Electron)**.

---

## ✨ Novedades

- 🖥️ **Cliente Nativo de Escritorio para Windows**: Permisos de micrófono 100% nativos de Windows sin ninguna restricción de navegador HTTP/HTTPS.
- 🌐 **Conexión Directa a tu Servidor**: Configurado para conectar a `http://sg.dimzo.es:9090` (o cualquier servidor personalizado).
- 💎 **Diseño Ultra Glassmorphic**: Cristal esmerilado (`backdrop-filter: blur(28px)`), esferas de luz neón ambiente, bordes translúcidos y barra de ventana personalizada para Windows.
- 🚀 **Sin Registro ni Cuentas**: Ingresa tu usuario y entra en 1 segundo.
- 🔊 **Voz Avanzada**: Activación por voz (VAD), Pulsar para Hablar (PTT), Cancelación de ruido inteligente y slots ilimitados.

---

## 💻 Cómo Iniciar el Cliente de Windows (Escritorio)

En tu equipo con Node.js instalado, ejecuta:

```bash
# 1. Instalar dependencias (si no lo has hecho)
npm install

# 2. Ejecutar la Aplicación de Escritorio de Windows
npm run electron
```

---

## 🐳 Cómo Desplegar el Servidor en tu VPS Docker (`sg.dimzo.es:9090`)

En tu servidor Docker:

```bash
# 1. Actualizar repositorio
git pull origin main

# 2. Reconstruir e iniciar contenedor
docker compose up -d --build
```

Servidor listo en el puerto **`9090`** (`http://sg.dimzo.es:9090`).
