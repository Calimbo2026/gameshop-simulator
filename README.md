# GameShop Simulator

Juego web (un solo HTML) que simula una jornada de trabajo en GameShop. Pieza de marca para `juego.gameshop.com.ar`.

## Estado: Etapa 4 de 5 (completa, en revisión)

| # | Etapa | Qué incluye | Estado |
|---|-------|-------------|--------|
| 1 | Base jugable | Inicio, salón 3D, Mostrador y Caja, una jornada completa | Lista |
| 2 | Minijuegos | Las 12 estaciones, modo Arcade y combos | Lista |
| 3 | Carrera | Rangos, progresión por jornadas, clima y fechas, el Dueño, mejoras del local | Lista |
| 4 | Mundo completo | Exterior, depósito, oficina, música, cordura, interrupciones, final y tarjeta para compartir | **Completa, en revisión** |
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

**Parte B (hecha):** monedas por jornada, tienda de mejoras con lugares fijos, zoom y vista previa (`GS.UPGRADES`), meta de ahorro visible en el inicio y en el cierre, cartel en 3 niveles, local que arranca vacío, avatar del protagonista, rangos, clima y fechas (`GS.CONDITIONS`), reputación que trae o aleja clientes. El Dueño sale solo unos pasos del depósito.

**Idea rectora:** para que repetir no canse tiene que haber un porqué: ahorrar para una mejora visible. La próxima mejora y cuánto falta se muestran siempre.

**Pasa a etapas siguientes:** cordura e interrupciones suaves, más lugares de mejora (vidriera, luces, segunda caja), lluvia visible, mejores avatares.

## Etapa 4

**Parte A (hecha):** avatares tipo cono con peinados (corto, largo, rodete, rulos, mohicano, pelado) y accesorios (anteojos, barba, labios pintados) combinables libremente; el Dueño con mohicano gris; el repartidor pelado y con barba; lluvia visible; productos exhibidos como cajas prolijas con el dibujo impreso; vidriera con productos; notebook y escritorio gamer rehechos; contraste de los dibujos en los paneles; ascenso de rango visible; "Volver a la jornada 1" y clima de prueba en Opciones; frases corregidas por el dueño del proyecto.

**Parte B (pendiente):** exterior con vereda y peatones, depósito y oficina del Dueño, música y balbuceos, escena final, tarjeta para compartir, cordura e interrupciones suaves, más lugares de mejora.

**Parte B (avance):** depósito al costado del salón con una estantería por sector (ahí se juega la Reposición), minijuego de Vidriera (estación 12; según cómo quede, los clientes dicen que lo vieron en la vidriera), todas las estanterías con cajas de producto, pelo negro, peinados concéntricos con la cabeza, peatones.

**Cierre de la etapa (hecho):**

- **Oficina del Dueño** al costado derecho, delante del depósito (`buildOffice` en `src/world.js`). El Dueño es un solo personaje: vive en su oficina, sale unos pasos por la puerta a hablar y vuelve.
- **Música** generada por código (`src/audio.js`, `MOODS`): un clima para el inicio, otro para la jornada, otro para la lluvia, otro para Black Friday y Navidad y otro para el final. Se apaga desde Opciones.
- **Balbuceos:** cada globito suena con el tono del personaje (el Dueño, más grave).
- **Cordura** (`GS.CONFIG.cord`): sube en los respiros, con las rachas y con las interrupciones bien resueltas; baja con errores y cuando se juntan muchos pendientes. Con 70 o más da +10% de puntos y al cierre suma puntos. Nunca hay castigo: si baja de 30, Brian ceba un mate y todos esperan un poco más.
- **Interrupciones suaves** (`GS.INTERRUPTS`, desde la jornada 2): una tarjeta con dos respuestas. Si no se contesta, se resuelve sola sin castigo.
- **Mejoras nuevas** (`GS.UPGRADES`): plantas y alfombra, cafetera, luces LED, vidriera iluminada y segunda caja. Cada una se ve en el local y tiene su efecto.
- **Escena final** (`GS.FINAL`, al terminar la jornada `GS.CONFIG.finalDay` = 10, que cae en Navidad): los clientes entran, el Dueño da su discurso y hay ascenso a "Mano derecha del Dueño". Después se puede seguir jugando. Para verla sin llegar: Opciones, "Escena final".
- **Tarjeta para compartir:** imagen de 1080 x 1350 con el personaje, el rango y los números. Se abre desde el cierre de caja y desde el final. En el celular se comparte directo; en la compu se descarga. La dirección impresa sale de `GS.CONFIG.shareUrl` (vacío = la dirección desde donde se juega).

**Pruebas:** `python3 test/v7.py` (capturas de todo lo nuevo) y `python3 test/v8.py` (juega sola una jornada entera).
