# GameShop: La Expansión

Juego web (un solo HTML) que simula una jornada de trabajo en GameShop. Pieza de marca para `juga.gameshop.com.ar`.

## Estado: Expansión nacional · etapa 1 de 8 (curva y tiempos)

El juego base (las cinco etapas de abajo) está terminado. Ahora crece hacia "llevar GameShop a todo el país" en ocho etapas nuevas: ver `GS.PHASES` en `src/data.js` y la sección "Expansión nacional" al final.

## v0.47 · Pantallas con más épica
- Inauguración de sucursal y región conquistada a pantalla completa (tienda con cinta, mapa con copa y papelitos).
- Resumen de jornada con encabezado dorado (ciudad y mes) y monedas, fondos y reputación como datos grandes.
- Presentación en el formato de imágenes grandes de la bienvenida.
- Logros como medallas; abrir sucursal con encabezado de la región y el rival en "VS"; tarjeta para compartir con la placa dorada.
- Libreta con texto al día; cuadro de encargado con retratos.
- v0.47.1: la tienda de la presentación y de cada inauguración aparece en el entorno de su región (ciudad, cordillera, cerros de colores, selva, lago y nieve, costa con faro).

## v0.48 · Exterior
- Cartel de sucursal con la estética del logo (placa negra, marco dorado, logo real).
- Faroles nuevos con luz en degradé de noche; contenedores con tapa, ruedas e íconos.
- Con el techo puesto se ven las paredes completas del lado del estacionamiento.
- Puertas de vidrio corredizas: se abren solas cuando alguien se acerca.

## v0.49 · Productos y primer día guiado
- Los 44 productos redibujados con el mismo estilo (más detalle, brillo y sombra).
- Primer día: arranca con un cliente ya en el mostrador y una flecha marca dónde tocar (atender, elegir el producto, cobrar).

## v0.50 · Armado de PC arrastrando y explicación de recursos
- Armado de PC: las piezas se arrastran a su lugar sobre un motherboard dentro del gabinete (también funciona tocar pieza y lugar).
- Tarjeta "Qué falta para abrir otra sucursal" en el menú de campaña y en el resumen: 5 estrellas, camión y fondos, con para qué sirve cada recurso.

## v0.51 · Resumen en tres pantallas
- El cierre del día se divide en tres pantallas deslizables: cómo te fue, lo que cobraste y qué sigue.
- Se quitó la elección de reparto: monedas y fondos van siempre parejos.
- Los festejos (región conquistada, finales) aparecen al llegar a la última pantalla.

## v0.52 · Mejoras dentro del cierre del día
- El cierre suma una pantalla "Mejorá el local" entre el cobro y "Qué sigue": todas las mejoras, con compra directa.

## v0.53 · Exhibición, flota y más claridad
- Vidriera y mesas con los productos fuera de la caja; escritorio gamer como setup de exhibición.
- Vehículos de la flota rediseñados; corona nueva para la Reina de Espadas.
- Reposición: el producto queda siempre a la vista y hay pista después de un error.
- Opciones con el estilo general; las herramientas de prueba salen de Opciones.
- Gráfico de cómo se abre una sucursal; mejor nitidez en celulares; miniatura nueva al compartir.

## v0.54 · Ordenar depósito
- La tarea de reposición pasa a ser "Ordenar depósito": en cuatro estanterías hay tres productos mal ubicados y hay que arrastrar cada uno a la suya. La primera vez, el juego marca uno de ejemplo.

## v0.55 · Reparto a la vista
- Al despachar una compra por la página, el vehículo de la flota sale andando por la calle y vuelve al rato. La moto lleva un repartidor con casco de GameShop.

## Juego base (terminado)

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

## Expansión nacional

Ocho etapas: 1) curva y tiempos, 2) feedback y resumen de jornada, 3) economía de dos recursos y mostrador, 4) mapa del país, sucursales y delegación, 5) historias, eventos y competencia, 6) minijuegos arcade, 7) finales y rejugabilidad, 8) lanzamiento.

Decisiones tomadas: tres métricas (estrellas, monedas y fondos; el arcade premia con cosméticos); equivocarse cuesta de verdad; dos o tres bases de local con decoración regional; una sucursal se completa con 4,8 estrellas o más; sin ranking semanal; modismos regionales cariñosos, nunca burlones.

### Etapa 1: curva y tiempos

