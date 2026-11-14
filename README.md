# GameShop Simulator

Juego web (un solo HTML) que simula una jornada de trabajo en GameShop. Pieza de marca para `juego.gameshop.com.ar`.

## Estado: Etapa 5 de 5 (pulido, en curso)

| # | Etapa | Qué incluye | Estado |
|---|-------|-------------|--------|
| 1 | Base jugable | Inicio, salón 3D, Mostrador y Caja, una jornada completa | Lista |
| 2 | Minijuegos | Las 12 estaciones, modo Arcade y combos | Lista |
| 3 | Carrera | Rangos, progresión por jornadas, clima y fechas, el Dueño, mejoras del local | Lista |
| 4 | Mundo completo | Exterior, depósito, oficina, música, cordura, interrupciones, final y tarjeta para compartir | Lista |
| 5 | Pulido | Rendimiento, balance, bugs, accesibilidad, analítica y lanzamiento | **En curso** |

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

## Etapa 5 (pulido)

**Local redistribuido:** mostrador todo recto con el tramo que dice CAJA (el personaje del jugador camina hasta ahí para cobrar); estanterías del fondo unificadas de punta a punta; puerta del depósito sobre la pared derecha, donde está el depósito; **Taller** propio (reparaciones y armado de PC) delante de la oficina; oficina sin caja fuerte, con el sillón y el monitor mirando al escritorio; sin el cartel de la vereda.

**Vida en el local:**
- **Compañeros** (`staffPlan` en `src/game.js`): Lucho (mohicano que cambia de color cada jornada, anteojos) y Brian (celular). Van al depósito, reponen, pasan por el taller, preparan mate, miran la vidriera y cada tanto duermen una siesta en el depósito. Frases en `GS.LINES.staff`.
- **Gente que mira** (`spawnLooker`): entran, miran un sector y se van callados o comentando algo (`GS.LINES.browse`). Parte de los clientes de la jornada también mira antes de acercarse al mostrador.
- **Segunda caja:** cuando hay 2 o más clientes esperando para pagar, Brian va a la caja 2 y le cobra a uno.

**Música:** más lenta y suave (acordes largos, melodía con silencios, filtro que le saca el brillo). Opciones: sin música, suave (por defecto) o normal.

**Tienda de mejoras en compu:** todos los lugares a la vista en grilla, flechas ‹ › (también las del teclado) y los modelos lado a lado.

**Analítica (cuánta gente lo jugó):** el juego ya emite eventos (`abrir_juego`, `inicio_partida`, `fin_jornada`, `final_visto`, `compartir`, `click_tienda`). Para empezar a contar hay que crear una propiedad de Google Analytics 4 y pegar su ID de medición (`G-XXXXXXXXXX`) en `GS.CONFIG.analytics.ga4` (`src/data.js`). Sin ID no se envía nada. No se mandan datos personales.

**Otros:** calidad gráfica que baja sola si el equipo no da; opción de texto grande; foco visible para teclado; botón a la tienda (`GS.CONFIG.links.tienda`); ícono de pestaña y datos para compartir el link. Al lanzar: `GS.CONFIG.launched = true` oculta el cartel de "en construcción", y hay que quitar `noindex` de `src/index.template.html`.

**Pruebas:** `python3 test/v9.py` (capturas del local nuevo) y `python3 test/v8.py 5` (juega sola una jornada).

### Últimos ajustes de la Etapa 5

- **Caminata automática** (`NAV` y `yoGo` en `src/game.js`): al tocar un pedido, el personaje camina solo hasta ese lugar por pasillos y puertas. No cuesta tiempo de juego: el minijuego se abre igual.
- **Globitos de a uno** (`sayAt` / `pumpSays`): todo lo que se dice entra en una fila y se muestra de a un globito, con duración según el largo del texto. El Dueño tiene prioridad; los comentarios de ambiente se descartan si la fila está cargada.
- **El Dueño comenta lo que pasa** (`duenoLine`, frases en `GS.LINES.duenoCtx`): cliente perdido, comprobante trucho, tanda perfecta, racha, lluvia, fechas, siesta de un compañero, compras por la página, hora del día, etc. No repite frases recientes ni el mismo tema dos veces en una jornada.
- **Compañeros sin superponerse:** nunca hacen la misma actividad a la vez y no usan los lugares donde se para el jugador.
- **Vereda según la hora** (`setSky` y `World.setDayTime`): mañana, mediodía, tarde dorada y anochecer con faroles y la luz del local sobre la vereda. Con lluvia, todo más gris.
- **Compras por la página:** la estación que era de Mercado Libre ahora representa las compras de www.gameshop.com.ar.
- **Carteles de mesas** (`rail` en `src/world.js`): misma altura, mismo tamaño y del lado que mira a la cámara.

