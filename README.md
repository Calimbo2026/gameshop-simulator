# GameShop Simulator

Juego web (un solo HTML) que simula una jornada de trabajo en GameShop. Pieza de marca para `juego.gameshop.com.ar`.

## Estado: Etapa 3 de 5 (parte A en revisión)

| # | Etapa | Qué incluye | Estado |
|---|-------|-------------|--------|
| 1 | Base jugable | Inicio, salón 3D, Mostrador y Caja, una jornada completa | Lista |
| 2 | Minijuegos | Las 11 estaciones, modo Arcade, interrupciones, cordura y combos | **En curso**: parte A (7 estaciones + Arcade) en revisión; parte B (4 estaciones, interrupciones, cordura, dificultades) pendiente |
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

## Decisiones de diseño tomadas con el dueño del proyecto

- **Sin estrés:** paciencia generosa; equivocarse solo trae un chiste.
- **Jornada por cantidad, en tandas con respiros** (no por reloj). En los respiros habla el Dueño y se ve el local.
- **De menos a más:** el juego tiene que crecer de a poco para disfrutar cada etapa.
- **Cantidad de clientes en relación a algo (Etapa 3):**
  - Cartel del frente en 3 niveles: simple, intermedio y cartel pantalla LED (el mejor). Mejor cartel, más gente.
  - Clima: los días de lluvia vienen menos clientes al local y salen más pedidos de Mercado Libre.
  - Fechas: Navidad y Black Friday traen muchos pedidos.
- **Mejoras del local (Etapa 3):** lugares fijos (sin colocación libre). Al tocar un lugar, la cámara hace zoom y centra el objeto; se desliza entre los modelos disponibles, cada uno con su precio. Se pagan con lo ganado en las jornadas.
- **Productos:** sin fotos reales; dibujos propios en SVG que se parezcan al producto (`src/icons.js`).
- **Pedidos para las próximas etapas:**
  - Cuando entra mercadería, llega un hombre con una carreta y deja las cajas (versión básica hecha en la Etapa 2; mejorar en la Etapa 4).
  - Avatares de vendedores y clientes mejores (Etapa 4).
  - Avatar del personaje principal personalizable al comienzo (Etapa 3, al iniciar la Carrera).

## Etapa 3

**Parte A (hecha):** progresión por jornadas (`GS.UNLOCKS`: cada jornada suma clientes y estaciones), inducción (el Dueño explica cada estación la primera vez, `GS.EXPLAIN`), el Dueño entra al salón a hablar, reputación del local (sube y baja con atención, cobros y WhatsApp), horario de 10 a 19, 3 o más pedidos por producto, producto "parecido" siempre entre las opciones (`GS.SIMILAR`), comprobante trucho rechazado = cliente se va renegando y sin producto, sectores del salón con los productos dibujados y carteles.

**Parte B (pendiente):** avatar del protagonista personalizable al comienzo, rangos, plata ganada y mejoras del local (lugares fijos, zoom al objeto, carrusel de modelos con precio), cartel del frente en 3 niveles (más gente con mejor cartel), local que arranca más vacío, clima y fechas (lluvia, Navidad, Black Friday), reputación influyendo en cuánta gente viene, cordura e interrupciones suaves.

**Regla de contenido:** el Dueño nunca da a entender que los productos no son originales.