- **Medición** (`showMetrics` en `src/game.js`, Opciones → "Datos de prueba"): cada jornada guarda duración, tiempo dentro de minijuegos, monedas, atendidos, perdidos, errores y segundos por tipo de tarea. Botón para copiar todo como texto. También viaja en el evento `fin_jornada`.
- **Tope por jornada** (`GS.CONFIG.day.maxDayCustomers` = 6, `maxDayTasks` = 2): con eso una jornada dura unos 3 minutos sin importar el día. Lo que el cartel y las mejoras traerían de más se paga como tickets más altos (+7% de monedas por cliente que no entra en el tope).
- **Ritmo:** respiros de 7 s, llegadas cada 5,5 s (clientes) y 7 s (tareas).
- **Cómo medir:** `python3 test/v8.py <jornada> 4` juega sola esa jornada a velocidad x4 (`GS.DEBUG_SPEED`) e imprime la medida. Con el bot: jornada 6 = 3:02, jornada 9 = 3:02, jornada 14 = 2:45; monedas entre 370 y 600.

### Etapas 2 y 3 · Feedback, resumen, economía y mostrador (v0.15.0)

- **Resumen de la jornada** en lugar del cierre de caja con ranking: ventas concretadas, cobros sin error, compras web, stock, tareas a tiempo, limpieza; monedas que suben, momento del día y un gancho de "lo que viene". Se quitaron ranking, récords y rangos.
- **Tres métricas**: ⭐ reputación, 🪙 monedas y 🗺️ fondos de expansión (los deja cada jornada según facturación y reputación; solo sirven para abrir sucursales). Se retiró la cordura.
- **Equivocarse cuesta**: producto equivocado = el cliente se va (desde la jornada 2); cobrar mal baja reputación y monedas.
- **Mejoras nuevas**: flota de envíos (moto → camioneta → camión, se ve en la vereda) y página web (3 niveles).
- **Limpieza**: los clientes dejan manchas; se limpian con un toque en los ratos libres. Cerrar con el piso sucio baja la reputación.
- **Logros** (14, cuatro ocultos) en lugar de Récords.
- **Calendario**: 1 jornada = 1 mes. Black Friday en noviembre (jornada 11), Navidad en diciembre (12, 24, 36) con Papá Noel de cliente. Gorros navideños por encima del pelo.
- El Dueño cambió el mohicano por pelo corto con una franja apenas más larga al medio. Preguntas del barrio: estación Incas del subte B y la parada del 80.
- Pruebas: `test/v8.py` (jornada completa), `test/v13.py` (capturas).

### Etapa 4 · Mapa y sucursales (v0.16.0)

- **Mapa del país** por regiones (se abre desde el inicio y desde el resumen): bloqueadas en gris, disponibles en amarillo, abiertas con cartel. Debajo, el tablero con una tarjeta por sucursal (alertas solo en la activa).
- **Abrir sucursal** con fondos de expansión: aviso del rival de la zona, elegir 2 empleados entre 4, dejar encargado en la que te vas e inauguración. Costos en `GS.REGIONS` (`cost`).
- Cada sucursal guarda sus mejoras y su reputación; al irte queda congelada. La página web (marca) vale en todas.
- **Capa regional**: misma base de local con paleta, paisaje y tótem propios (Mendoza, Salta, Posadas, Bariloche) y 3 etapas (humilde, mejorado, estrella) según el avance.
- **Enseñar al equipo** (una vez por jornada, en un respiro): hasta nivel 3; el equipo resuelve solo esa cantidad de tareas que se estén por vencer.
- El Dueño queda en Incas: llama cada dos jornadas y viene en persona si la reputación baja de 4.
- Clientes con saludos de cada región. Prueba: `test/v15.py`.
- Pendiente de esta etapa: plantas de local distintas por sucursal (taller, depósito y oficina siguen en el mismo lugar).

### Etapa 5 · Historias y competencia (v0.17.0)

- Cada sucursal nueva tiene **sus personajes** (2 clientes con historia y el **rival de la zona**, que hace guerra de precios, un sabotaje gracioso y un desafío final). Están en `GS.STORIES` con `reg`. Vienen al mostrador como un cliente más.
- **Eventos sorpresa** (`GS.EVENTS`): corte de luz, promo relámpago, inspección, cliente famoso, stock que no llega. Uno por jornada como mucho; a veces la opción que parecía mala sale bien.
- El avance de cada sucursal ahora cuenta mejoras (50%), reputación (30%) e historias cerradas (20%).

### Etapa 6 · Arcade (v0.18.0)

Tres juegos en `src/arcade.js`, que se ganan al terminar las jornadas 3, 8 y 14 y se juegan desde el menú Arcade: **Stock Tetris**, **Defensa del mostrador** y **Cable Runner**. Llegar a la meta da un premio para el personaje (casco, corona, vincha), no monedas. Metas en `GS.ARCADE` (`goal`). Prueba: `test/v17.py`.

### Etapas 7 y 8 · Finales, Nuevo Juego+ y lanzamiento (v0.19.0)

