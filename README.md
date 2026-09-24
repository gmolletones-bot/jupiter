# 🪐 Jupiter

Navegador web de escritorio hecho con **Electron**, **React** y **TypeScript**.

## Funciones

- **Pestañas** con título, favicon y barra de título integrada (como Chrome o Brave).
- **Barra de direcciones inteligente**: autocompletado, sugerencias del historial, marcadores y buscador.
- **Escudos**: bloqueador de anuncios y rastreadores con EasyList, EasyPrivacy y las listas de uBlock Origin (motor de Ghostery), incluidos los anuncios de YouTube y los avisos de cookies. Se puede desactivar por sitio.
- **Página de inicio personalizable**: reloj, clima, temporizador Focus (Pomodoro), sonidos ambientales, playlists de YouTube y Spotify, accesos directos y fondos animados de día y de noche.
- **Personalización**: tema claro u oscuro, color de acento, fondos propios y redondez de las esquinas.
- **Historial, marcadores** con barra de marcadores, **búsqueda en la página**, zoom y menú contextual.
- **Extensiones de Chrome** descomprimidas (compatibilidad parcial).

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev
```

Comprobaciones:

```bash
npm run typecheck
npm run lint
```

## Generar instaladores

```bash
# Windows (desde Windows): dist/jupiter-<versión>-setup.exe
npm run build:win

# Linux (desde Linux o WSL): dist/*.AppImage y dist/*.deb
npm run build:linux
```

Guía paso a paso para Linux (incluido Linux Mint y WSL): [docs/COMO-EXPORTAR-PARA-LINUX.txt](docs/COMO-EXPORTAR-PARA-LINUX.txt).

## Estructura

- `src/main/`: proceso principal (ventana, pestañas, historial, extensiones, bloqueador).
- `src/preload/`: puente seguro entre la interfaz y el proceso principal, y el preload de los Escudos.
- `src/renderer/`: interfaz en React (pestañas, barra de direcciones, página de inicio, configuración).

## Licencias de terceros

El bloqueador usa [`@ghostery/adblocker`](https://github.com/ghostery/adblocker) (MPL-2.0) y listas de filtros de EasyList y uBlock Origin. La letra manuscrita es [Caveat](https://fonts.google.com/specimen/Caveat) (OFL).