### Trama, historias y personajes nuevos (v0.12)

- **Trama central: "El local de al lado"** (`GS.PLOT` en `src/data.js`). Hay un fondo que se llena con monedas (botones "Aportar" en Mejorar el local) y con algunas visitas. La temporada cierra en la jornada `GS.CONFIG.finalDay` (20) y el fondo decide uno de cuatro finales (`tiers`). Así las monedas siguen sirviendo cuando ya están todas las mejoras.
- **Visitas con historia** (`GS.STORIES`): seis personajes que vuelven en varias jornadas (Doña Elvira, Benja, Don Anselmo, Tito Ofertas, Cami y el hombre del maletín) y tres visitas raras sueltas. Cada visita es un diálogo con una decisión que cambia reputación, cordura, fondo o lo que cuesta el local. Aparecen con 📖 en los pedidos y no tienen apuro. Todo queda en la **Libreta** (inicio y cierre de caja).
- **Empezar una temporada nueva:** en Opciones. Vuelve a la jornada 1 y reinicia trama y libreta, conservando monedas y mejoras.
- **Personajes** (`makePerson` en `src/world.js`, `avatarSvg` en `src/game.js`): muñecos cabezones con brazos, piernas y pasos, cada uno en 4 colores plenos (piel, pelo, remera, pantalón; ojos, cejas, anteojos y zapatillas van del color del pantalón). En mostrador, caja y visitas se ve la cara del cliente con la mueca que corresponde.
- **Clientes disfrazados:** de los héroes de los juegos inventados (Capitán Carpincho, Astromatero, La Reina de Espadas, Rayo). No se usan personajes de juegos reales.
- **Productos:** cuatro juegos físicos con portada inventada (Carpincho Kart, Galaxia Mate, Truco Royale, Subte Runner), DualSense en seis colores con sus pedidos, y parlante portátil redibujado.
- **Vidriera:** diez temas con consigna explícita ("4 van con el tema y 4 no") y se marca cuáles no iban.
- **Interrupciones:** 14 nuevas, cinco inspiradas en noticias insólitas de la Ciudad (un carpincho por la vereda, excusas en un control, un colectivo con ruidos raros, la plaza de Fórmula 1, papelitos).
- **Segunda caja:** Brian cobra cuando hay dos esperando para pagar, o uno solo si estás ocupado en otra tarea.

**Pruebas:** `python3 test/v11.py` (capturas) y `python3 test/v8.py 6` (juega sola una jornada, incluidas las visitas).

### Modo carrera, Navidad y ajustes (v0.13)

- **Modo carrera:** el botón principal dice "Iniciar modo carrera" la primera vez y "Seguir modo carrera" después. Al iniciar se ven cinco placas cortas (`GS.INTRO`, `showIntro`) con la cámara mostrando cada cosa: el local, el Dueño, Lucho y Brian, el local de al lado y cómo se juega.
- **El local de al lado** existe en el mundo (`buildNext`), con cartel "SE VENDE"; pasa a "GAMESHOP 2" si la temporada cierra con el fondo completo.
- **Navidad:** en la jornada previa (9, 19...) aparece la tarea "Adornos de Navidad" (`adornos` en `src/minigames.js`): se elige árbol, guirnaldas y luces, y se ven al instante. Al día siguiente el local amanece decorado así (`World.setXmas`) y todos llevan gorrito (`World.setHats`).
- **Caja:** en efectivo o transferencia se pregunta cuántos pesos se descuentan (el 10% del precio); con débito la respuesta correcta es "nada".
- **Historias encadenadas:** un paso puede depender de otra historia (`need`, `wait`, `gflag`, `stay`). Don Anselmo consigue su juego solo si antes le comprás a Nilda la caja del altillo; Benja junta lo que le falta solo si le conseguís la changa con Cami (o tras tres visitas de espera).
- **Clientes:** cada uno tiene sus rasgos definidos a mano (`look` en `GS.CUSTOMERS`) para que acompañen al nombre.
- **Celular:** el inicio entra en pantallas chicas, los minijuegos usan más alto de pantalla y se pueden deslizar si no entran, y la tienda de mejoras también.
- **Lluvia:** el interior queda al 90% de la luz de una mañana sin lluvia.
- **Stock:** la respuesta correcta cambia de lugar.

**Pruebas:** `python3 test/v12.py` (celular de 360 x 640).