- **Final** al completar las 5 sucursales: mapa encendido, créditos y un final distinto según cómo se llegó (`GS.FINALS`, uno secreto). Vista previa en Opciones.
- **Nuevo Juego+** con modificador (`GS.MODS`): conserva logros, premios y personaje.
- El enlace a la tienda aparece solo en el final ("Esto fue un juego. El local es real.").
- **Lanzamiento**: poner `launched: true` en `src/data.js` y compilar. Eso quita el `noindex`, el cartel de etapas y el "en construcción". `og.png` es la imagen para compartir; la dirección pública está en `build.js` (`SITE`).
- Prueba: `test/v18.py`.

### Ajustes (v0.20.0)

- **Mapa 3D** (`src/map3d.js`): Argentina con su contorno real y las Malvinas, en ángulo. Cada región abierta muestra una miniatura de su sucursal; las cerradas, un candado (dorado si ya alcanzan los fondos). Se toca una región y abajo aparece su tarjeta.
- **Mejoras**: tocar cualquier nivel lo muestra en el local aunque no alcancen las monedas.
- Se quitó el local de al lado.
- **Paisajes regionales**: terreno, calle, cerros facetados con nieve o estratos de colores lejos del local, y vegetación suelta. Prueba: `test/v19.py`.

### v0.21.0

- La vereda y la calle siguen a lo largo de toda la cuadra (en todas las sucursales).
- **Techo**: al alejar la cámara al máximo aparece el techo del local; al acercar apenas, se abre y se ve el interior.
- **Final oculto**: con las 5 regiones completas aparece Malvinas en el mapa (`secret: true` en `GS.REGIONS`). Al completar esa sucursal se planta la bandera y se ve el final `GS.FINAL_M`. Prueba: `test/v20.py`.

### v0.23.0

- Techo: logo corpóreo sobre el faldón del frente ("Game" en negro, "Shop" en rojo).
- **Modo desarrollador**: Opciones → Modo desarrollador (o `?dev=1` en la dirección; `?dev=0` lo apaga). Da monedas y fondos de expansión infinitos sin tocar los valores guardados de la partida, y suma el botón "Completar esta sucursal".

### v0.42.0 · Ritmo y expansión

- **Más monedas, mejoras más baratas**: cada jornada deja algo más del doble de monedas (`d.score / 9`) y los precios de las mejoras bajaron a la mitad (flota: 400 / 900 / 1600). Los fondos de expansión llegan un poco más lento (`d.sales / 9000`).
- **Región conquistada** = 5 estrellas (4,8) + camión. Eso, más los fondos, habilita abrir otra sucursal; hace falta en todas las que estén abiertas. El resto de las mejoras y las historias quedan para el 💎 platino (100%).
- El final del país sale al conquistar las 5 regiones; el de Malvinas, al conquistarla y ganarle al pirata.
- Aviso grande de región conquistada, con el avance de la sucursal y la opción de seguir completándola o ir al mapa.

## v0.56 · Minijuegos con las manos

- **Compras por la página**: se arrastra el producto a la caja donde entra justo, se pasa la cinta y se arrastra la etiqueta correcta hasta la caja.
- **Taller · Diagnóstico**: la PC abierta muestra una pista (calor, pelusa, placa mal calzada, cable suelto, disco lleno, poca RAM) y hay que tocar la pieza culpable.
- **Control de stock**: contar los productos de la góndola (algunos quedan atrás) y corregir el número con + y −.
- **Recepción de proveedor**: pilas de cajas dibujadas contra el remito.
- **Devoluciones**: hay que dar vuelta el producto y abrir el ticket antes de decidir.
- **Cierre de caja**: se cuentan los billetes del cajón tocándolos y se compara con el sistema.
- **WhatsApp**: aspecto de chat, con la respuesta enviada.

## v0.57 · Sonido y guías de primera vez

- **Música**: melodía tipo kalimba con un eco corto, dos frases por clima y un tramo de descanso sin melodía para que el loop no canse. Limitador en la salida.
- **Efectos**: sonidos nuevos para levantar, apoyar, contar billetes, dar vuelta, enviar mensaje, sellar y encender la PC; el de error ya no es una chicharra.
- **Guías**: cada minijuego nuevo explica el gesto la primera vez (manito animada o resaltado) y no vuelve a mostrarlo. Textos del Dueño actualizados.

## v0.58 · La clase, uniones prolijas y saludos regionales sin repetir

