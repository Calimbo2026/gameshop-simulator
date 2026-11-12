# GameShop Simulator

Juego web (un solo HTML) que simula una jornada de trabajo en GameShop. Pieza de marca para `juego.gameshop.com.ar`.

## Estado: Etapa 1 de 5

| # | Etapa | Qué incluye | Estado |
|---|-------|-------------|--------|
| 1 | Base jugable | Inicio, salón 3D, Mostrador y Caja, una jornada completa | **En revisión** |
| 2 | Minijuegos | Las 11 estaciones, modo Arcade, interrupciones, cordura y combos | Pendiente |
| 3 | Carrera | Rangos, jornadas-examen, eventos del año, el Dueño y los personajes | Pendiente |
| 4 | Mundo completo | Exterior, depósito, oficina, música, final y tarjeta para compartir | Pendiente |
| 5 | Pulido | Rendimiento, balance, bugs, accesibilidad, analítica y lanzamiento | Pendiente |

La etapa actual se cambia en `src/data.js` (`GS.CONFIG.phase`) y se muestra sola en el juego.

## Cómo está armado

- `src/data.js`: todo lo editable (configuración, etapas, catálogo, pedidos, personajes, frases, distribución del salón).
- `src/world.js`: diorama 3D, cámara y personajes (Three.js r149, geometría por código).
- `src/minigames.js`: minijuegos 2D (Mostrador y Caja).
- `src/game.js`: jornada, puntaje, HUD y pantallas.
- `src/audio.js`: sonidos generados por código.
- `node build.js` arma `dist/index.html` y `index.html` (autocontenido, sin dependencias externas).

## Reglas duras

Sin datos sensibles del negocio, sin personas reales, precios y stock ficticios.