- **Enseñarle al equipo**: ahora es una escena. Los dos empleados dejan lo que hacen y van al Taller (donde no pasan clientes ni hay muebles comprables), aparece una pizarra, tu personaje explica moviendo el brazo, ellos asienten, se les prende la lamparita y festejan con un saltito. La cámara se acerca y vuelve sola.
- **Uniones**: corregidas las caras superpuestas en la trompa del utilitario, las columnas del frente y los banderines; además cada material empuja apenas su profundidad, así dos caras en el mismo plano ya no parpadean.
- **Colectivo**: queda una sola pregunta, "¿dónde para el 80?", solo en Buenos Aires.
- **Saludos regionales**: de 5 a unos 15 por región, y salen como un mazo: no se repite ninguno hasta que salieron todos.

## v0.59 · Muebles con lugar a elección y clientes que los usan

- **Salón**: pasillo central libre de la puerta al mostrador y cuatro lugares (`GS.LAYOUT.slots`) para los muebles de piso (`GS.FLOOR`: Isla Apple, Mesa de PC, Sillas gamer, Escritorio gamer). Todos miran a la puerta.
- **Elegir el lugar**: en Mejorar el local, cada mueble de piso muestra un plano chiquito del salón; tocar un lugar lo mueve (y si estaba ocupado, intercambia). Se guarda por sucursal en `up.lay`.
- **Mesa de PC**: del tamaño de la isla, con tres zonas (notebooks, puesto armado y componentes).
- **Clientes**: los que entran a mirar (y los que miran antes de ir al mostrador) usan los muebles: tocan lo de Apple, prueban el teclado, se sientan y giran en las sillas, juegan en el escritorio. Les salen emojis de que les gusta.

## v0.70 · Rivales, día de competencia y medallas

- **Sin fondos de expansión.** Cada región se conquista en tres pasos: 5 estrellas, flota completa y ganarle al rival en el **día de competencia**. Lo que antes daba fondos ahora da monedas. La conquista queda guardada en `branches[id].won`; las partidas anteriores conservan lo que ya tenían conquistado (`mig70`).
- **Día de competencia** (`day.duel`): más clientes, menos paciencia, marcador en vivo contra el rival (`#duelBar`), tres quejas y se pierde, hora pico en la última tanda. El puntaje del rival sale del promedio del jugador (`branches[id].avg`, puntos por cliente o tarea) por `DUEL_K`. Si se pierde, revancha gratis y 5% más fácil por intento (hasta 3).
- **Medallas** desde la jornada 4 (`day.goal`): plata al 85% del promedio propio, oro al 106%. Oro: +20% de monedas, racha, y 2% de ventaja en el duelo por cada una (hasta 5).
- **Rivales** (`GS.REGIONS[].rival` + historia `rival_<region>`): marca, color, lema, burlas, arco. Buenos Aires tiene rival propio (Turbo Gamer). Cada uno con su sombrero (`hat: boina | ala | ushanka | gorra`, `shades`, `patch`) en 3D y en retrato. Llaman, pasan por la vereda con globo de su marca y tienen escenas propias.
- **Aprendizaje**: todas las tareas se conocen en las jornadas 1 a 3 (`GS.UNLOCKS`), con menos clientes y más paciencia.

## v0.71.0
- Arco de los rivales en tres escenas: derrota, apretón de manos con su historia, y "un tiempo después" con el negocio de cada uno trabajando junto a GameShop (`arcT`, `arc`, `futT`, `fut` en `GS.REGIONS[].rival`).
- Halo de luz para las visitas especiales (clientes con historia, rivales, Papá Noel): `person.aura(color)`.
- Papá Noel con barba, panza y bolsa de regalos; al comprar guarda el regalo en la bolsa (`person.gift()`).
- La compra sale en una bolsa negra con el logo de GameShop.
- Boina sin pelo que la atraviese; Capitán Tormenta 3D nuevo (bicornio curvo, casaca, charreteras, banda, garfio y loro).
- Propuestas para el Dueño en `GS.BOSS_OPTS` (todavía no reemplazan al actual). Opciones de look nuevas: `build: 'robusto'`, `hairStyle: 'jopo'`, `hair2`, `stubble`, `wide`, `top: 'remera' | 'chomba' | 'campera'`.

## v0.72.0
- El Dueño pasa al diseño elegido (`GS.BOSS_LOOK`): contextura grande, pelo corto canoso, afeitado, remera negra.
- Uno de cada cuatro clientes tiene contextura grande (`build: 'robusto'` en `lookOf`).
- Zapatillas redondeadas para todos; la bolsa cuelga de la mano por las manijas, con el logo centrado.
- Los rivales no hacen la cola: se plantan en el medio del salón, la cámara va con ellos, cortan lo que se esté diciendo y hablan con el globo de su marca (`cu.rv`, `#modal.low`). `GS.Game.debugVisit(id)` para probar.
- La cámara se sigue acomodando con el juego en pausa.
