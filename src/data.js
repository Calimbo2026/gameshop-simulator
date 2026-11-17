/* =====================================================================
   GameShop Simulator — DATOS
   Todo lo editable sin tocar la lógica vive acá: configuración, fases,
   catálogo, pedidos de clientes, personajes y frases.
   Precios y stock son FICTICIOS. Personajes inventados.
   ===================================================================== */
const GS = {};

GS.CONFIG = {
  version: '0.50.0',
  phase: 8,
  phaseNote: 'Juego completo de punta a punta. Falta tu playtest con 5 personas y encender el lanzamiento (launched: true)',                       // fase actual del proyecto (1 a 5)
  links: { tienda: 'https://www.gameshop.com.ar', instagram: '' },   // botones del inicio y del cierre (vacío = no se muestra)
  // Analítica: pegá acá el ID de medición de Google Analytics 4 (G-XXXXXXXXXX) y el juego empieza a contar jugadores. Vacío = no se envía nada.
  analytics: { ga4: '' },
  launched: false,                // true = se oculta el cartel de "en construcción" y los buscadores pueden indexar el juego
  shareUrl: '',                   // dirección que se imprime en la tarjeta para compartir (vacío = la dirección desde donde se juega)
  finalDay: 20,                   // jornada que cierra la temporada y dispara la escena final
  promoMode: null,                // 'hotsale' | 'cyber' | null (Fase 3)
  camera: { tilt: 55, rot: 38, fov: 22 },
  day: {
    seconds: 180,                 // duración de la jornada normal
    relaxedCustomers: 8,          // clientes del turno tranquilo
    relaxedTasks: 4,              // tareas del turno tranquilo
    maxCustomers: 3,              // clientes simultáneos en el salón
    spawnMin: 11, spawnMax: 16,   // segundos entre clientes
    patienceWait: 85,             // segundos de paciencia esperando (sin estrés)
    patienceGame: 45,             // segundos de paciencia dentro de un minijuego
    mistakeCost: 0.07,            // paciencia que cuesta un error
    taskFirst: 22, taskMin: 22, taskMax: 32, maxTasks: 2,   // tareas de otras estaciones
    taskPatience: 110,            // segundos antes de que una tarea se venza
    arcadeRounds: 5, arcadeSeconds: 22,
    // La jornada es por cantidad, en tandas: c = clientes, t = tareas del local. Entre tandas hay un respiro.
    // En la Etapa 3 esto lo va a armar la Carrera según el cartel del frente, el clima y la fecha (lluvia, Navidad, Black Friday).
    waves: [{ c: 1, t: 0 }, { c: 2, t: 1 }, { c: 2, t: 1 }, { c: 3, t: 2 }],
    restSeconds: 7,               // respiro entre tandas: habla el Dueño y se ve el local
    maxDayCustomers: 6, maxDayTasks: 2,   // tope por jornada: con esto una jornada dura unos 3 minutos (medido con test/v8.py)
    customerGap: 5.5, taskGap: 7    // segundos entre llegadas dentro de una tanda
  },
  // Cordura: nunca hay Game Over. Sube en los respiros y con las rachas; baja con errores y cuando se junta mucho.
  cord: { start: 60, rest: 2.5, busy: 0.7, busyFrom: 3, mistake: 4, lost: 10, late: 6, streak: 1, focus: 70, burnt: 30, mateBoost: 25, bonus: 3,
    intrOk: 8, intrBad: 4, intrSeconds: 11, intrFromDay: 2 }
};

/* Las 5 etapas del proyecto: se muestran siempre mientras esté en construcción */
/* Etapas de la EXPANSIÓN NACIONAL (el juego base ya está hecho; esto es lo que se construye ahora). */
GS.PHASES = [
  { n: 1, name: 'Curva y tiempos',        desc: 'Medir y ajustar: jornadas de unos 3 minutos y monedas que no sobren ni falten.' },
  { n: 2, name: 'Feedback y resumen',     desc: 'Respuesta inmediata en cada acción y un resumen de jornada con gancho para la siguiente.' },
  { n: 3, name: 'Economía y mostrador',   desc: 'Monedas y fondos de expansión, flota y web, errores que cuestan, limpieza, logros y calendario de 12 meses.' },
  { n: 4, name: 'Mapa y sucursales',      desc: 'Mapa del país, cinco regiones, empleados, delegar y tablero de control.' },
  { n: 5, name: 'Historias y competencia',desc: 'Personajes de cada sucursal en el mostrador, eventos y locales rivales.' },
  { n: 6, name: 'Minijuegos arcade',      desc: 'Stock Tetris, Defensa del mostrador y Cable Runner, como premios fuera de la jornada.' },
  { n: 7, name: 'Finales y rejugar',      desc: 'Finales según cómo se conquistó, Nuevo Juego+ y modificadores.' },
  { n: 8, name: 'Lanzamiento',            desc: 'Pantalla para compartir, guiños del local real y salida a buscadores.' }
];

/* Catálogo: cada producto es un objeto editable. url = ficha real (se conecta después).
   img = foto real del producto (opcional): ruta dentro de la carpeta img/. Si falta, se muestra el ícono. */
GS.CATALOG = [
  { id: 'ps5',      name: 'PlayStation 5 Slim',      cat: 'consolas',    icon: '🎮', price: 1200000, stock: 4, shelf: 'fondo',   url: '' },
  { id: 'switch2',  name: 'Nintendo Switch 2',       cat: 'consolas',    icon: '🕹️', price: 990000,  stock: 3, shelf: 'fondo',   url: '' },
  { id: 'quest',    name: 'Meta Quest 3S',           cat: 'consolas',    icon: '🥽', price: 780000,  stock: 2, shelf: 'fondo',   url: '' },
  { id: 'deck',     name: 'Steam Deck',              cat: 'consolas',    icon: '📟', price: 1080000, stock: 1, shelf: 'fondo',   url: '' },
  { id: 'xbox',     name: 'Xbox Series X',           cat: 'consolas',    icon: '⬛', price: 1140000, stock: 2, shelf: 'fondo',   url: '' },
  { id: 'dualsense',name: 'Joystick DualSense rosa', cat: 'consolas',    icon: '🎮', price: 150000,  stock: 6, shelf: 'fondo',   url: '' },
  { id: 'juego',    name: 'Juego Carpincho Kart',    cat: 'consolas',    icon: '💿', price: 90000,   stock: 9, shelf: 'fondo',   url: '' },
  { id: 'juego2',   name: 'Juego Galaxia Mate',      cat: 'consolas',    icon: '💿', price: 90000,   stock: 5, shelf: 'fondo',   url: '' },
  { id: 'juego3',   name: 'Juego Truco Royale',      cat: 'consolas',    icon: '💿', price: 85000,   stock: 6, shelf: 'fondo',   url: '' },
  { id: 'juego4',   name: 'Juego Subte Runner',      cat: 'consolas',    icon: '💿', price: 85000,   stock: 7, shelf: 'fondo',   url: '' },
  { id: 'ds_blanco',name: 'Joystick DualSense blanco',  cat: 'consolas', icon: '🎮', price: 140000,  stock: 8, shelf: 'fondo',   url: '' },
  { id: 'ds_negro', name: 'Joystick DualSense negro',   cat: 'consolas', icon: '🎮', price: 145000,  stock: 5, shelf: 'fondo',   url: '' },
  { id: 'ds_rojo',  name: 'Joystick DualSense rojo',    cat: 'consolas', icon: '🎮', price: 150000,  stock: 4, shelf: 'fondo',   url: '' },
  { id: 'ds_azul',  name: 'Joystick DualSense azul',    cat: 'consolas', icon: '🎮', price: 150000,  stock: 4, shelf: 'fondo',   url: '' },
  { id: 'ds_violeta',name: 'Joystick DualSense violeta', cat: 'consolas', icon: '🎮', price: 150000, stock: 3, shelf: 'fondo',   url: '' },
  { id: 'airpods',  name: 'AirPods',                 cat: 'apple',       icon: '🎧', price: 360000,  stock: 5, shelf: 'derecha', url: '' },
  { id: 'homepod',  name: 'HomePod Mini',            cat: 'apple',       icon: '🔊', price: 270000,  stock: 2, shelf: 'derecha', url: '' },
  { id: 'magic',    name: 'Magic Mouse',             cat: 'apple',       icon: '🖱️', price: 180000,  stock: 3, shelf: 'derecha', url: '' },
  { id: 'ipad',     name: 'iPad',                    cat: 'apple',       icon: '📱', price: 840000,  stock: 2, shelf: 'derecha', url: '' },
  { id: 'watch',    name: 'Apple Watch',             cat: 'apple',       icon: '⌚', price: 600000,  stock: 1, shelf: 'derecha', url: '' },
  { id: 'gpu',      name: 'Placa de video',          cat: 'pc',          icon: '🧩', price: 900000,  stock: 2, shelf: 'derecha', url: '' },
  { id: 'notebook', name: 'Notebook gamer',          cat: 'pc',          icon: '💻', price: 2100000, stock: 2, shelf: 'mesa',    url: '' },
  { id: 'gabinete', name: 'Gabinete con vidrio',     cat: 'pc',          icon: '🗄️', price: 240000,  stock: 3, shelf: 'mesa',    url: '' },
  { id: 'router',   name: 'Router wifi',             cat: 'pc',          icon: '📡', price: 120000,  stock: 4, shelf: 'izquierda', url: '' },
  { id: 'tinta',    name: 'Cartucho de tinta negra', cat: 'pc',          icon: '🖨️', price: 60000,   stock: 8, shelf: 'izquierda', url: '' },
  { id: 'pendrive', name: 'Pendrive 128 GB',         cat: 'pc',          icon: '💾', price: 30000,   stock: 9, shelf: 'izquierda', url: '' },
  { id: 'cable',    name: 'Cable USB-C',             cat: 'pc',          icon: '🔌', price: 30000,   stock: 9, shelf: 'izquierda', url: '' },
  { id: 'auris',    name: 'Auriculares gamer HyperX',cat: 'perifericos', icon: '🎧', price: 210000,  stock: 5, shelf: 'derecha', url: '' },
  { id: 'mouse',    name: 'Mouse gamer Logitech',    cat: 'perifericos', icon: '🖱️', price: 120000,  stock: 6, shelf: 'derecha', url: '' },
  { id: 'streamdeck',name:'Stream Deck',             cat: 'perifericos', icon: '🎛️', price: 330000,  stock: 1, shelf: 'fondo',   url: '' },
  { id: 'mic',      name: 'Micrófono',               cat: 'perifericos', icon: '🎙️', price: 270000,  stock: 2, shelf: 'fondo',   url: '' },
  { id: 'silla',    name: 'Silla gamer Raptor',      cat: 'perifericos', icon: '💺', price: 450000,  stock: 3, shelf: 'salon',   url: '' },
  { id: 'teclado',  name: 'Teclado mecánico',        cat: 'perifericos', icon: '⌨️', price: 150000,  stock: 5, shelf: 'derecha', url: '' },
  { id: 'webcam',   name: 'Webcam Logitech',         cat: 'perifericos', icon: '📷', price: 120000,  stock: 3, shelf: 'derecha', url: '' },
  { id: 'parlante', name: 'Parlante bluetooth JBL',  cat: 'perifericos', icon: '📻', price: 240000,  stock: 4, shelf: 'derecha', url: '' },
  { id: 'volante',  name: 'Volante con pedales',     cat: 'perifericos', icon: '🏎️', price: 540000,  stock: 1, shelf: 'fondo',   url: '' },
  { id: 'mousepad', name: 'Mousepad XL',             cat: 'perifericos', icon: '🟦', price: 60000,   stock: 7, shelf: 'derecha', url: '' },
  { id: 'joyxbox',  name: 'Joystick de Xbox',        cat: 'consolas',    icon: '🎮', price: 150000,  stock: 5, shelf: 'fondo',   url: '' },
  { id: 'muneco',   name: 'Muñeco coleccionable',    cat: 'consolas',    icon: '🧸', price: 60000,   stock: 8, shelf: 'isla',    url: '' },
  { id: 'monitor',  name: 'Monitor gamer 27"',       cat: 'pc',          icon: '🖥️', price: 600000,  stock: 2, shelf: 'mesa',    url: '' },
  { id: 'impresora',name: 'Impresora Epson',         cat: 'pc',          icon: '🖨️', price: 420000,  stock: 2, shelf: 'fondo',   url: '' },
  { id: 'disco',    name: 'Disco externo 1 TB',      cat: 'pc',          icon: '💽', price: 180000,  stock: 4, shelf: 'izquierda', url: '' },
  { id: 'cargador', name: 'Cargador de notebook',    cat: 'pc',          icon: '🔋', price: 90000,   stock: 6, shelf: 'izquierda', url: '' },
  { id: 'ram',      name: 'Memoria RAM 16 GB',       cat: 'pc',          icon: '📏', price: 120000,  stock: 6, shelf: 'izquierda', url: '' }
];

/* Pedidos del Mostrador: texto ambiguo -> producto correcto */
GS.REQUESTS = [
  { t: 'La Play esa, la blanca finita, la que sale en la tele.', p: 'ps5' },
  { t: 'La consola de Sony. La última. La que mi hijo me pide hace un año.', p: 'ps5' },
  { t: 'La consola blanca alta, la que parece un módem del futuro.', p: 'ps5' },
  { t: 'La Nintendo nueva. La que viene después de la uno.', p: 'switch2' },
  { t: 'La consolita que se enchufa a la tele y también te la llevás al baño.', p: 'switch2' },
  { t: 'La Nintendo de los dos colorcitos a los costados.', p: 'switch2' },
  { t: 'Los anteojos esos para estar adentro del jueguito.', p: 'quest' },
  { t: 'El casco ese de realidad... ¿virtual? ¿aumentada? El casco.', p: 'quest' },
  { t: 'Eso que te ponés en la cabeza y le pegás al aire.', p: 'quest' },
  { t: 'Una compu de mano. Tipo consola, pero que es una PC. ¿Existe?', p: 'deck' },
  { t: 'La Play de mano no: la compu de mano. La de Steam.', p: 'deck' },
  { t: 'Esa consola portátil negra y ancha, para jugar juegos de PC.', p: 'deck' },
  { t: 'La caja negra esa de Microsoft. La heladerita.', p: 'xbox' },
  { t: 'La consola del Game Pass. La grandota.', p: 'xbox' },
  { t: 'La consola negra cuadrada, la que parece un parlante.', p: 'xbox' },
  { t: 'Un joystick de Play, pero que no sea aburrido. Rosa, ponele.', p: 'dualsense' },
  { t: 'El control de la Play nueva, de color.', p: 'dualsense' },
  { t: 'Un mando para la PS5, pero que combine con la pieza de la nena.', p: 'dualsense' },
  { t: 'El joystick de la Play, el blanco, el que viene con la consola.', p: 'ds_blanco' },
  { t: 'Un DualSense clásico, blanco, sin vueltas.', p: 'ds_blanco' },
  { t: 'El mando blanco de la PS5. Al mío lo gasté de tanto perder.', p: 'ds_blanco' },
  { t: 'El joystick de Play negro, que no se le note la mugre.', p: 'ds_negro' },
  { t: 'Un mando de PS5 oscuro y elegante. Como yo.', p: 'ds_negro' },
  { t: 'El DualSense negro medianoche, o como se llame.', p: 'ds_negro' },
  { t: 'El joystick rojo de la Play. Rojo furioso.', p: 'ds_rojo' },
  { t: 'Un mando de PS5 colorado, como la camiseta.', p: 'ds_rojo' },
  { t: 'El DualSense rojo. Dicen que con ese se gana más.', p: 'ds_rojo' },
  { t: 'El joystick azul de la Play. El azul lindo.', p: 'ds_azul' },
  { t: 'Un mando de PS5 azul, tipo cielo de noche.', p: 'ds_azul' },
  { t: 'El DualSense azul. Mi sobrino lo pide desde marzo.', p: 'ds_azul' },
  { t: 'El joystick violeta de la Play.', p: 'ds_violeta' },
  { t: 'Un mando de PS5 violeta, medio galáctico.', p: 'ds_violeta' },
  { t: 'El DualSense lila, púrpura, violeta... ese.', p: 'ds_violeta' },
  { t: 'El de los carpinchos que corren en karting.', p: 'juego' },
  { t: 'El del astronauta que toma mate en el espacio.', p: 'juego2' },
  { t: 'Galaxia Mate, el juego. En caja.', p: 'juego2' },
  { t: 'Ese de naves donde cebás mate. Mi hijo no habla de otra cosa.', p: 'juego2' },
  { t: 'El juego de cartas con espadas y coronas. ¿Truco algo?', p: 'juego3' },
  { t: 'Truco Royale, para regalar.', p: 'juego3' },
  { t: 'El del truco, pero con reyes peleando.', p: 'juego3' },
  { t: 'El del pibe que corre por el subte.', p: 'juego4' },
  { t: 'Subte Runner, el físico.', p: 'juego4' },
  { t: 'Ese de correr por los andenes sin perder la tarjeta.', p: 'juego4' },
  { t: 'Un juego en caja, de los de antes. El de los carpinchos.', p: 'juego' },
  { t: 'Un jueguito de regalo, con cajita y todo. El de las carreras de carpinchos.', p: 'juego' },
  { t: 'Carpincho Kart, el que viene con disco.', p: 'juego' },
  { t: 'Los auriculares de la manzanita. Los que se pierden de a uno.', p: 'airpods' },
  { t: 'Auriculares sin cable. Los blanquitos que parecen hisopos.', p: 'airpods' },
  { t: 'Los auriculares chiquitos que vienen en una cajita blanca.', p: 'airpods' },
  { t: 'El parlantito redondo ese al que le hablás y te ignora.', p: 'homepod' },
  { t: 'El parlante inteligente chiquito, la bolita esa.', p: 'homepod' },
  { t: 'Una bolita que pone música cuando se lo pedís de buena manera.', p: 'homepod' },
  { t: 'El mouse de la manzanita. El que se carga panza arriba.', p: 'magic' },
  { t: 'Un mouse blanco, liso, sin botones a la vista.', p: 'magic' },
  { t: 'El mouse finito de la manzanita, para mi Mac.', p: 'magic' },
  { t: 'Una tablet para el nene. Bah, para mí.', p: 'ipad' },
  { t: 'Una pantalla grande para ver series en la cama. Sin teclado.', p: 'ipad' },
  { t: 'La tablet de la manzanita, la finita.', p: 'ipad' },
  { t: 'El reloj ese que te reta si no caminás.', p: 'watch' },
  { t: 'Un reloj inteligente. Más inteligente que yo, si puede ser.', p: 'watch' },
  { t: 'Un reloj que mide los pasos, el sueño y la culpa.', p: 'watch' },
  { t: 'Algo para que el jueguito ande fluido. Mi hijo dice "la placa".', p: 'gpu' },
  { t: 'Una RTX. No sé qué es, pero mi hijo dijo "RTX" y se emocionó.', p: 'gpu' },
  { t: 'La placa con los tres ventiladores. La que calienta la pieza.', p: 'gpu' },
  { t: 'Una notebook con lucecitas. Para "trabajar".', p: 'notebook' },
  { t: 'Una compu portátil que aguante el jueguito de los tiros.', p: 'notebook' },
  { t: 'Una notebook gamer. Que sea rápida y que brille.', p: 'notebook' },
  { t: 'Una caja para la PC, con vidrio. Para ver cómo junta pelusa.', p: 'gabinete' },
  { t: 'Un gabinete lindo, que se vean las lucecitas de adentro.', p: 'gabinete' },
  { t: 'La torre de la compu, pero vacía. Lo de adentro ya lo tengo.', p: 'gabinete' },
  { t: 'El aparato del wifi. El mío anda, pero quiero uno que ande.', p: 'router' },
  { t: 'Algo para que el wifi llegue al fondo. Al fondo-fondo.', p: 'router' },
  { t: 'El aparatito de las antenitas, para internet.', p: 'router' },
  { t: 'Tinta. Para la impresora. No sé cuál. La negra.', p: 'tinta' },
  { t: 'Un cartucho negro. La impresora dice que está vacío. Miente, pero bueno.', p: 'tinta' },
  { t: 'Tinta negra para imprimir un trabajo práctico para hoy.', p: 'tinta' },
  { t: 'Un cosito para pasar fotos. Con muchos gigas. Muchos.', p: 'pendrive' },
  { t: 'Un pendrive. Grande de capacidad, chiquito de tamaño.', p: 'pendrive' },
  { t: 'Una memoria de esas que se enchufan al costado de la compu.', p: 'pendrive' },
  { t: 'Un cable. El finito. El que va ahí, viste.', p: 'cable' },
  { t: 'El cable para cargar el celu. El nuevo, el ovalado.', p: 'cable' },
  { t: 'Un cable tipo C. Se me pelaron los tres que tenía.', p: 'cable' },
  { t: 'Auriculares con micrófono. Para que mi hijo grite con calidad.', p: 'auris' },
  { t: 'Unos auriculares de esos grandotes, con lucecitas.', p: 'auris' },
  { t: 'Unos auriculares para jugar, con el microfonito que baja.', p: 'auris' },
  { t: 'Un mouse con muchos botones. No sé para qué, pero muchos.', p: 'mouse' },
  { t: 'Un mouse que no sea de oficina. Que tenga onda.', p: 'mouse' },
  { t: 'Un mouse gamer, de los livianitos con luces.', p: 'mouse' },
  { t: 'La botonera esa con pantallitas. La de los streamers.', p: 'streamdeck' },
  { t: 'Esos botoncitos con dibujitos para cambiar de escena en el vivo.', p: 'streamdeck' },
  { t: 'El tablerito de botones para streamear.', p: 'streamdeck' },
  { t: 'Un micrófono. Arranco un podcast. Este año sí.', p: 'mic' },
  { t: 'Un micrófono para dar clases online. Y cantar, a veces.', p: 'mic' },
  { t: 'Un micrófono de mesa, de los que usan los youtubers.', p: 'mic' },
  { t: 'Una silla de auto de carrera, pero para estar sentado quieto.', p: 'silla' },
  { t: 'Una silla para la compu. Me duele la espalda y el alma.', p: 'silla' },
  { t: 'El sillón ese de streamer, con almohadita para el cuello.', p: 'silla' },
  { t: 'Un teclado de los que hacen ruido. Clac, clac. De esos.', p: 'teclado' },
  { t: 'El teclado con luces que usan los pibes.', p: 'teclado' },
  { t: 'Un teclado mecánico, de teclas altas.', p: 'teclado' },
  { t: 'Una camarita para las reuniones. Que me favorezca.', p: 'webcam' },
  { t: 'Una cámara para la compu. La de la notebook me hace cara de susto.', p: 'webcam' },
  { t: 'Una camarita para dar clases por videollamada.', p: 'webcam' },
  { t: 'Un parlante para la pileta. Que suene fuerte y aguante.', p: 'parlante' },
  { t: 'Un parlante portátil, de los que se mojan y no pasa nada.', p: 'parlante' },
  { t: 'Un parlantito bluetooth para el asado.', p: 'parlante' },
  { t: 'Un volante para jugar a los autitos. Con pedales y todo.', p: 'volante' },
  { t: 'El volante para la Play, con la palanquita.', p: 'volante' },
  { t: 'Algo para manejar en el jueguito de carreras, como en un auto.', p: 'volante' },
  { t: 'La alfombrita del mouse, pero de las gigantes.', p: 'mousepad' },
  { t: 'Un pad grande, que entren el teclado y el mouse.', p: 'mousepad' },
  { t: 'Algo para apoyar el mouse, que el vidrio de la mesa lo vuelve loco.', p: 'mousepad' },
  { t: 'Un control para la Xbox. El otro se rompió "solo".', p: 'joyxbox' },
  { t: 'Un joystick de Xbox, que también sirva para la PC.', p: 'joyxbox' },
  { t: 'El mando negro, el de los botones de colores.', p: 'joyxbox' },
  { t: 'Un muñequito de esos cabezones, para regalar.', p: 'muneco' },
  { t: 'Una figurita coleccionable, de las de cabeza grande.', p: 'muneco' },
  { t: 'Un muñeco para el escritorio. Es para mí, no para un nene.', p: 'muneco' },
  { t: 'Una pantalla para la compu. Grande. Que se vea rápido.', p: 'monitor' },
  { t: 'Un monitor gamer, de esos de muchos hercios.', p: 'monitor' },
  { t: 'Un monitor de 27. Pulgadas, no años.', p: 'monitor' },
  { t: 'Una impresora que imprima. La mía solo pide tinta.', p: 'impresora' },
  { t: 'Una impresora para el nene, que tiene que imprimir todo.', p: 'impresora' },
  { t: 'Una impresora con escáner. Para escanear el DNI una vez por año.', p: 'impresora' },
  { t: 'Un disco para guardar las fotos, de los que van afuera de la compu.', p: 'disco' },
  { t: 'Un disco externo, para hacer backup antes de que sea tarde.', p: 'disco' },
  { t: 'Un disco de un tera, de los portátiles.', p: 'disco' },
  { t: 'El cargador de la notebook. Al otro se lo comió el perro.', p: 'cargador' },
  { t: 'Un cargador para la notebook, el mío hace chispitas.', p: 'cargador' },
  { t: 'El transformador de la compu portátil. El cuadradito con cable.', p: 'cargador' },
  { t: 'Memoria para la compu. De la que la hace más rápida, no de la otra.', p: 'ram' },
  { t: 'Dieciséis gigas de RAM. Me dijeron que con eso vuela.', p: 'ram' },
  { t: 'Una plaquita de memoria, de las verdes y largas.', p: 'ram' }
];

/* Producto "parecido" a cada uno: siempre aparece entre las opciones del mostrador para confundir */
GS.SIMILAR = { ps5: 'xbox', xbox: 'ps5', switch2: 'deck', deck: 'switch2', quest: 'auris', dualsense: 'ds_rojo', joyxbox: 'ds_negro', juego: 'juego3', muneco: 'juego', juego2: 'juego4', juego3: 'juego', juego4: 'juego2',
  ds_blanco: 'ds_negro', ds_negro: 'ds_blanco', ds_rojo: 'dualsense', ds_azul: 'ds_violeta', ds_violeta: 'ds_azul',
  airpods: 'auris', auris: 'airpods', homepod: 'parlante', parlante: 'homepod', magic: 'mouse', mouse: 'magic', ipad: 'notebook', watch: 'airpods', gpu: 'ram', ram: 'gpu',
  notebook: 'monitor', monitor: 'ipad', gabinete: 'xbox', router: 'disco', tinta: 'impresora', impresora: 'tinta', pendrive: 'disco', disco: 'pendrive', cable: 'cargador', cargador: 'cable',
  streamdeck: 'teclado', teclado: 'streamdeck', mic: 'webcam', webcam: 'mic', silla: 'volante', volante: 'joyxbox', mousepad: 'teclado' };

/* Mejoras del local: lugares fijos. Se compran con las monedas que deja cada jornada.
   pos = dónde hace zoom la cámara. Cada nivel es un "modelo" con su precio y su efecto. */
GS.UPGRADES = [
  { id: 'cartel', name: 'Cartel del frente', icon: '🪧', pos: [0, 10.5], zoom: 0.6, base: 'Cartel pintado',
    levels: [{ n: 'Cartel luminoso', d: 'Se ve desde la esquina: +1 cliente por jornada.', price: 400 }, { n: 'Cartel pantalla LED', d: 'El mejor cartel de la cuadra: +2 clientes por jornada.', price: 1250 }] },
  { id: 'sillas', name: 'Sillas gamer', icon: '💺', pos: [-4.6, 2.9], levels: [{ n: 'Sillas gamer de exhibición', d: 'Los clientes esperan cómodos: +10% de paciencia.', price: 180 }] },
  { id: 'mesa', name: 'Mesa de PC', icon: '💻', pos: [2.2, 1.5], levels: [{ n: 'Mesa de PC y accesorios', d: 'Más para vender: +10% de monedas por jornada.', price: 200 }] },
  { id: 'isla', name: 'Isla Apple', icon: '🍏', pos: [-3.2, 0.4], levels: [{ n: 'Isla de productos Apple', d: 'Más para vender: +10% de monedas por jornada.', price: 250 }] },
  { id: 'gondola', name: 'Góndola de periféricos', icon: '🎧', pos: [5.0, 2.7], levels: [{ n: 'Góndola de periféricos gamer', d: 'Más para vender: +10% de monedas por jornada.', price: 300 }] },
  { id: 'arcade', name: 'Arcade en la entrada', icon: '🕹️', pos: [0.7, 8.3], levels: [{ n: 'Arcade en la galería', d: 'Llama la atención desde la vereda: +1 cliente por jornada.', price: 350 }] },
  { id: 'escritorio', name: 'Escritorio gamer', icon: '🖥️', pos: [2.0, 4.6], levels: [{ n: 'Escritorio gamer para probar', d: 'Los clientes se entretienen: +15% de paciencia.', price: 450 }] },
  { id: 'plantas', name: 'Plantas y alfombra', icon: '🪴', pos: [-3.4, 5.0], levels: [{ n: 'Plantas y alfombra de entrada', d: 'El local se ve cuidado: se ensucia la mitad.', price: 220 }] },
  { id: 'cafetera', name: 'Cafetera', icon: '☕', pos: [0.3, -5.6], zoom: 0.3, levels: [{ n: 'Cafetera detrás del mostrador', d: 'Café para el que espera: +10% de paciencia de los clientes.', price: 280 }] },
  { id: 'luces', name: 'Luces LED', icon: '💡', pos: [-1.5, -4.6], zoom: 0.5, levels: [{ n: 'Tiras LED en el salón', d: 'Todo se luce más: +10% de monedas por jornada.', price: 320 }] },
  { id: 'vidluz', name: 'Vidriera iluminada', icon: '🪟', pos: [3.6, 8.5], zoom: 0.45, levels: [{ n: 'Luces en la vidriera', d: 'Se ve desde la vereda de enfrente: +1 cliente y más gente que entra por la vidriera.', price: 500 }] },
  { id: 'flota', name: 'Flota de envíos', icon: '🛵', pos: [4.2, 15.6], zoom: 0.46, levels: [
    { n: 'Moto de reparto', d: 'Envío propio en la ciudad: cada compra por la página deja 20% más y suma reputación.', price: 400 },
    { n: 'Camioneta', d: 'Llegás a toda la provincia: 40% más por cada compra por la página.', price: 900 },
    { n: 'Camión GameShop', d: 'Cubrís toda la región con envío propio: 60% más por compra web. Con el camión y 5 estrellas, la región está conquistada.', price: 1600 }] },
  { id: 'web', name: 'Página web', icon: '🌐', pos: [-3.4, -4.0], zoom: 0.3, levels: [
    { n: 'Web con buscador', d: 'www.gameshop.com.ar se encuentra fácil: entra una compra por la página más por jornada.', price: 300 },
    { n: 'Web con retiro en el local', d: 'Compran desde casa y pasan a buscar: más clientes (tickets más altos).', price: 700 },
    { n: 'Web con seguimiento de envíos', d: 'Saben dónde está su paquete: 10% más de monedas y mejor reputación.', price: 1300 }] },
  { id: 'caja2', name: 'Segunda caja', icon: '🧾', pos: [2.6, -3.6], zoom: 0.3, levels: [{ n: 'Segunda caja con Brian', d: 'Si estás ocupado con otra tarea o se juntan clientes para pagar, Brian va a la caja y les cobra por vos. No perdés ventas por la cola.', price: 600 }] }
];
GS.RANKS = [[1, 'Vendedor nuevo'], [3, 'Vendedor'], [5, 'Vendedor senior'], [8, 'Encargado'], [11, 'Mano derecha del Dueño']];
/* Condiciones del día: cambian cuánta gente viene y cuántos pedidos salen */
GS.CONDITIONS = {
  nieve: { name: '❄️ Día de nieve', say: 'Con la nieve va a venir menos gente al local, pero van a entrar más compras por la página.', cust: -2, ml: 2 },      // en Cuyo y Patagonia, la lluvia es nieve
  lluvia: { name: '🌧️ Día de lluvia', say: 'Va a venir menos gente al local, pero van a entrar más compras por la página.', cust: -2, ml: 2 },
  blackfriday: { name: '🏷️ Black Friday', say: 'Viene más gente y entran muchas compras por la página. Tranquilos, que se puede.', cust: 2, ml: 2 },
  navidad: { name: '🎄 Semana de Navidad', say: 'Todos compran regalos a último momento. Paciencia y buena cara.', cust: 2, ml: 1 }
};
GS.HAIRSTYLES = [['corto', 'Corto'], ['largo', 'Largo'], ['rodete', 'Rodete'], ['rulos', 'Rulos'], ['mohicano', 'Mohicano'], ['pelado', 'Pelado']];
GS.SKINS = [0xf6d7bd, 0xf2c9a0, 0xe0ac7e, 0xc68a5c, 0x9a643c, 0x6b4428];
GS.HAIRS = [0x000000, 0x2b2b3a, 0x4a3a2a, 0x7a3b1e, 0xd9a514, 0xc9c9d6, 0x2d6cdf, 0xff5fa2, 0x3bb54a];

/* Progresión: qué estaciones se suman en cada jornada (de menos a más) y cómo las explica el Dueño */
GS.UNLOCKS = [['mostrador', 'caja'], ['whatsapp', 'cierre'], ['repo', 'stock', 'vidriera'], ['ml', 'proveedor'], ['pc', 'service'], ['devol']];
GS.EXPLAIN = {
  adornos: 'Mañana empieza la semana de Navidad. Elegí el árbol, las guirnaldas y las luces: como lo armes hoy, así amanece el local.',
  vidriera: 'Armá la vidriera según el tema: elegí los 4 productos que mejor van. Si queda bien, va a entrar gente diciendo que lo vio ahí.',
  mostrador: 'El cliente pide como puede. Vos elegís el producto correcto. Ojo: siempre hay uno parecido para confundirte.',
  caja: 'Al cobrar: 10% OFF en efectivo o transferencia, y 3 cuotas sin interés con tarjeta. Si te muestran un comprobante, compará cada dato antes de aprobar. Si hay uno incorrecto, selecciónalo.',
  whatsapp: 'Contestá con el dato correcto y buena onda. Cada respuesta cuida nuestra reputación.',
  cierre: 'Antes de irnos a las 19, sumá los cobros en efectivo y fijate si coincide con lo que hay en el cajón.',
  repo: 'En el depósito, cada caja va a su estantería. Tocá la estantería que corresponde.',
  stock: 'Contá lo que hay de verdad en la góndola. El sistema a veces sueña.',
  ml: 'Son las compras que entran por www.gameshop.com.ar. Caja del tamaño justo, cinta de punta a punta y la etiqueta correcta. Lo que se compra antes de las 14 sale en el día.',
  proveedor: 'Compará el remito con lo que bajó de la carreta. Si falta algo, no firmes.',
  pc: 'En el taller: elegí cada pieza y tocá dónde va en la placa. Si una viene al revés, tocala de nuevo para girarla.',
  service: 'En el taller: diagnosticá con criterio, limpiá con paciencia y encajá la memoria justo en la ranura.',
  devol: 'Para una devolución mirá las tres reglas: ticket, plazo y estado. Si cumple, se acepta con una sonrisa.'
};

/* Clientes: arquetipos inventados (ninguno es una persona real) */
/* Regiones: una sucursal por región. Cada una con su ciudad, su paleta, sus modismos (siempre con cariño), su rival y 4 candidatos (se eligen 2). */
GS.REGIONS = [
  { id: 'pampeana', name: 'Pampeana', city: 'Buenos Aires', cost: 0, prov: ['Ciudad de Buenos Aires', 'Buenos Aires', 'Córdoba', 'Santa Fe', 'Entre Ríos', 'La Pampa'], clima: 'Templado y húmedo, con las cuatro estaciones bien marcadas. Los días malos son de lluvia.', decor: 'ciudad', why: 'El local original, en Av. de los Incas. Desde acá salen los envíos a Buenos Aires, Córdoba, Santa Fe, Entre Ríos y La Pampa.', hi: [] },
  { id: 'cuyo', name: 'Cuyo', city: 'Mendoza', cost: 2600, prov: ['Mendoza', 'San Juan', 'San Luis'], clima: 'Seco y soleado al pie de la cordillera: veranos calurosos, inviernos fríos y viento Zonda. Acá los días malos no son de lluvia: son de nieve.', floor: 0xf3d9c4, wall: 0xf6ead8, decor: 'cuyo', why: 'Con base en Mendoza, los envíos a San Juan y San Luis salen en el día.',
    hi: ['¡Buenas! Vengo después de la siesta, como corresponde.', 'Hola, ¿todo bien? Está lindo para unas tortitas con mate.', '¡Qué calor que hace! Menos mal que acá hay sombra.', 'Buenas, vecino. Vengo antes de la Vendimia, que después no hay tiempo.', 'Hola. Dejé la bici en la acequia, no tardo.'],
    rival: { name: 'Zonda Gamer', owner: 'Don Ulises', rule: 'Cuando sopla el Zonda, baja los precios y te lleva clientes.', fx: 'Los días de Zonda (casi la mitad), los clientes tienen 20% menos de paciencia.' },
    crew: [{ id: 'maru', name: 'Maru', d: 'Ordenada: etiqueta hasta el mate.', look: { skin: 0xe0ac7e, hair: 0x5a2d0c, hairStyle: 'largo', glasses: false } }, { id: 'nacho', name: 'Nacho', d: 'Sabe de PC más que el manual.', look: { skin: 0xf2c9a0, hair: 0x1b1b1f, hairStyle: 'corto', glasses: true } },
      { id: 'flor', name: 'Flor', d: 'Vende hielo en la cordillera.', look: { skin: 0xc68a5c, hair: 0xd9a514, hairStyle: 'rodete', glasses: false } }, { id: 'tomi', name: 'Tomi', d: 'Lento pero no se le escapa una.', look: { skin: 0xf6d7bd, hair: 0xb5651d, hairStyle: 'rulos', glasses: false } }] },
  { id: 'noa', name: 'NOA', city: 'Salta', cost: 1600, prov: ['Jujuy', 'Salta', 'Tucumán', 'Catamarca', 'La Rioja', 'Santiago del Estero'], clima: 'Seco y de altura en los valles y la puna, cálido en el llano. Mucho sol, y las lluvias llegan en verano.', floor: 0xf0cdb0, wall: 0xf7e3cf, decor: 'noa', why: 'Desde Salta se llega fácil a Jujuy, Tucumán, Catamarca, La Rioja y Santiago del Estero.',
    hi: ['Buen día, chango. ¿Cómo anda?', '¡Buenas! Vengo de comer unas empanadas, no me apure.', 'Hola, changuito. Qué lindo local, che.', 'Buenas tardes. A la noche hay peña, pero antes paso por acá.', 'Hola. Bajé del cerro nomás para esto.'],
    rival: { name: 'Pachamama Play', owner: 'Doña Ramona', rule: 'Regala una empanada con cada compra. Difícil competir con eso.', fx: 'Cada cliente que se va sin comprar le cuesta más a tu reputación: se va derecho a lo de Ramona.' },
    crew: [{ id: 'coya', name: 'Mayra', d: 'Tranquila: nada la apura ni la altera.', look: { skin: 0x9a643c, hair: 0x1b1b1f, hairStyle: 'largo', glasses: false } }, { id: 'rami', name: 'Ramiro', d: 'Canta coplas mientras repone.', look: { skin: 0xc68a5c, hair: 0x1b1b1f, hairStyle: 'corto', glasses: false } },
      { id: 'lucia', name: 'Lucía', d: 'Cobra más rápido que el viento.', look: { skin: 0xe0ac7e, hair: 0x5a2d0c, hairStyle: 'rodete', glasses: true } }, { id: 'beto', name: 'Beto', d: 'Conoce a todo el barrio por el nombre.', look: { skin: 0x9a643c, hair: 0x3a2a1a, hairStyle: 'rulos', glasses: false } }] },
  { id: 'nea', name: 'NEA', city: 'Posadas', cost: 1600, prov: ['Misiones', 'Corrientes', 'Chaco', 'Formosa'], clima: 'Subtropical: calor y humedad casi todo el año, lluvias fuertes y siesta obligada.', floor: 0xeab59a, wall: 0xf3ecd6, decor: 'nea', why: 'Desde Posadas se cubre Misiones, Corrientes, Chaco y Formosa.',
    hi: ['¡Hola, chamigo! ¿Todo bien?', 'Buenas. Traje el tereré, ¿querés?', '¡Qué calor, chamigo! Menos mal el aire.', 'Hola. Vengo con chipá recién hecha, convido después.', 'Buenas, che. Crucé el río nomás para venir.'],
    rival: { name: 'Yacaré Games', owner: 'El Tío Chelo', rule: 'A la hora de la siesta no cierra. Dice que duerme con un ojo.', fx: 'A la hora de la siesta te saca un cliente del local; a cambio entra una compra más por la página.' },
    crew: [{ id: 'yami', name: 'Yamila', d: 'Ceba tereré y despacha a la vez.', look: { skin: 0xc68a5c, hair: 0x1b1b1f, hairStyle: 'largo', glasses: false } }, { id: 'guille', name: 'Guille', d: 'Arregla cualquier cosa con cinta.', look: { skin: 0xe0ac7e, hair: 0x5a2d0c, hairStyle: 'corto', glasses: false } },
      { id: 'ani', name: 'Ani', d: 'Le sonríe hasta al proveedor.', look: { skin: 0xf2c9a0, hair: 0xb5651d, hairStyle: 'rulos', glasses: true } }, { id: 'pocho', name: 'Pocho', d: 'Nunca faltó. Ni cuando llovió tres días.', look: { skin: 0x9a643c, hair: 0x3a2a1a, hairStyle: 'pelado', glasses: false } }] },
  { id: 'patagonia', name: 'Patagonia', city: 'Bariloche', cost: 1800, prov: ['Neuquén', 'Río Negro', 'Chubut', 'Santa Cruz', 'Tierra del Fuego'], clima: 'Frío y ventoso, con inviernos largos. Los días malos son de nieve y la gente anda abrigada.', floor: 0xdfe6ee, wall: 0xeaf2f8, decor: 'patagonia', why: 'Desde Bariloche salen los envíos a Neuquén, Río Negro, Chubut, Santa Cruz y Tierra del Fuego.',
    hi: ['¡Buenas! Afuera el viento te despeina hasta las ideas.', 'Hola. Está fresquito, ¿no? Apenas dos bajo cero.', 'Buenas. Vine caminando: son veinte cuadras, acá es cerquita.', 'Hola, vecino. Después paso por un chocolate, ¿venís?', 'Buenas. Cerré la tranquera y me vine.'],
    rival: { name: 'Ventisca Gaming', owner: 'El Ruso Iván', rule: 'Vende todo con campera de regalo. Nadie sabe de dónde saca las camperas.', fx: 'Para competir con la campera hay que ajustar precios: cada jornada deja 15% menos de monedas.' },
    crew: [{ id: 'sol', name: 'Sol', d: 'Atiende con guantes y no erra un precio.', look: { skin: 0xf6d7bd, hair: 0xd9a514, hairStyle: 'largo', glasses: false } }, { id: 'lauti', name: 'Lauti', d: 'Hace los envíos aunque nieve.', look: { skin: 0xf2c9a0, hair: 0x5a2d0c, hairStyle: 'rulos', glasses: false } },
      { id: 'ema', name: 'Ema', d: 'Sabe de consolas y de fogones.', look: { skin: 0xe0ac7e, hair: 0x1b1b1f, hairStyle: 'rodete', glasses: true } }, { id: 'vasco', name: 'El Vasco', d: 'Habla poco. Vende mucho.', look: { skin: 0xf6d7bd, hair: 0xb4b4bd, hairStyle: 'corto', glasses: false } }] },
  /* Final oculto: aparece en el mapa recién cuando las 5 regiones están completas. */
  { id: 'malvinas', secret: true, name: 'Malvinas', city: 'Puerto Argentino', cost: 3000, prov: ['Islas Malvinas'], clima: 'Frío oceánico, viento casi todos los días y llovizna. Todo el mundo abrigado.', floor: 0xdfe8e2, wall: 0xeef3f1, decor: 'malvinas', why: 'La sucursal más austral y la más esperada. Los envíos llegan en barco, con viento a favor.',
    hi: ['¡Buenas! Con este viento, llegué antes de lo que pensaba.', 'Hola. Dejé las ovejas mirando la vidriera.', 'Buen día. Qué lindo ver este cartel acá.', 'Hola, vecino. Afuera hay un pingüino esperando turno.'],
    rival: { name: 'Pirata Gaming', owner: 'El Capitán Tormenta', rule: 'Dice que las islas son suyas porque llegó en barco. Te "toma prestados" los carteles, los toldos y a veces los pedidos.', fx: 'Cada jornada se "lleva prestado" algo: hay una tarea más para resolver.' },
    crew: [{ id: 'malena', name: 'Malena', d: 'Ata todo dos veces, por el viento.', look: { skin: 0xf2c9a0, hair: 0x5a2d0c, hairStyle: 'largo', glasses: false } }, { id: 'fermin', name: 'Fermín', d: 'Fue farero: no se le pasa un barco ni un pedido.', look: { skin: 0xe0ac7e, hair: 0xb4b4bd, hairStyle: 'corto', glasses: false } },
      { id: 'isla', name: 'Isla', d: 'Nació acá. Conoce a cada vecino y a cada oveja.', look: { skin: 0xf6d7bd, hair: 0xd9a514, hairStyle: 'rodete', glasses: true } }, { id: 'nahuel', name: 'Nahuel', d: 'Vino por una semana. Hace dos años.', look: { skin: 0xc68a5c, hair: 0x1b1b1f, hairStyle: 'rulos', glasses: false } }] }
];
/* Finales: según cómo se conquistó el país. test(st, días). El primero que cumple, gana. El secreto no se anuncia. */
GS.FINALS = [
  { id: 'secreto', ic: '🗝️', t: 'Las llaves', d: 'Ni un vuelto mal dado, ni un piso sucio, y jornadas impecables de sobra. El Dueño te deja un llavero sobre el mostrador: "Yo me voy a pescar. El país es tuyo."', test: (st, d) => !st.vueltoMal && !st.sucio && st.perfect >= 10 },
  { id: 'relampago', ic: '⚡', t: 'Conquista relámpago', d: 'Cinco regiones en tiempo récord. En Incas todavía no terminaron de colgar el mapa y ya está completo.', test: (st, d) => d <= 40 },
  { id: 'prolijo', ic: '✨', t: 'A paso firme', d: 'Tardaste lo que había que tardar, y cada sucursal quedó impecable. Así se construye una marca.', test: (st, d) => st.perfect >= d * 0.35 },
  { id: 'ponchazos', ic: '🤠', t: 'A los ponchazos', d: 'Hubo ventas perdidas, vueltos generosos y algún piso dudoso. Pero el cartel está encendido en todo el país, y eso no te lo saca nadie.', test: () => true }
];
/* Nuevo Juego+: se vuelve a empezar con los premios y logros, y un modificador a elección. */
GS.FINAL_M = { t: 'Las Malvinas', d: 'Pirata Gaming levó anclas y la sucursal más austral quedó completa. Al cierre, todo el equipo salió a la vereda y plantó la bandera; el viento, por una vez, ayudó y la dejó bien extendida. La noticia cruzó el mar: de La Quiaca a Ushuaia hubo bocinazos, y en Incas el Dueño lloró un poquito (dice que fue el viento). GameShop llegó a todo el país. A todo.' };
/* Finales en imágenes. art: 'yo' retrato del jugador · 'equipo' todos los equipos · 'mapa' país encendido · 'copa' trofeo con los números · 'dueno' el Dueño ·
   'sur' el mapa acercado a las islas · 'duelo' jugador contra pirata · 'barco' el pirata se va · 'bandera' · 'islas' las islas con sucursal y bandera · 'pais' todo el mapa. */
GS.EPIC = {
  pais: [
    { art: 'yo', k: 'Av. de los Incas 4552', t: 'Todo empezó detrás de un mostrador', d: 'Un local, dos compañeros, un Dueño con una frase para cada cosa y una misión que parecía demasiado grande.' },
    { art: 'equipo', k: 'Jornada tras jornada', t: 'Cinco regiones, cinco equipos', d: 'Abriste cada sucursal, elegiste a su gente, les enseñaste el oficio y le ganaste a cada rival con lo de siempre: atender bien.' },
    { art: 'mapa', k: 'Misión cumplida', t: 'GameShop está en todo el país', d: 'De Salta a Bariloche y de Mendoza a Posadas, hay un cartel de GameShop encendido y un envío que llega más rápido.' },
    { art: 'copa', k: 'El logro', t: 'Número uno en reputación y ventas', d: 'Cinco sucursales, cinco estrellas en cada una y camión propio en todas. Nadie atiende mejor ni llega más lejos.' },
    { art: 'dueno', k: 'El Dueño opina', t: '', d: '' },
    { art: 'sur', k: 'Un momento...', t: '¿O no era todo?', d: 'Dicen que en el mapa apareció algo nuevo, bien al sur. Y que alguien llegó en barco diciendo que es suyo.' }
  ],
  malvinas: [
    { art: 'duelo', k: 'Puerto Argentino', t: 'El duelo final', d: 'Todo el pueblo hizo fila en los dos locales. El que atendiera a todos sin un error se quedaba en las islas.' },
    { art: 'barco', k: 'Pirata Gaming', t: 'El pirata levó anclas', d: 'Su fila se pasó a la nuestra. Hasta su loro. El Capitán Tormenta subió al barco y dijo: "Las islas son de ustedes. Siempre lo fueron."' },
    { art: 'bandera', k: 'Al cierre', t: 'Y plantamos la bandera', d: 'Todo el equipo salió a la vereda. El viento, por una vez, ayudó: la dejó bien extendida.' },
    { art: 'islas', k: 'La sucursal más austral', t: 'Las Malvinas tienen su GameShop', d: 'Mejoras completas, cinco estrellas, camión, el farero de cliente y los pingüinos mirando la vidriera.' },
    { art: 'pais', k: 'De La Quiaca a Puerto Argentino', t: 'Toda la Argentina lo festejó', d: 'La noticia cruzó el mar. Hubo bocinazos en cada ciudad donde hay un cartel de GameShop. O sea, en todas.' },
    { art: 'dueno', k: 'En Incas', t: 'El Dueño lloró un poquito', d: 'Dice que fue el viento. GameShop llegó a todo el país. A todo.' }
  ]
};
GS.MODS = [
  { id: 'apuro', ic: '⏱️', name: 'Clientes apurados', d: 'Esperan un 25% menos. A cambio, 50% más de fondos de expansión.' },
  { id: 'sinrespiro', ic: '🔥', name: 'Sin respiros', d: 'Los respiros duran la mitad. A cambio, 30% más de monedas.' },
  { id: 'lupa', ic: '🔍', name: 'Auditoría permanente', d: 'Los errores de caja cuestan el doble. A cambio, 50% más de fondos.' },
  { id: '', ic: '🎮', name: 'Sin modificador', d: 'El juego tal cual, con lo que ya ganaste.' }
];
/* Primera vez: el Dueño explica la misión sobre el mapa. El último paso pide tocar Buenos Aires. */
GS.ONBOARD = [
  { art: 'jefe', k: 'Tu primer día', t: 'Bienvenido a GameShop', d: 'Soy el Dueño. Te contraté para algo grande: llevar GameShop a todo el país.' },
  { art: 'mapa0', k: 'La misión', t: 'Una sucursal en cada región', d: 'Hoy hay una sola: la nuestra, en Buenos Aires. Desde cada región se envía más fácil a todas sus provincias.' },
  { art: 'recursos', k: 'Cómo se logra', t: 'Estrellas, monedas y fondos', d: 'Para abrir una sucursal nueva hacen falta tres cosas: 5 estrellas, el camión (se compra con monedas) y los fondos de expansión.' },
  { art: 'jefe2', k: 'El Dueño', t: 'Podemos hacer mucho', d: 'Por GameShop. Y quién sabe: por el país. Empecemos por casa: elegí Buenos Aires en el mapa.' }
];
/* Consejos del Dueño: aparecen una sola vez, la primera vez que pasa cada cosa. */
GS.TIPS = {
  resumen: 'Así cerró el día. Las <b>🪙 monedas</b> son para <b>mejorar el local</b> y comprar el camión. Los <b>🗺️ fondos</b> se juntan solos y sirven solo para <b>abrir sucursales</b>. Más abajo vas a ver siempre qué te falta para la próxima.',
  tienda: 'Tocá una mejora para verla en el local. Las que tienen niveles se pueden mirar aunque todavía no te alcance.',
  mapa: 'Tocá una región para ver su sucursal. Para abrir una nueva hacen falta tres cosas: <b>5 estrellas</b> y <b>camión</b> (se compra con 🪙 monedas) en las que ya tenés, y los <b>🗺️ fondos de expansión</b>, que se juntan solos jornada a jornada.',
  mancha: '🧹 Dejaron una mancha. Cuando tengas un rato libre, tocá <b>Limpiar el piso</b>: terminar con el local sucio baja la reputación.',
  ensenar: '🎓 En las sucursales nuevas, en los respiros podés <b>enseñarle al equipo</b>. Cuanto más saben, más tareas resuelven solos.',
  errores: 'Desde hoy, ojo: si le das <b>otro producto</b>, el cliente se va. Y cobrar mal baja la reputación.',
  sucursal: 'Sucursal nueva: empezás con un local humilde. Llevala a <b>5 estrellas</b> y comprale el <b>camión</b>: con eso la región queda conquistada. Yo te llamo cada tanto.',
  evento: 'A veces pasa algo inesperado. Elegí con criterio: lo que decidas deja huella en la reputación o en la caja.',
  rival: '⚔️ Mientras el rival de la zona siga dando pelea, su regla te complica cada jornada. Cuando venga al mostrador, <b>ganale</b>: la regla se va y esta sucursal rinde 10% más.',
  reparto: 'Cada cierre elegís a dónde va lo del día: <b>al local</b> (más monedas para mejoras) o <b>a la expansión</b> (más fondos para abrir sucursales). No alcanza para todo a la vez.',
  arcade: '🕹️ Ganaste un juego nuevo. Está en <b>Arcade</b>, en el inicio: si llegás a la meta, te llevás un premio para tu personaje.'
};
GS.MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];   // 1 jornada = 1 mes
GS.SANTA = { id: 'santa', name: 'Papá Noel', face: '🎅', shirt: 0xd81e2c, hair: 0xffffff, tag: 'Compras de último momento',
  look: { hairStyle: 'corto', beard: true, glasses: true, lips: false, lashes: false, hat: 'gorro', pants: 0x23232b, skin: 0xf2c9a0 },
  bye: 'Jo, jo, jo. El trineo no tiene baúl: ¿hacen envíos al Polo?', lost: 'Me voy, que los renos están en doble fila.' };
/* Logros: st = totales de toda la partida (se guardan solos). hidden = no se ve el nombre hasta conseguirlo. */
GS.ACHIEVEMENTS = [
  { id: 'primera', ic: '🛍️', name: 'Primera venta', d: 'Concretá tu primera venta.', test: st => st.c >= 1 },
  { id: 'cien', ic: '💯', name: 'Cien clientes', d: 'Atendé a 100 clientes.', test: st => st.c >= 100 },
  { id: 'impecable', ic: '✨', name: 'Jornada impecable', d: 'Terminá una jornada sin errores ni ventas perdidas.', test: st => st.perfect >= 1 },
  { id: 'tres', ic: '🔥', name: 'Tres al hilo', d: 'Tres jornadas impecables seguidas.', test: st => st.streak >= 3 },
  { id: 'halcon', ic: '🦅', name: 'Ojo de halcón', d: 'Frená 5 comprobantes truchos.', test: st => st.caught >= 5 },
  { id: 'cinta', ic: '📦', name: 'Cinta, caja y etiqueta', d: 'Despachá 10 compras por la página.', test: st => st.web >= 10 },
  { id: 'escoba', ic: '🧹', name: 'Escoba nueva barre bien', d: 'Limpiá 20 manchas.', test: st => st.clean >= 20 },
  { id: 'palos', ic: '💰', name: 'Diez palos', d: 'Facturá 10 millones (ficticios) en total.', test: st => st.sales >= 10000000 },
  { id: 'cinco', ic: '⭐', name: 'Cinco estrellas', d: 'Llevá la reputación a 4,8 o más.', test: st => st.rep >= 4.8 },
  { id: 'platino', ic: '💎', name: 'Sucursal de platino', d: 'Completá una sucursal al 100%: todas las mejoras y todas las historias.', test: st => st.platino >= 1 },
  { id: 'camion', ic: '🚚', name: 'Con camión propio', d: 'Llevá la flota de envíos hasta el camión.', test: st => st.flota >= 3 },
  { id: 'generoso', ic: '💸', name: 'Generoso sin querer', d: 'Diste vuelto de más.', hidden: true, test: st => st.vueltoMal >= 1 },
  { id: 'piso', ic: '🍽️', name: 'Se puede comer en el piso', d: 'Cinco jornadas terminadas sin una mancha.', hidden: true, test: st => st.limpio >= 5 },
  { id: 'noel', ic: '🎅', name: 'Lista de regalos', d: 'Le vendiste a Papá Noel.', hidden: true, test: st => st.santa >= 1 },
  { id: 'chiquero', ic: '🐷', name: 'Esto es un chiquero', d: 'Cerraste una jornada con el piso lleno de manchas.', hidden: true, test: st => st.sucio >= 1 }
];
GS.CUSTOMERS = [
  { id: 'cosCarpi', name: 'Capitán Carpincho', face: '🦫', shirt: 0x2d6cdf, hair: 0x8a5a2b, hat: 'orejas', tag: 'Disfrazado del héroe de Carpincho Kart',
    bye: '¡A fondo y con mate! Perdón, es la frase del personaje.', lost: 'Un capitán nunca espera. Bueno, sí, pero no tanto.' },
  { id: 'cosAstro', name: 'Astromatero', face: '🧑‍🚀', shirt: 0xf4f4f6, hair: 0xe07a5f, hat: 'casco', tag: 'Disfrazado del héroe de Galaxia Mate',
    bye: 'Misión cumplida. Vuelvo a la nave, que se enfría el agua.', lost: 'Houston, acá no me atienden. Despego.' },
  { id: 'cosReina', name: 'La Reina de Espadas', face: '👑', shirt: 0x7b4fd1, hair: 0x111111, hat: 'corona', hairStyle: 'largo', lips: true, tag: 'Disfrazada de la heroína de Truco Royale',
    bye: 'Quiero retruco. Digo: gracias.', lost: 'Me voy al mazo.' },
  { id: 'cosRayo', name: 'Rayo', face: '⚡', shirt: 0xf5c518, hair: 0x2d6cdf, hat: 'vincha', hairStyle: 'mohicano', tag: 'Disfrazado del héroe de Subte Runner',
    bye: '¡Me voy corriendo, que cierra el molinete!', lost: 'Si no corro, pierdo la combinación. Chau.' },
  { id: 'ruben', name: 'Don Rubén',  look: { hairStyle: 'corto', glasses: true, beard: true, lips: false, lashes: false }, face: '👴', shirt: 0x6b7a8f, hair: 0xdddddd, tag: 'El nostálgico',
    bye: 'Qué lindo que todavía atienda una persona.', lost: 'Antes esto se arreglaba hablando. Chau.' },
  { id: 'marta', name: 'Marta',      look: { hairStyle: 'rodete', glasses: true, beard: false, lips: true, lashes: false }, face: '👵', shirt: 0xb86fa8, hair: 0xc9c9d6, tag: 'La tecnología es extraña',
    bye: 'Gracias, querido. No entendí nada, pero gracias.', lost: 'Yo de esto no entiendo. Vuelvo con mi nieto.' },
  { id: 'fede',  name: 'Fede',       look: { hairStyle: 'corto', glasses: false, beard: true, lips: false, lashes: false }, face: '🧔', shirt: 0x3d7a4a, hair: 0x3a2a1a, tag: 'Lo vio más barato',
    bye: 'Igual después lo miro tranquilo en la página, eh.', lost: 'Listo, lo compro por la página desde casa.' },
  { id: 'tano',  name: 'El Tano',    look: { hairStyle: 'pelado', glasses: true, beard: true, lips: false, lashes: false }, face: '😎', shirt: 0xd9a514, hair: 0x1e1e1e, tag: 'Por ser cliente',
    bye: '¿Y por ser cliente no me regalás un cablecito?', lost: 'Así tratan a un cliente de toda la vida.' },
  { id: 'sergio',name: 'Sergio',     look: { hairStyle: 'corto', glasses: false, beard: false, lips: false, lashes: false }, face: '👨', shirt: 0x4a6fb5, hair: 0x4a3a2a, tag: 'Padre que no sabe qué compra',
    bye: 'Si no es este, vuelvo. Seguro vuelvo.', lost: 'Mejor le pregunto de nuevo al nene.' },
  { id: 'luli',  name: 'Luli',       look: { hairStyle: 'largo', glasses: false, beard: false, lips: true, lashes: true }, face: '🤨', shirt: 0xe07a5f, hair: 0x7a3b1e, tag: '¿Es original?',
    bye: 'Pero es original-original, ¿no?', lost: 'Tanta demora... me voy a preguntar a otro lado.' },
  { id: 'kevin', name: 'Kevin',      look: { hairStyle: 'rulos', glasses: true, beard: false, lips: false, lashes: false }, face: '🤓', shirt: 0x7b4fd1, hair: 0x15151f, tag: 'Gamer experto',
    bye: 'Es lo mejor que encontré según las specs.', lost: 'En el tiempo que esperé, ya lo speedruneé en otro lado.' },
  { id: 'nico',  name: 'Nico',       look: { hairStyle: 'corto', glasses: false, beard: false, lips: false, lashes: false }, face: '🏃', shirt: 0x21a0a0, hair: 0x5a4632, tag: 'El apurado',
    bye: '¡Gracias! Dejé el auto en doble fila.', lost: 'Dejé el auto en doble fila y me lo llevó la grúa.' },
  { id: 'sofi',  name: 'Sofi',       look: { hairStyle: 'largo', glasses: false, beard: false, lips: true, lashes: true }, face: '🎤', shirt: 0xff5fa2, hair: 0x2b1b3f, tag: 'Streamer en potencia',
    bye: 'Es para mi canal. Ya tengo 14 seguidores.', lost: 'Esto lo cuento en un vivo. A mis 14 seguidores.' }
];

GS.LINES = {
  duenoCall: ['¿Cómo viene esa sucursal? Acá en Incas todo bien. Cualquier cosa me llamás.', 'Te llamo cortito: me contaron que el local está quedando lindo. Seguí así.', 'Acordate: 10% en efectivo o transferencia, acá y en todo el país.', 'Si preguntan por envíos, decí que sí: para eso abrimos ahí.'],
  duenoCame: 'La reputación bajó de 4 estrellas, así que me vine. Me quedo hasta que la levantemos.',
  teach: ['Ahhh, era así. Yo lo hacía al revés.', 'Anotado. Mañana lo hago solo, vas a ver.', '¿Y si el cliente pregunta otra cosa? ...Bueno, improviso.', 'Listo, ya entendí. Creo. Sí, sí, entendí.'],
  freeze: 'Tranqui, hacemos todo como nos enseñaste.',
  /* Producto equivocado: el cliente se va y se pierde la venta (desde la jornada 2) */
  lostSale: ['Eso no es lo que pedí. Voy a ver a otro lado.', 'No, no era eso. Dejá, lo busco por la página.', 'Me parece que no me escuchaste. Chau.', 'Eso no. Y ya se me fueron las ganas.', 'Casi. Pero casi no juega. Me voy.'],
  dirtEnd: ['El Dueño pisó algo pegajoso al cerrar. Te miró. No dijo nada.', 'Un cliente dijo "qué lindo local" mirando para otro lado del piso.'],
  hookRain: 'Mañana puede llover: menos gente en el local, más compras por la página.',
  wrongProduct: [
    'Eso no. Pero gracias por participar.',
    'No, eso es otra cosa. Creo. Vos sos el que sabe.',
    'Mmm, no. Mi sobrino dijo otra cosa.',
    '¿Seguro que trabajás acá?',
    'Casi. Bah, no. Ni cerca.',
    'Eso lo tengo. Bueno, no sé si lo tengo.'
  ],
  wrongCash: [
    'Mirá que yo sumo con los dedos y me dio distinto.',
    'Mmm, no lo se Rick.',
    'A mí me da otra cosa. Y eso que soy de Sociales.',
    '¿Lo hacemos con la calculadora mejor?'
  ],
  changeShort: [
    'Me falta plata, eh. No soy de quejarme, pero me falta.',
    'Faltan billetes. Los conté dos veces.'
  ],
  changeOver: [
    'Me diste de más. No iba a decir nada. Bueno, sí.',
    'Sobra plata. Qué generoso el local.'
  ],
  caught: [
    '¡Qué desconfiados! Me voy a otro lado.',
    'Bueno, bueno... era una pruebita. Chau.',
    '¡Encima que les iba a comprar!',
    'Seguro es un error del banco. Me voy ofendido.'
  ],
  /* Clientes que entran a mirar: algunos comentan algo y se van */
  browse: [
    'Solo estoy mirando, gracias.',
    'Uh, esto lo quiero. El mes que viene.',
    'Le saco una foto y le pregunto a mi hijo.',
    '¿Todo esto es para jugar? Qué bárbaro.',
    'Vengo a mirar la Play. La miro y me voy.',
    'Qué lindo local. Vuelvo cuando cobre.',
    'Yo tenía una de estas, pero con cartuchos.',
    'Anoto el modelo y vuelvo.',
    'Con 3 cuotas sin interés capaz me animo.',
    'En efectivo tiene 10% OFF, ¿no? Lo pienso.',
    'Mi cumpleaños es en marzo. Aviso nomás.',
    'Entré por el aire acondicionado, no te voy a mentir.'
  ],
  /* Los compañeros, mientras hacen sus cosas por el local */
  staff: {
    siesta: ['No estaba durmiendo. Descansaba los ojos.', 'Cinco minutitos nomás.', 'Estaba contando stock. Con los ojos cerrados.'],
    repo: ['Repongo esto y vuelvo.', 'Otra caja más. Y van...', 'Esto iba acá, ¿no? Sí. Creo.'],
    taller: ['Llevo este al taller.', 'El de la notebook pregunta si ya está.'],
    mate: ['Preparo unos mates.', 'Se acabó la yerba. Tragedia.'],
    vidriera: ['La vidriera quedó pintada.', 'Hay un nene con la nariz pegada al vidrio.'],
    celu: ['Es un mensaje de trabajo. En serio.', 'Estoy viendo el stock. En el celu.'],
    caja2: ['Pasá por acá, que te cobro yo.', 'Por esta caja, por favor.']
  },
  sawWindow: ['Lo vi en la vidriera y entré.', 'Pasaba, lo vi en la vidriera y dije: es hoy.', 'Qué linda la vidriera. Vengo por eso que tienen ahí.'],
  rowFine: ['Ese dato está bien. El problema es otro.', 'Eso está perfecto. Mirá los demás.'],
  rowFineAll: ['Ese dato está bien. Compará tranquilo con lo de arriba.', 'Eso coincide. ¿Hay algo que no?'],
  receiptFake: ['Uy, me confundí de captura. Ahí te mando la buena.', 'Ah, esa era del mes pasado. Perdón, perdón.'],
  receiptOkRejected: ['¡Pero si está perfecta! Mirala bien.', 'Está aprobada, mirá. Con tilde verde y todo.'],
  receiptFakeApproved: ['(Se fue silbando bajito. Mala señal.)', '(Saludó muy rápido. Demasiado rápido.)'],
  payCash:     ['Pago en efectivo.', 'En efectivo, billete sobre billete.', 'Efectivo. ¿Tengo descuento, no?'],
  payTransfer: ['Te transfiero ahora.', 'Por transferencia. ¿Hay descuento?'],
  payCuotas:   ['En 3 cuotas, ¿puede ser?', 'Con tarjeta, en 3 cuotitas.'],
  payDebit:    ['Con débito, en un pago.', 'Con Mercado Pago, un pago.'],
  /* El Dueño: cada frase lleva un dato comercial real envuelto en un chiste (en Fase 3 serán 40+) */
  dueno: [
    '¡Qué bien GameShop, que ofrece 10% OFF en efectivo y transferencia! Increíble.',
    'Gracias a las 3 cuotas sin interés, nadie tiene que saber cuánto cuesta realmente.',
    'Antes de las 14 hs el envío sale en el día. Yo ya lo dije, ustedes hagan lo suyo.',
    'Todo original, todo con garantía. Y si no anda, tenemos service técnico. Qué suerte.',
    'Hacemos envíos a todo el país. De Ushuaia a la Quiaca. A Tucumán y a Micumán también.',
    'También se puede retirar en el local. Vengan, que acá hay aire acondicionado.',
    'Aceptamos Mercado Pago. Aceptamos casi todo, menos excusas.',
    'Hacemos servicio técnico de notebooks y PC. Que completos, ¿no?',
    'Ya contestamos 400 mensajes hoy. Qué bueno sería que alguien entrara por la puerta.',
    'Le ponemos más RAM a tu notebook. A vos no, lamentablemente.',
    'Recuerden: todo lo que vendemos es original y con garantía.',
    'Abrimos de 10 a 19. A las 19:01 ya no me pregunten nada.',
    'Productos nuevos, originales y con garantía. Lo digo yo, que soy el Dueño.',
    'Todo lo que ves acá también está en www.gameshop.com.ar. Y ahí no hay que hacer cola.',
    'Si alguien pregunta por stock, que mire la página: está al día. Casi siempre.',
    'Comprás por la página y lo retirás acá. Dos pasos, cero vueltas.',
    'Vendemos consolas, juegos, notebooks y accesorios. Lo único que no vendemos es humo.',
    'Factura A, factura B, la que necesites. Menos la factura de panadería: esa traela vos.',
    'Con garantía oficial y servicio técnico propio. Dormí tranquilo, como Brian.'
  ],
  /* El Dueño comenta lo que está pasando. Cada grupo se usa cuando se da esa situación; no repite hasta agotar las frases. */
  duenoCtx: {
    perdido: ['Se nos fue un cliente. Tranquilo: mañana vuelve, que acá hay 10% OFF en efectivo.', 'Uno se fue sin comprar. Capaz lo compra por la página: www.gameshop.com.ar atiende hasta en pijama.', 'Se fue apurado. La próxima le ofrecemos las 3 cuotas sin interés antes de que llegue a la puerta.'],
    trucho: ['Bien ahí con ese comprobante. Acá las transferencias se miran dato por dato.', 'Ese comprobante tenía más errores que mi primer currículum. Bien rechazado.', 'Ojo de halcón en la caja. El 10% OFF es para transferencias de verdad.'],
    perfecto: ['Ni un error en toda la tanda. Así da gusto abrir de 10 a 19.', 'Tanda impecable. Los clientes se van contentos y con garantía, como corresponde.', 'Eso fue una tanda limpia. Casi tan prolija como nuestros envíos a todo el país.', 'Todo bien atendido. Si seguís así, te hago un cuadrito para la oficina.'],
    errores: ['Hubo algún tropiezo. No pasa nada: respirá, que nadie nace sabiendo cobrar.', 'Se complicó un poco. Despacito y con buena letra, que el cliente espera.', 'Tranquilo con los errores. Acá lo único que no falla es la garantía.'],
    racha: ['¡Qué racha! Si seguís así te vas a quedar sin clientes para atender.', 'Vas en racha. Yo sabía que el mate de Brian tenía algo.', 'Racha larga. Anotalo, que eso en la tarjeta para compartir queda lindo.'],
    cansado: ['Te veo con la cordura justa. Aprovechá el respiro, que para eso está.', 'Pará un segundo y respirá. El local no se va a ningún lado.', 'Cuando se junta mucho, de a uno. Primero el que más esperó.'],
    lluvia: ['Con esta lluvia la gente compra desde el sillón. Por eso existe www.gameshop.com.ar.', 'Llueve y entran compras por la página. El paraguas lo pone el correo.', 'Día de lluvia: pocos en el local, muchos en la web. Hacemos envíos a todo el país, llueva o no.'],
    blackfriday: ['Black Friday: hoy no se camina, se trota. Pero con una sonrisa.', 'Hoy vuela todo. Lo que se compra antes de las 14 sale en el día, así que a embalar.', 'Black Friday y encima 3 cuotas sin interés. No sé cómo hacemos.'],
    navidad: ['Navidad: todos compran a último momento y todos lo quieren para regalo.', 'Si preguntan si llega para Nochebuena: antes de las 14 sale en el día.', 'Semana de Navidad. Papá Noel compra acá, pero no lo andes diciendo.'],
    siesta: ['¿Alguien vio a {quien}? Hace rato que "fue a buscar una caja" al depósito.', 'Escucho ronquidos en el depósito. Debe ser el aire acondicionado.', 'Si {quien} está contando stock con los ojos cerrados, que por lo menos cuente bien.'],
    mirones: ['Hoy entran muchos a mirar. Mirar es gratis; llevárselo tiene 10% OFF en efectivo.', 'Los que miran hoy, compran mañana. O por la página a las tres de la mañana.', 'Dejalos mirar tranquilos. El local vende solo, vos sonreí.'],
    mediodia: ['Ya casi son las 14. Lo que se compre por la página antes de esa hora sale hoy.', 'Mediodía. El que quiera almorzar, que almuerce rápido, que a las 14 pasa el correo.'],
    tarde: ['Falta poco para las 19. A las 19:01 no me pregunten nada.', 'Última parte del día. Después contamos la caja y a casa.', 'Ya baja el sol en la vereda. Un rato más y cerramos.'],
    web: ['Otra compra por la página despachada. www.gameshop.com.ar no duerme nunca.', 'Bien embalado. Ese paquete llega mejor peinado que yo.', 'Así salen las compras de la página: caja justa, cinta derecha y etiqueta correcta.'],
    proveedor: ['Llegó mercadería. Lo que entra hoy, mañana ya está en la vidriera.', 'Remito controlado. Acá no se firma nada sin contar.'],
    taller: ['Otro equipo que sale andando del taller. Servicio técnico de notebooks y PC, cada día mejor.', 'El taller está a pleno. Si no anda, lo arreglamos; y si anda, lo mejoramos.'],
    mejora: ['¿Viste cómo quedó el local con lo nuevo? Cada moneda bien puesta.', 'El local está cada día más lindo. Seguí juntando monedas, que hay más para mejorar.'],
    repAlta: ['Los clientes hablan bien de nosotros. Seguí así, que la reputación no se compra.', 'Cinco estrellas no llegan solas. Bueno, casi cinco.'],
    repBaja: ['La reputación está flojita. Una sonrisa, el dato correcto y se levanta sola.', 'Vamos a remontar esas estrellas. De a un cliente bien atendido por vez.'],
    interrupcion: ['Vi cómo resolviste eso. Con calma y sin dejar de atender: perfecto.', 'Entre el teléfono y el vecino, acá nunca falta entretenimiento.'],
    vidriera: ['La vidriera quedó para foto. Ya hay gente frenando a mirar.', 'Una vidriera bien armada vende más que yo hablando.'],
    cajaDos: ['Qué bien anda la segunda caja. Brian cobrando: quién lo hubiera dicho.', 'Con dos cajas no se junta cola. Fue una buena inversión.']
  },
  duenoEndGood: [
    'Excelente jornada. Casi tan buena como nuestro 10% OFF en efectivo y transferencia.',
    'Así se trabaja. Como nuestros envíos antes de las 14, en el día y sin vueltas.',
    'Impecable. Te pagaría en 3 cuotas sin interés, pero tomá una transferencia mejor.'
  ],
  duenoEndMid: [
    'Bien. Normal. Mañana será mejor.',
    'Aceptable. Mañana más sonrisa, que la sonrisa garpa.',
    'Ni fu ni fa. Recordá ofrecer las 3 cuotas sin interés, que venden solas.'
  ],
  duenoEndBad: [
    'Se fueron clientes sin comprar. Por suerte hacemos envíos a todo el país y los alcanzamos.',
    'Jornada complicada. Tranquilo: si algo se rompe, tenemos servicio técnico.',
    'Un día difícil. Mañana abrimos igual. Con 10% OFF en efectivo. Y con vos, espero.'
  ],
  human: [
    'Hoy atendiste a {n} personas. Ninguna te miró a los ojos. Excepto una.',
    'Alguien te dijo "gracias" sin que se lo pidieras. Anotalo.',
    'Hoy nadie te mandó un audio de 4 minutos. En persona duran menos.',
    'Una señora te contó de su nieto. No compró nada. Fue lo mejor del día.'
  ],
  wrongPc: ['Eso no entra ahí. Yo también probé.', 'Con fuerza entra cualquier cosa, pero no.', 'Ese hueco es de otra pieza. Tranqui.', 'Así queda una PC de colección: no prende.'],
  flipPc: ['Estaba al revés. Clásico.', 'Ahora sí, del derecho.'],
  wrongDiag: ['Mmm, no. Pero qué creatividad.', 'Eso lo vas a tener que explicarle vos al cliente.', 'Casi. Bah, no.'],
  missRam: ['Clac. Ese clac no era el bueno.', 'Casi entra. Casi.', 'La RAM te mira decepcionada.'],
  wrongBox: ['Entra... si lo doblás. No lo dobles.', 'Con esa caja pagás flete por aire.', 'Baila adentro como maraca. Probá otra.'],
  wrongLabel: ['Esa etiqueta va a otra provincia. Lindo paseo para el paquete.', 'Ese pedido es de otro comprador.'],
  wrongChat: [
    '???',
    'Visto ✓✓',
    'jajaj no entendi',
    'ok... (está escribiendo una reseña)'
  ],
  wrongShelf: ['Ahí no va. Después nadie lo encuentra. Ni vos.', 'Esa góndola es de otra cosa.', 'Si lo ponés ahí, mañana lo buscás tres horas.'],
  wrongStock: ['Contá de nuevo, sin apuro.', 'Mmm, no. ¿Contaste el que está atrás?', 'Ese número le gustaría al sistema, pero no.'],
  lineFine: ['Esa línea coincide. Mirá las otras.', 'Eso está bien. El de la carreta silba y mira para otro lado.'],
  returnExcuses: [
    'Lo usé un año, pero no me terminó de convencer.',
    'Me lo regalaron y ya tengo dos.',
    'No era lo que mi hijo quería. Nunca es.',
    'Lo abrí, lo miré y me arrepentí.',
    'Se rompió solo. Yo estaba al lado, pero no hice nada.',
    'Lo compré ayer y hoy salió uno nuevo.'
  ],
  wrongCount: ['Sumá de nuevo, tranqui.', 'Esa cuenta no cierra. Como la caja.', 'Probá con los dedos, no hay vergüenza.'],
  loading: [
    'Acomodando cajas que nadie va a mirar...',
    'Cebando el primer mate...',
    'Prendiendo el cartel de la calle...',
    'Contando el cambio. Otra vez.'
  ]
};

/* Distribución del salón: muebles como datos, para ajustarla sin tocar la lógica.
   Coordenadas en metros. x: izquierda(-)/derecha(+). z: fondo(-)/calle(+). */
GS.LAYOUT = {
  salon:   { xMin: -6, xMax: 6, zMin: -7, zMax: 6, wallH: 3.2 },
  galeria: { zMax: 11, pasillo: 1.6 },                 // vidriera tipo galería
  mostrador: { x: -1.6, z: -4.0, w: 6.0, d: 0.8, h: 1.05 },   // tramo de atención
  caja:      { x: 2.4,  z: -4.0, w: 2.0, d: 0.8, h: 1.05 },   // mismo mostrador, todo recto: el tramo que dice CAJA
  isla:      { x: -3.2, z: 0.4,  w: 1.8, d: 0.8, h: 1.05 },
  mesa:      { x: 2.2,  z: 1.5,  w: 1.5, d: 3.6, h: 0.9 },
  escritorio:{ x: 2.2,  z: 4.6,  w: 1.6, d: 0.8, h: 0.78 },
  gondola:   { x: 5.3,  z: 2.7,  w: 0.6, d: 4.8, h: 1.2 },
  service:   { x: 8.3,  z: 4.75, w: 2.2, d: 0.8, h: 0.95 },   // banco del Taller
  taller:    { x0: 6.5, x1: 11.4, zA: 3.95, zB: 8.4 },
  depoDoor:  { z: -4.4 }, tallerDoor: { z: 5.5 },
  empaque:   { x: 5.3,  z: -2.3, w: 0.7, d: 1.9, h: 0.9 },
  reposicion:{ x: -4.9, z: 0.3 },
  arcade:    { x: 0.7,  z: 8.3 },
  puerta:    { x: -0.9 },                              // por dónde entran los clientes
  cartel:    { textos: ['ENTRÁ. ELEGÍ. JUGÁ.', 'EL JUEGO EMPIEZA ACÁ.'] },
  colaMostrador: [ [-3.9, -2.9], [-2.7, -2.9], [-1.5, -2.9], [-0.3, -2.9] ],
  colaCaja:      [ [2.4, -2.9], [3.5, -2.9], [4.4, -2.6], [4.4, -1.6] ],
  yoMostrador: [-1.6, -4.9], yoCaja: [2.1, -4.9], brianCaja: [3.0, -4.9]
};

/* Estaciones de trabajo. pos = dónde hace foco la cámara. soon = llega en la próxima entrega. */
GS.STATIONS = [
  { id: 'mostrador', n: 1, name: 'Mostrador', icon: '🛎', pos: [-1.5, -4.0] },
  { id: 'caja', n: 2, name: 'Caja', icon: '💵', pos: [2.4, -4.0] },
  { id: 'pc', n: 3, name: 'Armado de PC', icon: '🖥️', pos: [10.0, 6.7],
    task: { name: 'PC para armar', tag: 'La quiere "con lucecitas"', late: 'El cliente de la PC se cansó de esperar. Se la arma el cuñado.' } },
  { id: 'service', n: 4, name: 'Taller', icon: '🔧', pos: [8.3, 5.0],
    task: { name: 'Equipo para reparar', tag: '"No hice nada, se rompió solo"', late: 'El equipo sigue esperando en el taller. Igual que su dueño.' } },
  { id: 'ml', n: 5, name: 'Compras por la página', short: 'Compra web', icon: '🛒', pos: [5.1, -2.3],
    task: { name: 'Compra por la página', tag: 'www.gameshop.com.ar · sale antes de las 14', late: 'Se pasó el corte de las 14. El pedido sale mañana.' } },
  { id: 'whatsapp', n: 6, name: 'WhatsApp', icon: '💬', pos: [-3.4, -4.2],
    task: { name: 'WhatsApp sin responder', tag: 'escribiendo...', late: 'Lo dejaste en visto. Te va a escribir de nuevo, pero con mayúsculas.' } },
  { id: 'repo', n: 7, name: 'Reposición', icon: '🧺', pos: [8.7, -4.3],
    task: { name: 'Cajas para reponer', tag: 'Llegó mercadería', late: 'Las cajas siguen en el pasillo. Ya son parte del mobiliario.' } },
  { id: 'stock', n: 8, name: 'Control de stock', icon: '🔍', pos: [-5.0, -3.2],
    task: { name: 'Contar una góndola', tag: 'El sistema dice una cosa...', late: 'Nadie contó la góndola. El sistema sigue soñando.' } },
  { id: 'proveedor', n: 9, name: 'Recepción de proveedor', short: 'Proveedor', icon: '🚚', pos: [5.0, -4.6],
    task: { name: 'Llegó mercadería', tag: 'Firmame acá, jefe', late: 'El del reparto se cansó de esperar la firma y se fue.' } },
  { id: 'devol', n: 10, name: 'Devoluciones', icon: '↩️', pos: [0.2, -4.0],
    task: { name: 'Quieren devolver algo', tag: '"Lo usé poquito"', late: 'El de la devolución se fue. Vuelve mañana, con refuerzos.' } },
  { id: 'cierre', n: 11, name: 'Cierre de caja', icon: '🧾', pos: [2.4, -3.8], finalOnly: true,
    task: { name: 'Cerrar la caja', tag: 'Última tarea del día', late: 'La caja quedó sin cerrar. Mañana va a ser un día largo.' } },
  { id: 'adornos', n: 999, name: 'Adornos de Navidad', short: 'Adornos', icon: '🎄', pos: [0.4, 4.6],
    task: { name: 'Decorar el local', tag: 'Mañana empieza la semana de Navidad', late: 'El arbolito quedó en la caja. Mañana habrá que improvisar.' } },
  { id: 'vidriera', n: 12, name: 'Vidriera', icon: '🪟', pos: [3.6, 8.5],
    task: { name: 'Armar la vidriera', tag: 'Que se luzca desde la vereda', late: 'La vidriera quedó como estaba. Nadie lo notó. Ese es el problema.' } }
];
GS.THEMES = [
  { t: 'Semana gamer', hint: 'periféricos para jugar en la PC', ids: ['teclado', 'mouse', 'auris', 'mousepad', 'silla', 'volante', 'streamdeck'] },
  { t: 'Vuelta al cole', hint: 'cosas para estudiar y hacer la tarea', ids: ['notebook', 'impresora', 'tinta', 'pendrive', 'ipad', 'router'] },
  { t: 'Día del niño', hint: 'regalos para los más chicos', ids: ['switch2', 'juego', 'juego2', 'juego4', 'muneco', 'ds_azul'] },
  { t: 'Mundo Apple', hint: 'solo productos de la manzanita', ids: ['airpods', 'homepod', 'magic', 'ipad', 'watch'] },
  { t: 'Armá tu PC', hint: 'componentes y partes para armar una compu', ids: ['gpu', 'gabinete', 'ram', 'disco', 'monitor', 'teclado'] },
  { t: 'Quiero ser streamer', hint: 'todo para transmitir en vivo', ids: ['mic', 'webcam', 'streamdeck', 'auris', 'silla'] },
  { t: 'Noche de Play', hint: 'todo lo que va con la PlayStation', ids: ['ps5', 'dualsense', 'ds_blanco', 'ds_negro', 'ds_rojo', 'ds_violeta', 'juego3'] },
  { t: 'Verano y pileta', hint: 'música y diversión para las vacaciones', ids: ['parlante', 'quest', 'switch2', 'deck', 'airpods'] },
  { t: 'Regalos de bolsillo', hint: 'cosas chiquitas que entran en un bolsillo', ids: ['pendrive', 'cable', 'airpods', 'cargador', 'ram', 'tinta'] },
  { t: 'Oficina en casa', hint: 'para trabajar cómodo desde casa', ids: ['notebook', 'monitor', 'webcam', 'router', 'silla', 'impresora'] }
];

/* Interrupciones suaves: aparecen de a una, se contestan con un toque y si no las contestás se resuelven solas (sin castigo).
   ok = la respuesta con criterio (suma cordura); bad = la otra (resta un poquito y trae un chiste). r = remate. mate = recupera más. */
/* Eventos sorpresa: uno por jornada como mucho, solo en la sucursal activa. gfx/bfx = lo que dejan (rep, coins, fondo).
   twist = a veces la respuesta que parecía mala sale bien. */
GS.EVENTS = [
  { ic: '💡', who: 'Corte de luz', t: 'Se cortó la luz en toda la cuadra. Hay tres clientes adentro, a oscuras.', ok: 'Linternas de los celulares y a seguir', bad: 'Cerramos hasta que vuelva', r: 'Atendieron con linterna. Uno dijo que era "una experiencia".', rb: 'Volvió a los dos minutos. Los clientes ya se habían ido.', gfx: { rep: 0.12 }, bfx: { rep: -0.08 } },
  { ic: '⚡', who: 'Promo relámpago', t: 'La página propone una promo relámpago de una hora. Hay que decidir ya.', ok: 'Dale, una hora de 10% en todo', bad: 'Mejor no, es mucho lío', r: 'Entraron pedidos como si regalaran. Casi.', rb: 'Tranquilidad total. Demasiada.', gfx: { coins: 90, rep: 0.05 }, bfx: {}, twist: 'No hubo promo y nadie se enteró: el stock quedó entero para el fin de semana.', tfx: { coins: 60 } },
  { ic: '📋', who: 'Inspección', t: 'Un inspector municipal quiere ver la habilitación y el matafuegos. Ahora.', ok: 'Pase, está todo al día', bad: 'Vuelva mañana, hay gente', r: 'Todo en regla. Se fue mirando los auriculares.', rb: 'Volvió mañana. Con un compañero. Y más preguntas.', gfx: { rep: 0.1 }, bfx: { rep: -0.1 } },
  { ic: '😎', who: 'Cliente famoso', t: 'Entró un streamer conocido, con capucha y anteojos. Quiere que nadie lo reconozca.', ok: 'Atenderlo como a cualquiera', bad: 'Pedirle una foto para el local', r: 'Agradeció la discreción y después nombró al local en un video.', rb: 'Se puso incómodo y se fue rápido.', gfx: { rep: 0.2, fondo: 150 }, bfx: { rep: -0.05 }, twist: 'Le encantó la idea: subió la foto y etiquetó al local.', tfx: { rep: 0.25, fondo: 200 } },
  { ic: '🚚', who: 'El stock que no llega', t: 'El camión del proveedor quedó varado. Hay tres pedidos por la página esperando ese stock.', ok: 'Avisarles a los tres y ofrecer alternativa', bad: 'No decir nada, capaz llega', r: 'Dos aceptaron la alternativa y el tercero esperó sin problema.', rb: 'No llegó. Los tres escribieron. A la vez.', gfx: { rep: 0.12 }, bfx: { rep: -0.12 }, twist: 'Llegó a último momento. Nadie se enteró de nada.', tfx: { rep: 0.05 } }
];
GS.INTERRUPTS = [
  // guiños del barrio
  { ic: '🚇', who: 'Una chica con mochila', t: '"Perdón, ¿la estación Incas del subte B queda por acá?"', ok: 'Sí, por Triunvirato, ahí nomás', bad: 'Ni idea, yo vengo en joystick', r: 'Llegó al subte. Dijo que a la vuelta pasa a mirar auriculares.', rb: 'Se fue caminando para el otro lado.' },
  { ic: '🚌', who: 'Un señor apurado', t: '"¿La parada del 80 dónde es?"', ok: 'En la esquina, sobre la avenida', bad: 'El 80 no existe, es un mito', r: 'Lo alcanzó justo. Saludó desde la ventanilla.', rb: 'El 80 pasó por la puerta mientras discutían.' },
  // inspiradas en noticias insólitas de la Ciudad
  { ic: '🦫', who: 'En la vereda', t: 'Un carpincho pasa caminando lo más tranquilo.', ok: 'Avisar al 103 y dejarlo en paz', bad: 'Ofrecerle 3 cuotas sin interés', r: 'Vinieron a buscarlo para llevarlo a un lugar seguro. Se fue mirando la vidriera.', rb: 'No tiene bolsillos ni pulgares. Igual miró los joysticks.' },
  { ic: '🚌', who: 'Un colectivero', t: '"Jefe, el colectivo hace un ruido raro en el motor. ¿Ustedes arreglan?"', ok: 'Notebooks y PC sí; motores no', bad: 'Tráigalo, lo abrimos en el taller', r: 'Se fue a un mecánico. Dejó dicho que vuelve por un cargador.', rb: 'El colectivo no pasa por la puerta del taller.' },
  { ic: '🚓', who: 'Por la vidriera', t: 'En un control, un conductor explica: "Es solo por hoy".', ok: 'Seguir atendiendo', bad: 'Salir a opinar', r: 'Las excusas no pasan el control. Las transferencias truchas, tampoco.', rb: 'Ahora el agente te pregunta a vos.' },
  { ic: '🏎️', who: 'Una vecina', t: '"¿Vieron la plaza nueva con juegos de Fórmula 1?"', ok: 'Acá tenemos volantes para practicar', bad: 'No me interesan las plazas', r: 'Se llevó un folleto para el nieto.', rb: 'La vecina se fue ofendida. Y la plaza está buenísima.' },
  { ic: '🎊', who: 'Entró un hincha', t: 'Festeja un gol tirando papelitos en el salón.', ok: 'Pedirle que festeje en la vereda', bad: 'Tirar papelitos también', r: 'Festejó afuera y volvió a mirar joysticks.', rb: 'Ahora hay que barrer todo el salón.' },
  // del día a día
  { ic: '🛵', who: 'Un repartidor', t: '"Pedido para Gladys: dos docenas de empanadas."', ok: 'Acá no es, probá al lado', bad: 'Sí, dejalas acá', r: 'Gladys vive al lado. Las empanadas llegaron calientes.', rb: 'Gladys vino a reclamar. Quedaban tres.' },
  { ic: '🕊️', who: 'Entró una paloma', t: 'Camina entre las góndolas como si buscara algo.', ok: 'Abrir la puerta y esperar', bad: 'Correrla por todo el local', r: 'Salió sola. No compró nada.', rb: 'Ahora hay plumas en la mesa de PC.' },
  { ic: '📸', who: 'Unos turistas', t: 'Le sacan fotos al cartel y preguntan si pueden entrar.', ok: 'Pasen y miren tranquilos', bad: 'Las fotos se cobran', r: 'Se llevaron un mousepad de recuerdo.', rb: 'Se fueron a sacarle fotos al kiosco.' },
  { ic: '📺', who: 'Un señor con un televisor', t: '"¿Arreglan teles? Esta es de 1998 y anda bárbaro, salvo que no anda."', ok: 'Solo notebooks y PC', bad: 'Déjela, algo inventamos', r: 'Preguntó si las notebooks vienen con antena.', rb: 'Ahora hay un televisor de 30 kilos en el taller.' },
  { ic: '☔', who: 'Un vendedor ambulante', t: '"¡Paraguas, paraguas! ¿Me dejás ofrecer adentro?"', ok: 'Adentro no, pero suerte', bad: 'Dale, poné un puestito', r: 'Vendió tres paraguas en la vereda. No llovió.', rb: 'El Dueño preguntó desde cuándo vendemos paraguas.' },
  { ic: '🎸', who: 'Un músico callejero', t: 'Toca en la puerta. Solo sabe una canción.', ok: 'Dejarle una moneda y seguir', bad: 'Pedirle un tema de un juego', r: 'Agradeció y se corrió a la esquina.', rb: 'Sabe el tema. Lo toca hace veinte minutos.' },
  { ic: '🧓', who: 'Una señora', t: '"Nene, ¿el 60 para por acá?"', ok: 'En la esquina, señora', bad: 'Acá solo paran clientes', r: 'Llegó a horario. Saludó desde el colectivo.', rb: 'Se quedó esperando el 60 adentro del local.' },
  { ic: '🎈', who: 'Brian', t: '"Hoy es mi cumpleaños. No dije nada para no molestar."', ok: '¡Feliz cumple, Brian!', bad: 'El año que viene avisá', r: 'Sonrió todo el día. Hasta cobró en la caja.', rb: 'Se fue al depósito. A "contar stock".', mate: true },
  { ic: '🔌', who: 'Un chico apurado', t: '"¿Me prestás un enchufe? Tengo 1% y me están por llamar."', ok: 'Enchufalo ahí un ratito', bad: 'Vendemos cargadores', r: 'Lo llamaron. Era para avisarle que ya no hacía falta.', rb: 'Compró el cargador. Igual te miró feo.' },
  { ic: '📞', who: 'Suena el teléfono', t: '"Hola, ¿es la pizzería?"', ok: 'No, pero vendemos joysticks', bad: 'Sí, ¿grande de muzza?', r: 'Número equivocado. Igual anotó la dirección del local.', rb: 'Ahora hay que conseguir una grande de muzza.' },
  { ic: '📞', who: 'Suena el teléfono', t: '"¿Hasta qué hora están?"', ok: 'De 10 a 19', bad: 'Hasta que nos cansemos', r: 'Dijo que pasa a las 18:55. Clásico.', rb: 'Abrimos de 10 a 19. Ni un minuto más, ni uno menos.' },
  { ic: '📞', who: 'Suena el teléfono', t: '"¿Hacen envíos a Jujuy?"', ok: 'Sí, a todo el país', bad: 'Solo si no llueve', r: 'A todo el país. Hasta donde llegue el correo.', rb: 'Hacemos envíos a todo el país, llueva o truene.' },
  { ic: '🧉', who: 'Brian', t: '"¿Va un mate?"', ok: 'Dale, uno y sigo', bad: 'No tengo tiempo ni para respirar', r: 'Un mate a tiempo ordena la cabeza.', rb: 'Brian se lo tomó solo. Vos te lo perdiste.', mate: true },
  { ic: '📱', who: 'Brian', t: '"Che, ¿cuál era la clave del wifi?"', ok: 'Está pegada en el monitor', bad: 'Preguntale a un cliente', r: 'Estaba pegada en el monitor. Desde marzo.', rb: 'Un cliente le pasó la del bar de enfrente.' },
  { ic: '🎵', who: 'Brian', t: 'Subió la música al máximo.', ok: 'Bajale un poquito', bad: 'Subile, que se enteren en la esquina', r: 'Volumen de local, no de boliche.', rb: 'Ahora los clientes piden a los gritos.' },
  { ic: '🚪', who: 'El vecino de al lado', t: '"¿Me cambiás mil en monedas?"', ok: 'Ahora no, pasá a la tarde', bad: 'Sí, vaciemos la caja', r: 'Entendió perfecto. Vuelve a la tarde, seguro.', rb: 'El cierre de caja de hoy va a ser una aventura.' },
  { ic: '📦', who: 'Un cartero apurado', t: '"Firmame acá. Es para el local de al lado."', ok: 'Es al lado, la otra puerta', bad: 'Firmo cualquier cosa', r: 'Cada paquete con su dueño.', rb: 'Ahora tenemos un paquete que no es nuestro.' },
  { ic: '🚗', who: 'En la calle', t: 'Suena la alarma de un auto. Hace rato.', ok: 'Respirar hondo y seguir', bad: 'Salir a retar al auto', r: 'Inhalar, exhalar. Ya paró.', rb: 'El auto no te contestó. Era de esperar.' },
  { ic: '🐕', who: 'Entró un perro', t: 'Mueve la cola frente a los joysticks.', ok: 'Acompañarlo a la puerta con cariño', bad: 'Ofrecerle 3 cuotas sin interés', r: 'Se fue contento. Quedó de volver con el dueño.', rb: 'No tenía tarjeta. Ni bolsillos.' },
  { ic: '💡', who: 'Parpadeó la luz', t: 'Dos segundos y volvió.', ok: 'Esperar: ya volvió', bad: 'Cerrar el local para siempre', r: 'Todo sigue prendido. Hasta el cartel.', rb: 'Calma: fueron dos segundos.' },
  { ic: '🧾', who: 'Volvió un cliente', t: '"Me olvidé el ticket en el mostrador."', ok: 'Acá está, te lo guardé', bad: '¿Qué ticket?', r: 'Con el ticket tiene la garantía en regla.', rb: 'Apareció abajo del frasco de caramelos.' }
];
/* Escena final: se ve al terminar la jornada GS.CONFIG.finalDay. {rank} = el rango nuevo. */
/* TRAMA CENTRAL: "El local de al lado". El dueño del edificio vende el local pegado. Si para la jornada final se juntó el fondo,
   se abre GameShop 2. Las monedas se aportan desde "Mejorar el local" y algunas visitas suman (o complican).
   tiers: desde cuánto fondo (en proporción a la meta) se llega a cada final. */
GS.PLOT = { goal: 2600, name: 'GameShop a todo el país',
  intro: 'Te contraté para algo grande: llevar GameShop a todo el país. Con los fondos de expansión que deja cada jornada vamos a abrir una sucursal en cada región. Mirá el mapa.',
  tiers: [
    { at: 0,    key: 'chico',   title: 'Mano derecha del Dueño',      line: 'No llegamos al local de al lado. Pero el nuestro quedó hecho un lujo, y eso también es tuyo.' },
    { at: 0.5,  key: 'medio',   title: 'Jefe del punto de retiro',    line: 'No alcanzó para todo el local, pero alquilamos la mitad: ahí va el punto de retiro de las compras por la página. Y lo manejás vos.' },
    { at: 1,    key: 'grande',  title: 'Encargado de GameShop 2',     line: '¡El local de al lado es nuestro! Abre GameShop 2, y el encargado sos vos. Las llaves ya tienen tu nombre.' },
    { at: 1.5,  key: 'leyenda', title: 'Socio de GameShop',           line: 'Compramos el local de al lado y sobró para ponerle cartel pantalla. Desde hoy no sos empleado: sos socio.' }
  ] };
/* VISITAS CON HISTORIA: clientes que vuelven. Cada paso es una visita: t = lo que dicen, m = la cara que ponen,
   opts = lo que podés contestar (b), cómo reaccionan (r, rm) y qué cambia (fx: rep, fondo, cord, goal = mueve la meta, flag).
   alt = texto distinto si antes pasó algo. note = lo que queda anotado en la libreta. from = primera jornada, gap = jornadas entre visitas. */
GS.STORIES = [
  { id: 'elvira', name: 'Doña Elvira', tag: 'La abuela del cumpleaños', from: 2, gap: 2, look: { shirt: 0xb86fa8, hair: 0xc9c9d6, hairStyle: 'rodete', skin: 0xf2c9a0, glasses: true, lips: true }, steps: [
    { m: 'talk', t: 'Mi nieto cumple 9 y quiere "la Suich". Junté esto en una lata de galletitas. ¿Me alcanza?', note: 'Junta plata en una lata para la consola del nieto. Dijo que vuelve.', opts: [
      { b: 'Con 3 cuotas sin interés, llega', r: '¡Tres cuotas! Como el lavarropas. Vuelvo en unos días con la lata.', rm: 'happy', fx: { rep: 0.1 } },
      { b: 'Mejor lleve algo más barato', r: 'Ay, no sé... Él quería esa. Lo voy a pensar.', rm: 'sad', fx: { cord: -3 } }] },
    { m: 'talk', t: 'Volví. Traje la lata. Son todas monedas, ¿eh? ¿Las cuenta usted o las cuento yo?', note: 'Trajo la lata llena de monedas.', opts: [
      { b: 'Las contamos juntos', r: 'Mil doscientas monedas después... ¡alcanza! Envuélvamela, que es regalo.', rm: 'happy', fx: { rep: 0.15, fondo: 150 } },
      { b: 'En efectivo tiene 10% OFF: le sobra', r: '¿Me sobra? ¡Entonces llevo también un jueguito!', rm: 'happy', fx: { rep: 0.1, fondo: 300 } }] },
    { m: 'happy', t: '¡Le encantó! Gritó, lloró y después no nos habló por tres días porque estaba jugando. Le traje torta.', note: 'El nieto no suelta la consola. Hubo torta para todos.', end: true, opts: [
      { b: 'Gracias, Elvira', r: 'Guárdele un pedazo al muchacho que duerme en el depósito.', rm: 'happy', fx: { cord: 25, rep: 0.1 } }] }] },
  { id: 'benja', name: 'Benja', tag: 'Ahorra para un joystick', from: 3, gap: 2, look: { shirt: 0x3bb54a, hair: 0x4a3a2a, hairStyle: 'corto', skin: 0xe0ac7e, scale: 0.8 }, steps: [
    { m: 'talk', t: 'Hola. ¿Cuánto sale el joystick azul? Tengo esto. (Muestra un puñado de monedas y un botón.)', note: 'Quiere el joystick azul. Tiene monedas y un botón.', opts: [
      { b: 'Te falta un poquito. Seguí juntando', r: 'Bueno. El botón no cuenta, ¿no? Vuelvo.', rm: 'normal', fx: { rep: 0.05 } },
      { b: 'El botón no lo aceptamos', r: 'Era de la suerte. Vuelvo con más.', rm: 'sad', fx: { cord: 3 } }] },
    { m: 'talk', t: 'Lavé el auto de mi tío, el de mi otro tío y uno que no sé de quién era. ¿Ahora me alcanza?', note: 'Lavó tres autos. Uno no sabe de quién era.', opts: [
      { b: 'Casi. En efectivo tenés 10% OFF', r: '¿Diez por ciento es mucho? ¡Entonces me falta re poco!', rm: 'happy', fx: { rep: 0.1 } }] },
    { m: 'happy', t: 'Le armé el set a una streamer: enchufé todo y no se prendió fuego nada. Me pagó. ¡Junté todo! Lo conté tres veces.', note: 'Con la changa del set de Cami juntó lo que faltaba. Se llevó el joystick azul sin bolsa.', end: true,
      need: 'changa', waitMax: 3, wait: { m: 'sad', t: 'Todavía me falta. ¿No sabés de alguien que necesite una mano? Hago changas.', opts: [{ b: 'Si me entero de algo, te aviso', r: 'Gracias. Sé enchufar cosas y casi nunca rompo nada.', rm: 'normal', fx: {} }] }, opts: [
      { b: 'Contémoslo juntos', r: '¡Alcanza justo! ¿Me lo das sin bolsa? Lo quiero ir mirando.', rm: 'happy', fx: { rep: 0.2, fondo: 150, cord: 15 } }] }] },
  { id: 'anselmo', name: 'Don Anselmo', tag: 'El coleccionista', from: 3, gap: 3, look: { shirt: 0x6b7a8f, hair: 0xdddddd, hairStyle: 'pelado', beard: true, skin: 0xf6d7bd, glasses: true }, steps: [
    { m: 'talk', t: 'Busco "Galaxia Mate", primera edición, con el manual. Lo busco desde 2009. ¿Lo tienen?', note: 'Busca Galaxia Mate primera edición desde 2009.', opts: [
      { b: 'No, pero lo anoto y le aviso', r: 'Anóteme: Anselmo. Igual vengo todos los martes.', rm: 'normal', fx: { rep: 0.05 } },
      { b: 'Tengo la edición nueva', r: 'La nueva no trae el manual con olor a manual. Vuelvo.', rm: 'sad', fx: {} }] },
    { m: 'impatient', t: '¿Llegó? ...No me diga nada. Se lo veo en la cara. No llegó.', note: 'Volvió a preguntar. Todavía no llegó.', opts: [
      { b: 'Todavía no, Anselmo', r: 'Diecisiete años esperé. Si alguien trae juegos viejos para vender, acuérdese de mí.', rm: 'normal', fx: { cord: 3 } },
      { b: '¿Probó mirarlo en la página?', r: 'La miro todas las noches. Antes de dormir.', rm: 'normal', fx: { rep: 0.05 } }] },
    { m: 'surprised', t: 'Me dijeron que les entró una caja de juegos viejos. Dígame que adentro está lo que yo creo.', note: 'Le mostré la caja que le compré a Nilda: adentro estaba su Galaxia Mate.',
      need: 'galaxia', wait: { m: 'impatient', t: '¿Y? ¿Entró algo? ...No, ya veo que no.', opts: [{ b: 'Nada todavía, Anselmo', r: 'Si aparece alguien vendiendo juegos viejos, cómprele. Yo después se lo agradezco.', rm: 'sad', fx: {} }] }, opts: [
      { b: 'Es suyo: se lo guardé', r: '¡Con el manual! Cóbrese. Y esto aparte, para ese fondo del que habla el Dueño.', rm: 'happy', fx: { rep: 0.2, fondo: 600 } },
      { b: 'Un revendedor ofrece el doble', r: '...Entiendo. Los negocios son los negocios.', rm: 'sad', fx: { fondo: 900, rep: -0.3, flag: 'traicion' } }] },
    { m: 'happy', t: 'Lo terminé. Dos veces. Vengo a contarle el final.', alt: { flag: 'traicion', m: 'sad', t: 'Lo conseguí igual. Me costó el triple. No le guardo rencor. Bueno, un poco.' }, note: 'Terminó de buscar. Diecisiete años.', end: true, opts: [
      { b: 'Lo escucho', r: 'Resulta que el mate era el planeta. Muy ingenioso el desarrollo argentino.', rm: 'happy', fx: { cord: 15, rep: 0.05 } }] }] },
  { id: 'tito', name: 'Tito Ofertas', tag: 'Siempre tiene un negocio', from: 4, gap: 3, look: { shirt: 0xd9a514, hair: 0x111111, hairStyle: 'corto', beard: true, skin: 0xc68a5c }, steps: [
    { m: 'nervous', t: 'Maestro: tengo diez joysticks que me sobraron de un evento. Sin caja, sin factura, sin preguntas. ¿Te los dejo baratos?', note: 'Ofreció joysticks sin caja ni factura.', opts: [
      { b: 'Acá todo es nuevo, original y con factura', r: 'Uh, qué serio. Bueno, yo pregunté.', rm: 'sad', fx: { rep: 0.15 } },
      { b: '¿Cuánto?', r: '¡Ese es mi pibe! ...No, mentira, era una prueba. Paso otro día.', rm: 'happy', fx: { rep: -0.15 } }] },
    { m: 'nervous', t: 'Te transfiero ya. Mirá el comprobante: dice "GeimShop", pero es el autocorrector.', note: 'Quiso pagar con un comprobante a nombre de "GeimShop".', opts: [
      { b: 'Sin comprobante correcto no hay venta', r: 'Ya vuelvo. Voy a retar al autocorrector.', rm: 'angry', fx: { rep: 0.1 } },
      { b: 'Dale, pasá', r: 'La plata nunca llegó. El Dueño miró el cierre de caja en silencio.', rm: 'happy', fx: { fondo: -300, rep: -0.2 } }] },
    { m: 'talk', t: 'Vengo a comprar en serio. Con plata de verdad. Efectivo. ¿Es cierto lo del 10%?', note: 'Tito se reformó. Más o menos.', end: true, opts: [
      { b: '10% OFF en efectivo, como a todos', r: 'Mirá vos: portarse bien sale más barato. Me llevo dos.', rm: 'happy', fx: { fondo: 400, rep: 0.15 } }] }] },
  { id: 'cami', name: 'Cami', tag: 'Streamer en ascenso', from: 5, gap: 3, look: { shirt: 0xff5fa2, hair: 0x7b4fd1, hairStyle: 'largo', skin: 0xf2c9a0, lashes: true, lips: true }, steps: [
    { m: 'talk', t: 'Soy streamer. Tengo tres seguidores: mi mamá, mi tía y uno que creo que es un bot. ¿Qué micrófono me recomendás?', note: 'Streamer con tres seguidores (uno es un bot).', opts: [
      { b: 'Uno bueno, y en 3 cuotas', r: '¡Listo! Con esto me van a escuchar perfecto los tres.', rm: 'happy', fx: { rep: 0.1, fondo: 150 } },
      { b: 'Primero conseguí seguidores', r: 'Auch. Igual me lo llevo.', rm: 'sad', fx: { rep: -0.05 } }] },
    { m: 'happy', t: '¡Llegué a cien! El bot trajo amigos. Necesito una webcam: ya no puedo transmitir con la del microondas.', note: 'Llegó a cien seguidores. Compró una webcam.', opts: [
      { b: 'Con esta se te ve bárbaro', r: '¡Se me ven hasta las ojeras! La amo.', rm: 'happy', fx: { fondo: 200, rep: 0.1 } },
      { b: 'Y para armar el set, conozco a un pibe: Benja', r: '¡Sí! Odio los cables. Que venga, que le pago.', rm: 'happy', fx: { fondo: 200, rep: 0.1, gflag: 'changa' }, note: 'Compró la webcam y le recomendé a Benja para armar el set.' }] },
    { m: 'talk', t: 'Mañana transmito desde acá, si me dejás. Nombro el local. ¿Qué querés que diga?', note: 'Transmitió en vivo desde el local.', opts: [
      { b: '3 cuotas sin interés y envíos a todo el país', r: 'Hecho. Y que atiende gente copada.', rm: 'happy', fx: { rep: 0.25, fondo: 300 } },
      { b: 'Que no toquen nada', r: 'Jaja, ok: "no toquen nada", dice el local.', rm: 'normal', fx: { rep: 0.05 } }] },
    { m: 'happy', t: '¡Se llenó el chat! Uno preguntó si el del mohicano es parte del decorado.', note: 'El chat explotó. Preguntaron por el del mohicano.', end: true, opts: [
      { b: 'Es parte del equipo', r: 'Les mando saludos a todos. ¡Vuelvo para el cierre de la temporada!', rm: 'happy', fx: { fondo: 500, cord: 10 } }] }] },
  { id: 'nilda', name: 'Nilda', tag: 'Está vaciando un altillo', from: 4, gap: 2, look: { shirt: 0x21a0a0, hair: 0x7a3b1e, hairStyle: 'rodete', skin: 0xf2c9a0, lips: true, glasses: false }, steps: [
    { m: 'talk', t: 'Estoy vaciando el altillo de mi hermano. Hay una caja de juegos viejos, con sus manuales. ¿Ustedes compran? Si no, va a la vereda.', note: 'Le compré la caja de juegos viejos del altillo, con manuales y todo.', end: true, opts: [
      { b: 'Se la compro (🪙 200 del fondo)', r: '¡Menos mal! Hay uno de un astronauta con mate. Mire qué rareza.', rm: 'happy', fx: { fondo: -200, rep: 0.05, gflag: 'galaxia' } },
      { b: 'No compramos usados', r: 'Bueno. La dejo unos días más en el altillo, por si cambia de idea.', rm: 'sad', fx: {}, stay: true }] }] },
  // ---- personajes de cada sucursal: vienen al mostrador (from = jornada dentro de esa sucursal). El rival de la zona cierra con un desafío.
  { id: 'c_bodega', reg: 'cuyo', name: 'Don Aurelio', tag: 'El bodeguero', from: 1, gap: 2, look: { shirt: 0x6a2d7a, hair: 0xc9c9d6, hairStyle: 'corto', skin: 0xe0ac7e, beard: true }, steps: [
    { m: 'talk', t: 'Tengo una bodega chiquita. Quiero una notebook para llevar las cuentas, pero que aguante la tierra de la finca.', note: 'Tiene una bodega y busca notebook para las cuentas.', opts: [{ b: 'Le armo una con funda y garantía', r: 'Con garantía me quedo tranquilo. Vuelvo después de la cosecha.', rm: 'happy', fx: { rep: 0.1 } } , { b: 'Llévese la más cara, por las dudas', r: 'Mmm. Soy de campo, no zonzo. Lo pienso.', rm: 'sad', fx: { rep: -0.05 } }] },
    { m: 'happy', t: 'Volví. La cosecha vino buena. Me llevo la notebook y le dejo esto: es de la primera barrica.', note: 'Volvió después de la cosecha y compró la notebook.', end: true, opts: [{ b: 'Gracias, Don Aurelio. Brindamos al cierre', r: 'Con moderación, que mañana se abre a las 10.', rm: 'happy', fx: { rep: 0.15, fondo: 200 } }] }] },
  { id: 'c_ciclista', reg: 'cuyo', name: 'La Negra Sosa', tag: 'Ciclista de montaña', from: 2, gap: 2, look: { shirt: 0x2d6cdf, hair: 0x1b1b1f, hairStyle: 'rodete', skin: 0xc68a5c }, steps: [
    { m: 'talk', t: 'Subo al cerro en bici y quiero grabar la bajada. ¿Tenés una memoria que no se me llene a mitad de camino?', note: 'Quiere grabar la bajada del cerro en bici.', opts: [{ b: 'Esta de 128 GB y una de repuesto', r: 'Dos. Por si me entusiasmo. Te muestro el video a la vuelta.', rm: 'happy', fx: { rep: 0.1, fondo: 80 } } , { b: 'Con una de 16 te arreglás', r: 'Bueno... si vos decís.', rm: 'normal', fx: {} }] },
    { m: 'happy', t: '¡Mirá el video! Bueno, la mitad: se cortó justo en el salto. Pero la mitad que hay está buenísima.', note: 'Mostró el video de la bajada. O la mitad.', end: true, opts: [{ b: 'La próxima llevá dos memorias', r: 'Ya aprendí. Dame dos, y un parlantito para el refugio.', rm: 'happy', fx: { rep: 0.1, fondo: 150 } }] }] },
  { id: 'rival_cuyo', reg: 'cuyo', name: 'Don Ulises', tag: 'Dueño de Zonda Gamer', from: 3, gap: 2, look: { shirt: 0xd9a514, hair: 0x3a2a1a, hairStyle: 'corto', skin: 0xe0ac7e, beard: true, glasses: true }, steps: [
    { m: 'talk', t: 'Así que ustedes son los de Buenos Aires. Vengo a avisar: cuando sopla el Zonda, yo bajo los precios. Y hoy sopla.', note: 'Don Ulises, de Zonda Gamer, declaró la guerra de precios.', opts: [{ b: 'Nosotros damos 10% en efectivo y garantía', r: 'Garantía... Eso es jugar sucio. Ya vuelvo.', rm: 'surprised', fx: { rep: 0.1 } } , { b: 'Entonces bajamos todo nosotros también', r: 'Bien. A ver quién aguanta más.', rm: 'angry', fx: { rep: -0.05, fondo: -100 } }] },
    { m: 'nervous', t: 'Che, una pregunta sin importancia: ¿a ustedes también les apareció el cartel dado vuelta esta mañana? Qué cosa el viento, ¿no?', note: 'Alguien dio vuelta el cartel. "El viento", dice Don Ulises.', opts: [{ b: 'Lo enderezamos y quedó más derecho que antes', r: 'Ah. Qué bien. Me alegro. Mucho.', rm: 'sad', fx: { rep: 0.1 } } , { b: 'Fue usted, Ulises. Tiene pintura roja en la manga', r: '...Es de un tomate. Me voy.', rm: 'nervous', fx: { rep: 0.15 } }] },
    { m: 'talk', t: 'Último desafío: el que arme una PC más rápido se queda con la cuadra. Traje cronómetro. Y público: mi mamá.', note: 'Desafío final de Zonda Gamer: armar una PC contra reloj.', end: true, opts: [{ b: 'Acepto. Y la suya la armamos nosotros también', r: '...Me ganaron. Mi mamá dice que acá atienden mejor. ¿Toman pasantes?', rm: 'happy', fx: { rep: 0.25, fondo: 300 } }] }] },
  { id: 'n_copla', reg: 'noa', name: 'Doña Hilaria', tag: 'Coplera', from: 1, gap: 2, look: { shirt: 0xc2452d, hair: 0x1b1b1f, hairStyle: 'rodete', skin: 0x9a643c, lips: true }, steps: [
    { m: 'talk', t: 'Mi nieta dice que mis coplas tienen que estar "en la nube". Yo las tengo acá, en la cabeza. ¿Con qué las grabo?', note: 'Quiere grabar sus coplas para la nieta.', opts: [{ b: 'Con este micrófono y la paciencia de su nieta', r: 'Entonces sobra. Ella tiene mucha. Vuelvo cuando grabe la primera.', rm: 'happy', fx: { rep: 0.1, fondo: 80 } } , { b: 'Mejor que las grabe la nieta', r: 'Ay, pero las coplas son mías.', rm: 'sad', fx: {} }] },
    { m: 'happy', t: 'Grabé doce. La nieta dice que una "se hizo viral". Yo le dije que se abrigue. Vine a agradecer con empanadas.', note: 'Sus coplas se hicieron conocidas. Trajo empanadas.', end: true, opts: [{ b: '¿De carne cortada a cuchillo?', r: '¿Y de qué otra forma, chango?', rm: 'happy', fx: { rep: 0.2 } }] }] },
  { id: 'n_guia', reg: 'noa', name: 'El Chango Reynaga', tag: 'Guía de montaña', from: 2, gap: 2, look: { shirt: 0x3bb54a, hair: 0x3a2a1a, hairStyle: 'corto', skin: 0xc68a5c }, steps: [
    { m: 'talk', t: 'Llevo turistas al cerro y siempre se les acaba la batería en la mejor foto. Necesito algo para salvarles el día.', note: 'Guía de turistas: se quedan sin batería en la mejor foto.', opts: [{ b: 'Cargadores portátiles, y le hago precio por varios', r: 'Hecho. Si funciona, los recomiendo en todas las excursiones.', rm: 'happy', fx: { rep: 0.1, fondo: 120 } } , { b: 'Que saquen menos fotos', r: 'Se nota que no viste el cerro, vos.', rm: 'normal', fx: { rep: -0.05 } }] },
    { m: 'happy', t: 'Funcionó. Ahora los turistas preguntan dónde compré los cargadores. Les digo que acá. Me deben una comisión, ¿eh? Es broma. O no.', note: 'Recomienda el local en todas las excursiones.', end: true, opts: [{ b: 'Le debemos un café y un 10% en efectivo', r: 'Trato hecho. Y me llevo auriculares para la bajada.', rm: 'happy', fx: { rep: 0.2, fondo: 150 } }] }] },
  { id: 'rival_noa', reg: 'noa', name: 'Doña Ramona', tag: 'Dueña de Pachamama Play', from: 3, gap: 2, look: { shirt: 0xe08a3c, hair: 0x1b1b1f, hairStyle: 'largo', skin: 0x9a643c, lips: true }, steps: [
    { m: 'talk', t: 'Bienvenidos al barrio. Les aviso: yo regalo una empanada con cada compra. Contra eso no hay descuento que alcance.', note: 'Doña Ramona regala empanadas con cada compra.', opts: [{ b: 'Nosotros damos 3 cuotas sin interés', r: 'Cuotas... La empanada no se paga en cuotas. Pero bueno.', rm: 'normal', fx: { rep: 0.1 } } , { b: '¿Y si regalamos empanadas también?', r: 'Las suyas van a ser de supermercado. Se va a notar.', rm: 'happy', fx: { rep: -0.05 } }] },
    { m: 'nervous', t: 'Qué raro, ¿no? Esta mañana había una llama atada en su puerta. Con moño. Yo no sé nada.', note: 'Apareció una llama con moño en la puerta.', opts: [{ b: 'La llama trajo clientes: todos se sacan fotos', r: '...Devuélvamela. Era prestada.', rm: 'sad', fx: { rep: 0.15, fondo: 100 } } , { b: 'Se llama Ramona, por el moño', r: 'Qué falta de respeto. Es Ramón.', rm: 'surprised', fx: { rep: 0.05 } }] },
    { m: 'talk', t: 'Desafío final: mis empanadas contra su servicio técnico. Usted arregla mi notebook; si queda bien, les enseño la receta.', note: 'Desafío final: arreglar la notebook de Doña Ramona.', end: true, opts: [{ b: 'Se la arreglamos, con garantía', r: 'Anda mejor que nueva. La receta es secreta, pero les traigo una docena por semana.', rm: 'happy', fx: { rep: 0.25, fondo: 300 } }] }] },
  { id: 'e_pescador', reg: 'nea', name: 'Don Ramón', tag: 'Pescador del Paraná', from: 1, gap: 2, look: { shirt: 0x21a0a0, hair: 0xc9c9d6, hairStyle: 'pelado', skin: 0xc68a5c, beard: true }, steps: [
    { m: 'talk', t: 'Saqué un dorado así de grande y nadie me cree. Necesito algo para filmar el próximo. Que flote, por las dudas.', note: 'Nadie le cree el tamaño del dorado. Quiere filmar el próximo.', opts: [{ b: 'Cámara con funda que flota, y memoria grande', r: 'Eso. Si no vuelvo con el video, es que se la llevó el dorado.', rm: 'happy', fx: { rep: 0.1, fondo: 100 } } , { b: '¿Y si simplemente le creen?', r: 'Chamigo, vos no conocés a mis amigos.', rm: 'normal', fx: {} }] },
    { m: 'happy', t: 'Tengo el video. El dorado era más chico de lo que yo decía. Pero el surubí que salió después... ese sí.', note: 'Filmó la pesca. El surubí era enorme.', end: true, opts: [{ b: 'Lo pasamos en la tele del local', r: '¡Con música de chamamé, eh! Traigo tereré para todos.', rm: 'happy', fx: { rep: 0.2 } }] }] },
  { id: 'e_abuela', reg: 'nea', name: 'La Ñata', tag: 'Vende chipá en la esquina', from: 2, gap: 2, look: { shirt: 0xf5c518, hair: 0x5a2d0c, hairStyle: 'rodete', skin: 0xe0ac7e, lips: true }, steps: [
    { m: 'talk', t: 'Quiero cobrar la chipá con el celular, como los jóvenes. Pero mi celular es de cuando el río estaba más alto.', note: 'Vende chipá y quiere cobrar con el celular.', opts: [{ b: 'Le muestro uno sencillo, en 3 cuotas sin interés', r: 'Tres cuotas. Te las pago con chipá si querés. Bueno, no. Vuelvo.', rm: 'happy', fx: { rep: 0.1 } } , { b: 'Siga con efectivo, es más fácil', r: 'Me dijeron lo mismo del fuego, y mirá el horno que tengo.', rm: 'sad', fx: { rep: -0.05 } }] },
    { m: 'happy', t: 'Ya cobro con el celular. Vendí el doble. Les dejo una bolsa de chipá: está caliente, no la apoyen arriba de las consolas.', note: 'Cobra con el celular y vendió el doble.', end: true, opts: [{ b: 'Gracias, Ñata. Queda lejos de las consolas', r: 'Y del muchacho que duerme, que se la come toda.', rm: 'happy', fx: { rep: 0.2, fondo: 150 } }] }] },
  { id: 'rival_nea', reg: 'nea', name: 'El Tío Chelo', tag: 'Dueño de Yacaré Games', from: 3, gap: 2, look: { shirt: 0x2f9a48, hair: 0x3a2a1a, hairStyle: 'rulos', skin: 0xc68a5c, beard: true }, steps: [
    { m: 'talk', t: 'Chamigo, acá a la siesta cierra todo. Menos yo. Así que de dos a cinco, los clientes son míos.', note: 'El Tío Chelo no cierra a la siesta.', opts: [{ b: 'Nosotros tenemos la página abierta las 24 horas', r: '¿La página no duerme? Eso es trampa.', rm: 'surprised', fx: { rep: 0.1 } } , { b: 'Entonces tampoco dormimos', r: 'Vas a ver lo que es no dormir la siesta con 40 grados.', rm: 'happy', fx: { rep: -0.05 } }] },
    { m: 'nervous', t: '¿Vieron que se les llenó la vereda de ranas? Qué cosa la naturaleza. Yo pasaba, nomás.', note: 'La vereda se llenó de ranas. El Tío Chelo "pasaba nomás".', opts: [{ b: 'Las ranas se fueron solas. Y trajeron lluvia', r: '...Y con lluvia la gente compra por la página. Me salió mal.', rm: 'sad', fx: { rep: 0.15, fondo: 100 } } , { b: 'Tiene una rana en el bolsillo, Chelo', r: 'Es mi mascota. Se llama Joystick.', rm: 'nervous', fx: { rep: 0.1 } }] },
    { m: 'talk', t: 'Último desafío: torneo de truco. Si gano, se van. Si pierdo, les mando a mis clientes de la siesta.', note: 'Desafío final: torneo de truco contra el Tío Chelo.', end: true, opts: [{ b: 'Quiero vale cuatro', r: '...Me cantó con el ancho de espadas. Tomen, la lista de mis clientes. Atiéndanlos bien.', rm: 'happy', fx: { rep: 0.25, fondo: 300 } }] }] },
  { id: 'p_refugio', reg: 'patagonia', name: 'Greta', tag: 'Cuida un refugio de montaña', from: 1, gap: 2, look: { shirt: 0xd81e2c, hair: 0xd9a514, hairStyle: 'largo', skin: 0xf6d7bd }, steps: [
    { m: 'talk', t: 'En el refugio hay señal solo si te parás en una piedra, en un pie. Necesito entretener a doce montañistas cuando nieva.', note: 'Cuida un refugio sin señal. Necesita entretener montañistas.', opts: [{ b: 'Una consola con juegos para varios, sin internet', r: 'Perfecto. Si se pelean por el turno, los mando a palear nieve.', rm: 'happy', fx: { rep: 0.1, fondo: 150 } } , { b: 'Que lean un libro', r: 'Hay uno. Lo leyeron todos. Dos veces.', rm: 'normal', fx: {} }] },
    { m: 'happy', t: 'Nevó cinco días. Nadie se quiso ir. Armaron un torneo y el premio era no lavar los platos. Vengo por otro joystick.', note: 'En el refugio armaron un torneo durante la nevada.', end: true, opts: [{ b: 'Llevá dos, que el torneo crece', r: 'Y pilas. Muchas pilas.', rm: 'happy', fx: { rep: 0.2, fondo: 150 } }] }] },
  { id: 'p_petrolero', reg: 'patagonia', name: 'El Gringo', tag: 'Trabaja 14 días y descansa 7', from: 2, gap: 2, look: { shirt: 0xe07a5f, hair: 0xb5651d, hairStyle: 'corto', skin: 0xf2c9a0, beard: true }, steps: [
    { m: 'talk', t: 'Trabajo catorce días en el campo y bajo siete. Quiero una PC que me espere prendida de ganas. ¿Me la arman?', note: 'Trabaja 14 días por 7. Quiere que le armen una PC.', opts: [{ b: 'Se la armamos a medida, y la retira cuando baja', r: 'Eso. En catorce días vuelvo. Si no vengo, es el viento.', rm: 'happy', fx: { rep: 0.1 } } , { b: 'Llevate una ya armada', r: 'Mmm. Yo quería elegir las piezas.', rm: 'sad', fx: {} }] },
    { m: 'happy', t: 'Bajé. ¿Está lista? ...Es más linda que mi camioneta. No le digan a mi camioneta.', note: 'Retiró la PC armada a medida.', end: true, opts: [{ b: 'Con garantía, y el secreto queda acá', r: 'Les traigo cordero la próxima bajada.', rm: 'happy', fx: { rep: 0.2, fondo: 250 } }] }] },
  { id: 'rival_patagonia', reg: 'patagonia', name: 'El Ruso Iván', tag: 'Dueño de Ventisca Gaming', from: 3, gap: 2, look: { shirt: 0x8494a8, hair: 0xc9c9d6, hairStyle: 'corto', skin: 0xf6d7bd, beard: true }, steps: [
    { m: 'talk', t: 'Yo regalo campera con cada consola. Acá sin campera nadie compra nada. Suerte.', note: 'El Ruso Iván regala camperas con cada consola.', opts: [{ b: 'Nosotros mandamos el pedido a tu casa: no hace falta salir', r: '...No había pensado en eso.', rm: 'surprised', fx: { rep: 0.1 } } , { b: '¿De dónde saca tantas camperas?', r: 'Esa pregunta no se hace.', rm: 'nervous', fx: { rep: 0.05 } }] },
    { m: 'nervous', t: 'Alguien les dejó un muñeco de nieve en la puerta, ¿no? Con cartel de "cerrado". Los chicos de ahora.', note: 'Un muñeco de nieve con cartel de "cerrado" en la puerta.', opts: [{ b: 'Le pusimos remera roja: ahora es el empleado del mes', r: 'Le queda mejor que a mí la campera. Me voy.', rm: 'sad', fx: { rep: 0.15, fondo: 100 } } , { b: 'Tiene nieve en los guantes, Iván', r: 'Acá todos tenemos nieve en los guantes.', rm: 'nervous', fx: { rep: 0.05 } }] },
    { m: 'talk', t: 'Es el último local que les falta, ¿no? Entonces el desafío es grande: el que haga llegar un paquete a Ushuaia primero, gana el sur.', note: 'El desafío más grande: un envío a Ushuaia contra el Ruso Iván.', end: true, opts: [{ b: 'Sale hoy, con seguimiento y camión propio', r: '...Llegó antes que mi campera. Ganaron el sur. Y el país, me parece.', rm: 'happy', fx: { rep: 0.3, fondo: 400 } }] }] },
  { id: 'c_seno', reg: 'cuyo', name: 'La seño Rosa', tag: 'Maestra de una escuela rural', from: 4, gap: 2, look: { shirt: 0xf4f4f2, hair: 0x5a2d0c, hairStyle: 'rodete', skin: 0xe0ac7e, glasses: true, lips: true }, steps: [
    { m: 'talk', t: 'La cooperadora juntó plata con rifas y empanadas. Queremos tablets para la escuela: somos veinte chicos y un solo enchufe.', note: 'La cooperadora de una escuela rural quiere tablets.', opts: [{ b: 'Tres tablets, en 3 cuotas sin interés', r: '¡Tres! Con las cuotas llegamos. Vuelvo cuando cobremos la rifa del lechón.', rm: 'happy', fx: { rep: 0.1 } }, { b: 'Mejor una sola, la más completa', r: 'Una sola... Bueno. Van a tener que turnarse. Vuelvo con la plata.', rm: 'normal', fx: { flag: 'una' } }] },
    { m: 'happy', t: 'Cobramos la rifa. Ganó el intendente y donó el lechón de nuevo, así que la rifamos dos veces. Vengo por las tres tablets.', alt: { flag: 'una', m: 'sad', t: 'Compré la tablet. Hicimos una lista de turnos: el último la usa en marzo. ¿Me arma el presupuesto de dos más?' }, note: 'Volvió con la plata de la rifa (rifada dos veces).', opts: [{ b: 'Acá están, con funda y garantía', r: 'Con funda: usted conoce a los chicos. Le traigo novedades.', rm: 'happy', fx: { rep: 0.15, fondo: 200 } }] },
    { m: 'happy', t: 'Los chicos le mandan esto: un dibujo de usted atendiendo. Le pusieron capa. Y el más chico pregunta si los juegos también son tarea.', note: 'Los chicos de la escuela mandaron un dibujo.', end: true, opts: [{ b: 'Decile que los de pensar, sí', r: 'Se lo voy a decir. Va a ser el primero en hacer la tarea.', rm: 'happy', fx: { rep: 0.2, fondo: 100 } }] }] },
  { id: 'c_facu', reg: 'cuyo', name: 'Facu', tag: 'Sommelier que quiere hacer catas en vivo', from: 5, gap: 2, look: { shirt: 0x6a2d7a, hair: 0x1b1b1f, hairStyle: 'corto', skin: 0xf2c9a0, beard: true }, steps: [
    { m: 'talk', t: 'Quiero transmitir catas de vino en vivo. Necesito que se escuche el descorche. El descorche es todo.', note: 'Quiere transmitir catas en vivo: lo importante es el descorche.', opts: [{ b: 'Un buen micrófono y una cámara sencilla', r: 'Claro: primero el sonido. Lo pruebo esta noche con un malbec.', rm: 'happy', fx: { rep: 0.1, fondo: 120, flag: 'mic' } }, { b: 'La cámara más cara y el micrófono del celular', r: 'Mmm, bueno. Si usted dice que se ve mejor...', rm: 'normal', fx: { fondo: 150 } }] },
    { m: 'sad', t: 'Se veía hermoso. Pero el descorche sonó como una puerta. Tuve doce espectadores y once eran mi tía con distintas cuentas.', alt: { flag: 'mic', m: 'happy', t: '¡Se escuchó el descorche! Un señor de Japón escribió "POP" en mayúsculas. Tengo cuarenta espectadores y solo una es mi tía.' }, note: 'La primera cata se vio bien pero se escuchó mal.', opts: [{ b: 'Sumemos el micrófono, con 10% en efectivo', r: 'Trato. Y perdón por dudar: esta vez le hago caso.', rm: 'happy', fx: { rep: 0.1, fondo: 100 } }] },
    { m: 'happy', t: 'Me llamó una bodega para que les haga las transmisiones. Vengo a equiparme en serio. Y traje una botella: es para después de las 19.', note: 'Una bodega lo contrató. Volvió a equiparse.', end: true, opts: [{ b: 'Después de las 19, brindamos', r: 'A las 19:01. No antes, que el Dueño tiene oído de sommelier.', rm: 'happy', fx: { rep: 0.2, fondo: 300 } }] }] },
  { id: 'n_telar', reg: 'noa', name: 'Doña Eulogia', tag: 'Tejedora de ponchos', from: 4, gap: 2, look: { shirt: 0xc2452d, hair: 0xc9c9d6, hairStyle: 'largo', skin: 0x9a643c }, steps: [
    { m: 'talk', t: 'Mi nieto dice que mis ponchos se venden solos si les saco buena foto. Yo los tejo, pero de fotos no sé nada, changuito.', note: 'Teje ponchos y quiere venderlos con buenas fotos.', opts: [{ b: 'Este celular, y le enseño a sacar la foto', r: 'A ver... ¡Ah! Sale el poncho y salgo yo. Quedé linda. Vuelvo cuando venda el primero.', rm: 'happy', fx: { rep: 0.15, flag: 'ensen' } }, { b: 'Este celular. Viene con manual', r: 'Manual... Bueno. Mi nieto me lo va a leer.', rm: 'normal', fx: { fondo: 80 } }] },
    { m: 'happy', t: '¡Vendí un poncho a Alemania! El señor preguntó si pica. Le dije que es lana de llama, que pica lo justo.', alt: { flag: 'ensen', m: 'happy', t: '¡Vendí tres ponchos! Las fotos salen tan bien que una señora de Buenos Aires quiso comprarme a mí también.' }, note: 'Vendió su primer poncho a Alemania.', opts: [{ b: '¿Lo mandamos con seguimiento?', r: 'Eso. Que no se me pierda en el cerro.', rm: 'happy', fx: { rep: 0.15, fondo: 150 } }] },
    { m: 'happy', t: 'Ahora teje toda la familia. Le traje uno a usted: rojo, como el local. Póngaselo cuando refresque, que acá a la noche hace frío de verdad.', note: 'Toda la familia teje. Trajo un poncho rojo de regalo.', end: true, opts: [{ b: 'Es el mejor uniforme que tuvimos', r: 'Y no destiñe. Bueno, un poquito.', rm: 'happy', fx: { rep: 0.25, fondo: 150 } }] }] },
  { id: 'n_pulga', reg: 'noa', name: 'El Pulga', tag: 'Charanguista de peña', from: 5, gap: 2, look: { shirt: 0x21a0a0, hair: 0x1b1b1f, hairStyle: 'rulos', skin: 0xc68a5c }, steps: [
    { m: 'talk', t: 'Toco el charango en la peña y al fondo no me escuchan. Necesito un parlante. Que aguante una zamba, una chacarera y un cumpleaños.', note: 'Toca en una peña y al fondo no lo escuchan.', opts: [{ b: 'Este grande, con batería para toda la noche', r: 'Toda la noche. Usted sí conoce las peñas.', rm: 'happy', fx: { rep: 0.1, fondo: 150, flag: 'bat' } }, { b: 'Este chiquito, es más barato', r: 'Mmm. Bueno, si alcanza para la zamba...', rm: 'normal', fx: { fondo: 60 } }] },
    { m: 'sad', t: 'Se apagó en la mitad de la zamba. Justo en el pañuelo. La gente siguió revoleando en silencio. Fue muy triste y muy lindo.', alt: { flag: 'bat', m: 'happy', t: '¡Aguantó hasta las seis de la mañana! Tocamos tanto que el dueño de la peña nos pidió por favor que nos fuéramos.' }, note: 'El parlante chico se apagó en plena zamba.', opts: [{ b: 'Llevate el grande, te tomo el otro', r: 'Gracias, hermano. La próxima zamba va completa.', rm: 'happy', fx: { rep: 0.15, fondo: 100 } }] },
    { m: 'happy', t: 'Sábado, peña en la plaza, dedicada al local. Ya le compuse una copla: "En GameShop me atendieron, me dieron lo que pedí, / no me cobraron de más... ¡y encima me sonreí!"', note: 'Le compuso una copla al local.', end: true, opts: [{ b: 'Esa va al cartel de la entrada', r: '¡Aro, aro, aro! Diga que sí.', rm: 'happy', fx: { rep: 0.3 } }] }] },
  { id: 'e_yerba', reg: 'nea', name: 'Don Wenceslao', tag: 'De la cooperativa yerbatera', from: 4, gap: 2, look: { shirt: 0x3f8f3a, hair: 0xc9c9d6, hairStyle: 'corto', skin: 0xc68a5c, beard: true }, steps: [
    { m: 'talk', t: 'En la cooperativa llevamos las cuentas en un cuaderno que ya tiene olor a yerba. Queremos una computadora. Que no se asuste con la humedad.', note: 'La cooperativa yerbatera quiere dejar el cuaderno.', opts: [{ b: 'Una notebook, y se la dejo configurada', r: '¿Configurada? ¿Eso muerde? Bueno, confío. Vuelvo con los socios.', rm: 'happy', fx: { rep: 0.15, flag: 'conf' } }, { b: 'Una notebook. Se configura sola', r: 'Sola... Como el mate, que se ceba solo. Ya veremos.', rm: 'normal', fx: { fondo: 100 } }] },
    { m: 'nervous', t: 'Chamigo, la prendimos y nos pidió una contraseña. Pusimos "yerba". Después "Yerba". Después "YERBA1". Ahora dice que esperemos una hora.', alt: { flag: 'conf', m: 'happy', t: 'Anda una maravilla. Los socios se pelean por cargar las planillas. Nunca vi a tanta gente con ganas de hacer cuentas.' }, note: 'Se bloqueó la notebook: probaron "yerba" de todas las formas.', opts: [{ b: 'Tráigala: el servicio técnico la deja lista', r: 'Menos mal. Ya estábamos por volver al cuaderno.', rm: 'happy', fx: { rep: 0.15, fondo: 80 } }] },
    { m: 'happy', t: 'Cerramos el año con los números claros por primera vez. Sobró plata y nadie sabe qué hacer. Yo propuse otra computadora. Y traje yerba: de la buena, la que no sale.', note: 'La cooperativa cerró el año con las cuentas claras.', end: true, opts: [{ b: 'Otra notebook, y gracias por la yerba', r: 'Y un tereré para usted, que con este calor no se toma otra cosa.', rm: 'happy', fx: { rep: 0.2, fondo: 300 } }] }] },
  { id: 'e_carpinchas', reg: 'nea', name: 'Las Carpinchas', tag: 'Equipo de juegos del club del barrio', from: 5, gap: 2, look: { shirt: 0xff5fa2, hair: 0x5a2d0c, hairStyle: 'largo', skin: 0xc68a5c, lashes: true }, steps: [
    { m: 'talk', t: 'Somos Las Carpinchas, el equipo del club. El sábado es el torneo provincial y tenemos cuatro jugadoras y tres joysticks. La cuarta juega con el teclado de la secretaría.', note: 'Un equipo del club necesita un joystick para el torneo.', opts: [{ b: 'Les presto el de exhibición para el torneo', r: '¿En serio? ¡Lo cuidamos como al trofeo! Bueno, como al trofeo que todavía no tenemos.', rm: 'happy', fx: { rep: 0.2, flag: 'presta' } }, { b: 'Hay 3 cuotas sin interés', r: 'Lo hablamos con la comisión del club. Se reúne los jueves. A veces.', rm: 'normal', fx: { rep: 0.05 } }] },
    { m: 'sad', t: 'Perdimos la final por un punto. La del teclado jugó bárbaro, pero se le trabó la barra espaciadora en el momento clave. Igual salimos segundas.', alt: { flag: 'presta', m: 'happy', t: '¡GANAMOS! Con su joystick hicimos el último punto. Lo devolvemos lustrado. Bueno, casi: tiene un poco de chipá.' }, note: 'Salieron segundas: se trabó una tecla en la final.', opts: [{ b: 'El año que viene, con cuatro joysticks', r: 'Ya juntamos para el cuarto. ¿Sigue lo de las cuotas?', rm: 'happy', fx: { rep: 0.1, fondo: 120 } }] },
    { m: 'happy', t: 'Ahora hay lista de espera para entrar al equipo. Armamos Las Carpinchitas, las de ocho años. Ya le ganan a los padres. Vinimos todas a comprar.', note: 'El equipo creció: ahora hay hasta categoría infantil.', end: true, opts: [{ b: 'Pasen, que hay joysticks para todas', r: '¡Y pusimos el logo del local en la camiseta! Al lado del carpincho.', rm: 'happy', fx: { rep: 0.3, fondo: 300 } }] }] },
  { id: 'p_frida', reg: 'patagonia', name: 'Doña Frida', tag: 'Chocolatera de la calle principal', from: 4, gap: 2, look: { shirt: 0x7a4a28, hair: 0xc9c9d6, hairStyle: 'rodete', skin: 0xf6d7bd, glasses: true }, steps: [
    { m: 'talk', t: 'En temporada vendo dos mil cajas de bombones y anoto todo en un papelito. El año pasado perdí el papelito. Fue un invierno muy largo.', note: 'Vende miles de cajas y anota todo en un papelito.', opts: [{ b: 'Una PC con impresora de etiquetas', r: 'Etiquetas... ¿Y si las hago con forma de corazón? Vuelvo antes de la nieve.', rm: 'happy', fx: { rep: 0.1, fondo: 150, flag: 'etiq' } }, { b: 'Una libreta más grande', r: 'Ja. Muy gracioso. Pero no tan mala idea.', rm: 'normal', fx: { rep: 0.05 } }] },
    { m: 'nervous', t: 'Compré la libreta grande. La perdí igual. Era grande, pero se ve que no lo suficiente. Ahora sí: quiero la PC y la impresora.', alt: { flag: 'etiq', m: 'happy', t: '¡Dos mil cajas etiquetadas! Los turistas piden la etiqueta sin el chocolate. No sé si ofenderme.' }, note: 'Perdió también la libreta grande.', opts: [{ b: 'Se la dejamos instalada y con garantía', r: 'Y átenmela al mostrador, por las dudas.', rm: 'happy', fx: { rep: 0.15, fondo: 200 } }] },
    { m: 'happy', t: 'Cerré la mejor temporada de mi vida. Les traje una caja a cada uno. Y una grande para el que duerme: me dijeron que en todas las sucursales hay uno.', note: 'Tuvo su mejor temporada. Trajo chocolate para todos.', end: true, opts: [{ b: 'Hay uno en todas, es cierto', r: 'Es tradición, como el chocolate caliente.', rm: 'happy', fx: { rep: 0.25, fondo: 150 } }] }] },
  { id: 'p_instructor', reg: 'patagonia', name: 'Nahuel', tag: 'Instructor de esquí', from: 5, gap: 2, look: { shirt: 0x2d6cdf, hair: 0xd9a514, hairStyle: 'corto', skin: 0xf2c9a0 }, steps: [
    { m: 'talk', t: 'Quiero filmar a mis alumnos bajando para mostrarles qué hacen mal. Spoiler: todo. Necesito una cámara que aguante golpes, frío y vergüenza ajena.', note: 'Quiere filmar a sus alumnos de esquí.', opts: [{ b: 'Esta cámara, con funda y correa', r: 'Correa, sí. En la montaña todo lo que no está atado, baja solo.', rm: 'happy', fx: { rep: 0.1, fondo: 150, flag: 'funda' } }, { b: 'Esta cámara. La funda es aparte', r: 'Aparte... Bueno, tengo guantes. La agarro fuerte.', rm: 'normal', fx: { fondo: 100 } }] },
    { m: 'sad', t: 'Se me resbaló en la aerosilla. Cayó cuarenta metros. La encontró un perro de rescate, que ahora la considera suya. Negociamos: me la devolvió por un sándwich.', alt: { flag: 'funda', m: 'happy', t: 'Se me cayó de la aerosilla y quedó colgando de la correa. Filmó toda la caída: es mi video más visto. Diez mil personas me vieron gritar.' }, note: 'La cámara se cayó de la aerosilla y la rescató un perro.', opts: [{ b: 'Ahora sí, con funda y correa', r: 'Con correa. Y un sándwich de repuesto.', rm: 'happy', fx: { rep: 0.1, fondo: 80 } }] },
    { m: 'happy', t: 'Los alumnos mejoraron viendo los videos. Uno ya baja sin gritar. La escuela quiere cámaras para todos los instructores: somos doce.', note: 'La escuela de esquí quiere cámaras para todos.', end: true, opts: [{ b: 'Doce cámaras, doce correas', r: 'Y doce sándwiches, por el perro.', rm: 'happy', fx: { rep: 0.2, fondo: 400 } }] }] },
  { id: 'm_alma', reg: 'malvinas', name: 'La doctora Alma', tag: 'Bióloga que cuenta pingüinos', from: 3, gap: 2, look: { shirt: 0xe07a5f, hair: 0x5a2d0c, hairStyle: 'corto', skin: 0xe0ac7e, glasses: true }, steps: [
    { m: 'talk', t: 'Cuento pingüinos. Hay muchos y se mueven. Necesito una tablet que aguante viento, sal y picotazos: los pingüinos son muy curiosos y nada respetuosos.', note: 'Cuenta pingüinos y necesita una tablet resistente.', opts: [{ b: 'Esta, con funda reforzada', r: 'Reforzada. Perfecto: ya me comieron dos lapiceras.', rm: 'happy', fx: { rep: 0.15, fondo: 120, flag: 'funda' } }, { b: 'Esta, que es más liviana', r: 'Liviana... Con este viento, no sé si eso es bueno.', rm: 'normal', fx: { fondo: 80 } }] },
    { m: 'nervous', t: 'Un pingüino se la llevó. No sé cómo. La encontré en su nido, prendida. Tenía abierto un juego. Iba por el nivel cuatro.', alt: { flag: 'funda', m: 'happy', t: 'La picotearon cuarenta veces y ni un rayón. Conté ocho mil doscientos. Bueno, ocho mil doscientos uno: uno se me subió a la mochila.' }, note: 'Un pingüino se llevó la tablet y la usó.', opts: [{ b: 'Le ponemos funda con correa', r: 'Con correa. Y le dejo una vieja al pingüino, que se lo ganó.', rm: 'happy', fx: { rep: 0.15, fondo: 100 } }] },
    { m: 'happy', t: 'Terminé el censo: hay más pingüinos que nunca. Y pasa algo raro: de tarde se juntan frente a su vidriera. Lo anoté en el informe como "conducta nueva".', note: 'Terminó el censo. Los pingüinos miran la vidriera.', end: true, opts: [{ b: 'Son nuestros clientes más fieles', r: 'Y los únicos que vienen de traje.', rm: 'happy', fx: { rep: 0.25, fondo: 200 } }] }] },
  { id: 'rival_malvinas', reg: 'malvinas', name: 'El Capitán Tormenta', tag: 'Dueño de Pirata Gaming', from: 2, gap: 2, look: { shirt: 0x1b2340, hair: 0x3a2a1a, hairStyle: 'corto', skin: 0xe0ac7e, beard: true, hat: 'bicornio', uniform: true }, steps: [
    { m: 'talk', t: '¡Ah del local! Soy el Capitán Tormenta, de Pirata Gaming. Llegué en barco, clavé un cartel y dije "esto es mío". Así funciona, ¿no?', note: 'El Capitán Tormenta dice que las islas son suyas porque llegó en barco.', opts: [{ b: 'No. Acá se atiende bien y se gana el lugar', r: '¿Atender bien? Qué método raro. Ya van a ver.', rm: 'surprised', fx: { rep: 0.1 } }, { b: 'Las islas ya tenían dueño, capitán', r: 'Detalles. Los piratas no leemos la letra chica.', rm: 'angry', fx: { rep: 0.1 } }] },
    { m: 'nervous', t: 'Qué casualidad: su cartel apareció en mi barco. Y su toldo. Y un pingüino con remera roja. Yo los "tomé prestados". Es cultura pirata.', note: 'Pirata Gaming "tomó prestados" el cartel, el toldo y un pingüino.', opts: [{ b: 'Devuélvalos. El pingüino trabaja acá', r: 'El pingüino se quiso volver solo. Dice que ustedes pagan mejor.', rm: 'sad', fx: { rep: 0.15, fondo: 100 } }, { b: 'Quédese el toldo: con este viento se le vuela igual', r: '...Ya se voló. Con el ancla y todo.', rm: 'nervous', fx: { rep: 0.15 } }] },
    { m: 'talk', t: 'Basta de juegos. Duelo final: todo el pueblo hace fila en los dos locales. El que atienda a todos sin un error se queda en las islas. El otro, leva anclas.', note: 'Duelo final contra Pirata Gaming: atender a todo el pueblo sin un error.', opts: [{ b: 'Acepto. Que pase el primero', r: 'Mi fila se pasó a la de ustedes. Hasta mi loro. Está bien, me voy en mi barco. Las islas son de ustedes. Siempre lo fueron.', rm: 'sad', fx: { rep: 0.4, fondo: 500 } }], end: true }] },
  { id: 'm_farero', reg: 'malvinas', name: 'Don Evaristo', tag: 'El farero', from: 1, gap: 2, look: { shirt: 0x2d6cdf, hair: 0xc9c9d6, hairStyle: 'corto', skin: 0xe0ac7e, beard: true }, steps: [
    { m: 'talk', t: 'Cuido el faro hace treinta años. De noche se ve hasta el continente, si uno tiene ganas. Quiero una radio que agarre todo.', note: 'El farero quiere una radio que agarre todo.', opts: [{ b: 'Este parlante con radio, y pilas de sobra', r: 'Con pilas de sobra. Acá todo se pide de sobra. Vuelvo cuando la pruebe.', rm: 'happy', fx: { rep: 0.15 } }, { b: 'Mejor una tele', r: 'La tele no se escucha desde arriba del faro, m\'hijo.', rm: 'normal', fx: {} }] },
    { m: 'happy', t: 'Anoche agarré un partido, un chamamé y a un señor de Jujuy que saludaba. Desde el faro vi su cartel prendido. Queda lindo.', note: 'Desde el faro se ve el cartel de GameShop prendido.', end: true, opts: [{ b: 'Lo dejamos prendido toda la noche', r: 'Entonces ya son dos faros.', rm: 'happy', fx: { rep: 0.3, fondo: 200 } }] }] },
  // visitas sueltas: cosas raras que pasan una sola vez
  { id: 'loro', name: 'La señora del loro', tag: 'Un cliente raro', once: true, from: 4, look: { shirt: 0x21a0a0, hair: 0xd9a514, hairStyle: 'rulos', skin: 0xf6d7bd, lips: true }, steps: [
    { m: 'talk', t: 'Mi loro dice "tres cuotas sin interés". Lo aprendió pasando por acá. ¿Hay descuento por la publicidad?', note: 'Su loro repite "tres cuotas sin interés".', end: true, opts: [
      { b: 'Para el loro, un mousepad de regalo', r: 'Lo va a usar de alfombra. ¡Gracias! Dice "gracias" también.', rm: 'happy', fx: { rep: 0.15 } },
      { b: 'Que aprenda "10% OFF en efectivo"', r: 'Le va a costar la "efe". Pero lo intento.', rm: 'happy', fx: { rep: 0.1, cord: 5 } }] }] },
  { id: 'futuro', name: 'El viajero', tag: 'Un cliente raro', once: true, from: 7, look: { shirt: 0xc9ccd1, hair: 0x57e6ff, hairStyle: 'mohicano', skin: 0x9a643c, glasses: true }, steps: [
    { m: 'surprised', t: 'Vengo del año 2046. ¿Todavía usan joysticks con botones? Qué ternura. Me llevo uno de recuerdo.', note: 'Dijo venir del 2046. Compró un joystick "de época".', end: true, opts: [
      { b: '¿Y en 2046 seguimos abiertos?', r: 'De 10 a 19. Eso no cambió nunca.', rm: 'happy', fx: { fondo: 200, cord: 8 } },
      { b: 'Son 3 cuotas sin interés. ¿Llegás a pagarlas?', r: 'La última la pago ayer. Es complicado.', rm: 'nervous', fx: { fondo: 200 } }] }] },
  { id: 'perdido', name: 'Un turista', tag: 'Un cliente raro', once: true, from: 5, look: { shirt: 0xe07a5f, hair: 0xd9a514, hairStyle: 'corto', skin: 0xf6d7bd }, steps: [
    { m: 'talk', t: 'Perdón... busco el Obelisco. El mapa del celular me trajo acá. Dos veces.', note: 'Buscaba el Obelisco. El mapa lo trajo dos veces.', end: true, opts: [
      { b: 'Tomate el subte, y cargá el celu acá', r: '¡Gracias! Me llevo un cargador portátil, por las dudas.', rm: 'happy', fx: { fondo: 120, rep: 0.1 } },
      { b: 'Es este. Lo achicaron', r: 'Ah. En las fotos parecía más alto.', rm: 'surprised', fx: { cord: 6 } }] }] }
];
/* Placas de presentación del modo carrera: poco texto, y la cámara muestra de qué se habla. cam = [x, z, zoom]; who = a quién se ve. */
GS.INTRO = [
  { art: 'local', k: 'Casa central', t: 'Tu primer día', d: 'Entrás a trabajar en GameShop: consolas, juegos, notebooks y accesorios. Abrimos de 10 a 19.' },
  { art: 'equipo0', k: 'El equipo', t: 'Lucho y Brian', d: 'Tus compañeros. Lucho repone y cambia el color del mohicano cada día. Brian vive pegado al celular. Los dos duermen la siesta en el depósito.' },
  { art: 'jefe', k: 'El Dueño', t: 'Opina de todo', d: 'Vive en su oficina y sale cuando menos lo esperás. Tiene una frase para cada cosa. Si la reputación baja, se va a notar.' },
  { art: 'reglas', k: 'Antes de empezar', t: 'Cómo se juega', d: 'Tres reglas alcanzan para la primera jornada. El resto te lo voy contando cuando aparezca.' }
];
GS.FINAL = {
  boss: [
    'Veinte jornadas. Nadie había durado tanto desde... bueno, desde Brian.',
    'Atendiste, cobraste, embalaste y casi nunca perdiste la cordura. Y para el local de al lado juntamos {fondo} de {meta}.',
    '{resultado}',
    'Por eso, desde hoy sos {rank}. Te ganaste la llave y el grupo de WhatsApp de proveedores. Suerte con eso.',
    'Gracias por jugar. Y acordate: 10% OFF en efectivo y transferencia. Eso no cambia nunca.'
  ],
  crowd: ['¡Bravo!', '¡Grande!', '¡Ídolo!', '¡Así se atiende!', '¡Que hable!', '¡Aplausos!', '¿Hay descuento por el festejo?', '¡Esto lo subo a mi canal!'],
  card: ['Sobreviví a {n} jornadas en GameShop.', 'Atendí {c} clientes y sigo en pie.', 'Llevando GameShop a todo el país. Brian: durmiendo.']
};

/* Datos de los minijuegos nuevos */
GS.PC_PARTS = [
  { id: 'cpu', short: 'CPU', name: 'Procesador', svg: '<svg viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx="2.500" fill="#1f5a2c" stroke="rgba(0,0,0,.4)" stroke-width=".7"/><rect x="7" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="7" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="7" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="7" width="1.800" height="1.300" fill="#f5c518"/><rect x="10" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="10" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="10" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="10" width="1.800" height="1.300" fill="#f5c518"/><rect x="13" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="13" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="13" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="13" width="1.800" height="1.300" fill="#f5c518"/><rect x="16" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="16" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="16" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="16" width="1.800" height="1.300" fill="#f5c518"/><rect x="19" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="19" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="19" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="19" width="1.800" height="1.300" fill="#f5c518"/><rect x="22" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="22" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="22" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="22" width="1.800" height="1.300" fill="#f5c518"/><rect x="25" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="25" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="25" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="25" width="1.800" height="1.300" fill="#f5c518"/><rect x="28" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="28" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="28" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="28" width="1.800" height="1.300" fill="#f5c518"/><rect x="31" y="4.300" width="1.300" height="1.800" fill="#f5c518"/><rect x="31" y="33.900" width="1.300" height="1.800" fill="#f5c518"/><rect x="4.300" y="31" width="1.800" height="1.300" fill="#f5c518"/><rect x="33.900" y="31" width="1.800" height="1.300" fill="#f5c518"/><rect x="8" y="8" width="24" height="24" rx="3" fill="#c5c9d2" stroke="#8d93a0" stroke-width=".9"/><rect x="11" y="11" width="18" height="18" rx="1.500" fill="#dfe3ea"/><path d="M12.500 17q.500-3.500 4-4.500" fill="none" stroke="#fff" stroke-width="1.400" stroke-linecap="round"/><path d="M15 21h10M15 24h7" stroke="#9aa0ad" stroke-width="1.100" stroke-linecap="round"/><path d="M3 37h6l-6-6Z" fill="#f5c518"/></svg>' },
  { id: 'ram', short: 'RAM', name: 'Memoria RAM', svg: '<svg viewBox="0 0 64 20"><rect x="1" y="2" width="62" height="12" rx="1" fill="#1f8f4e"/><g fill="#101010"><rect x="6" y="4" width="9" height="7"/><rect x="19" y="4" width="9" height="7"/><rect x="36" y="4" width="9" height="7"/><rect x="49" y="4" width="9" height="7"/></g><rect x="1" y="14" width="62" height="4" fill="#d4a017"/></svg>' },
  { id: 'ssd', short: 'SSD', name: 'Disco SSD', svg: '<svg viewBox="0 0 64 20"><path d="M2 3H60a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H2Z" fill="#16233f" stroke="rgba(0,0,0,.45)" stroke-width=".7"/><rect x="2" y="3" width="6" height="14" fill="#f5c518"/><path d="M3.500 3v14M5 3v14M6.500 3v14" stroke="#b8860b" stroke-width=".5"/><rect x="2" y="11" width="6" height="1.800" fill="#f4f4f2"/><rect x="11" y="5.500" width="12" height="9" rx="1" fill="#0c0c10"/><rect x="25" y="5.500" width="8" height="9" rx="1" fill="#0c0c10"/><rect x="35.500" y="5" width="20" height="10" rx="1" fill="#f4f6f9"/><rect x="35.500" y="5" width="20" height="3" fill="#e10600"/><path d="M38 10.500h13M38 12.800h9" stroke="#55555f" stroke-width=".8"/><path d="M62 7.500a2.500 2.500 0 0 0 0 5Z" fill="#f4f4f2"/><path d="M12.500 7h9" stroke="#fff" stroke-width=".7" opacity=".3"/></svg>' },
  { id: 'gpu', short: 'Placa de video', name: 'Placa de video', svg: '<svg viewBox="0 0 90 30"><rect x="1" y="2" width="88" height="22" rx="3" fill="#23232b"/><circle cx="24" cy="13" r="9" fill="#0d0d10" stroke="#e10600" stroke-width="2"/><circle cx="62" cy="13" r="9" fill="#0d0d10" stroke="#e10600" stroke-width="2"/><rect x="14" y="24" width="44" height="5" fill="#d4a017"/></svg>' },
  { id: 'psu', short: 'Fuente', name: 'Fuente', svg: '<svg viewBox="0 0 44 34"><rect x="1.500" y="2" width="41" height="30" rx="2.500" fill="#1d1d23" stroke="rgba(0,0,0,.45)" stroke-width=".8"/><path d="M4 5q.500-1.200 2.500-1.200H24" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".25"/><circle cx="16" cy="17" r="11.500" fill="#0c0c10" stroke="#55555f" stroke-width="1"/><g fill="none" stroke="#3f3f49" stroke-width="1"><circle cx="16" cy="17" r="8.500"/><circle cx="16" cy="17" r="5.500"/><path d="M16 5.500v23M4.500 17h23M8 9l16 16M24 9L8 25"/></g><circle cx="16" cy="17" r="2.600" fill="#e10600"/><rect x="30.500" y="5" width="9.500" height="13" rx="1" fill="#f5c518"/><path d="M32 8h6.500M32 10.500h6.500M32 13h4" stroke="#7a5a00" stroke-width=".8"/><path d="M34.700 14.200l-1.200 2h1.600l-1.200 2" fill="none" stroke="#111" stroke-width=".7"/><rect x="30.500" y="21" width="4" height="6.500" rx=".8" fill="#0c0c10" stroke="#55555f" stroke-width=".6"/><rect x="31.700" y="22" width="1.600" height="2.200" fill="#e10600"/><rect x="36" y="21" width="4" height="6.500" rx=".8" fill="#0c0c10" stroke="#55555f" stroke-width=".6"/><circle cx="38" cy="23" r=".6" fill="#9aa0ad"/><circle cx="37" cy="25.500" r=".6" fill="#9aa0ad"/><circle cx="39" cy="25.500" r=".6" fill="#9aa0ad"/></svg>' }
];
GS.DIAGNOSTICS = [
  { s: 'La notebook no prende. "No hice nada, se rompió sola."', ok: 'El cargador está desenchufado', bad: ['Hay que tirar la notebook', 'Un virus de los fuertes'] },
  { s: 'La PC hace ruido de turbina de avión.', ok: 'El cooler está tapado de pelusa', bad: ['Le falta nafta', 'Está contenta'] },
  { s: '"Internet anda lento." Tiene 47 pestañas abiertas.', ok: 'Cerrar pestañas y reiniciar', bad: ['Cambiar el monitor', 'Comprar otro internet'] },
  { s: 'La pantalla se ve toda negra. El brillo está en cero.', ok: 'Subir el brillo', bad: ['Cambiar la pantalla', 'Formatear todo'] },
  { s: 'La PC se apaga sola cuando juega.', ok: 'Levanta temperatura: limpieza y pasta térmica', bad: ['Juega demasiado bien', 'Es el horóscopo'] },
  { s: 'La notebook anda lentísima. Tiene 4 GB de RAM.', ok: 'Ampliarle la memoria RAM', bad: ['Hablarle con cariño', 'Pegarle un sticker gamer'] },
  { s: 'El joystick se mueve solo para un costado.', ok: 'El stick tiene drift: se repara', bad: ['Está poseído', 'Hay que jugar inclinado'] },
  { s: '"Se me llenó el disco." Tiene 9.000 fotos del mismo asado.', ok: 'Liberar espacio o sumar un disco', bad: ['Comer menos asado', 'Cambiar el teclado'] }
];
GS.CHATS = [
  { m: 'ola precio?', ok: '¡Hola! ¿De qué producto te paso el precio?', bad: ['Sí.', 'Precio tiene, sí.'] },
  { m: 'hacen envios??', ok: 'Sí, a todo el país. Comprando antes de las 14 sale en el día.', bad: ['Depende de las ganas.', 'Solo a los vecinos.'] },
  { m: 'tienen cuotas', ok: 'Sí: 3 cuotas sin interés con tarjeta.', bad: ['Sí: 48 cuotas con mucho interés.', 'Cuotas no, pero fiamos.'] },
  { m: 'es original??? xq en otro lado esta mas barato', ok: 'Sí, todo nuevo, original y con garantía.', bad: ['¿Y vos quién sos para preguntar?', 'Comprá en el otro lado entonces.'] },
  { m: 'si pago en efectivo me hacen precio', ok: 'Sí: 10% OFF en efectivo o transferencia.', bad: ['Sí, te cobramos el doble.', 'El efectivo ya no se usa.'] },
  { m: 'arreglan notebooks?', ok: 'Sí, tenemos service técnico de notebooks y PC.', bad: ['Las miramos fijo hasta que andan.', 'No, solo las desarmamos.'] },
  { m: '🎤 Audio (4:12)', ok: '¿Me lo resumís por escrito? Así te ayudo más rápido 🙂', bad: ['Lo escuché entero. Saludos a tu primo.', 'No.'] },
  { m: 'puedo pasar a retirar hoy', ok: 'Sí, podés retirar en el local.', bad: ['Hoy no, estamos jugando.', 'Retirar sí, pagar también.'] },
  { m: 'aceptan mercadopago', ok: 'Sí, aceptamos Mercado Pago.', bad: ['Solo trueque.', 'Aceptamos, pero con desconfianza.'] },
  { m: 'hola', ok: '¡Hola! ¿En qué te puedo ayudar?', bad: ['Chau.', 'hola (visto)'] },
  { m: 'me podes mandar foto de TODO lo q tienen', ok: '¿Qué estás buscando? Te paso justo lo que necesitás.', bad: ['Dale, dame 3 semanas.', 'Te mando foto mía mejor.'] }
];
GS.SHELVES = [
  { cat: 'consolas', name: 'Consolas y juegos', icon: '🎮', pos: [7.5, -6.0] }, { cat: 'apple', name: 'Apple', icon: '🍏', pos: [9.9, -6.0] },
  { cat: 'pc', name: 'PC y accesorios', icon: '💻', pos: [7.5, -2.6] }, { cat: 'perifericos', name: 'Periféricos gamer', icon: '🎧', pos: [9.9, -2.6] }
];
GS.BOX_SIZE = { chica: ['cable', 'pendrive', 'tinta', 'airpods', 'juego', 'magic', 'watch', 'mouse', 'dualsense', 'ds_blanco', 'ds_negro', 'ds_rojo', 'ds_azul', 'ds_violeta', 'juego2', 'juego3', 'juego4', 'homepod', 'webcam', 'joyxbox', 'muneco', 'disco', 'cargador', 'ram'],
  mediana: ['switch2', 'quest', 'deck', 'ipad', 'router', 'auris', 'gpu', 'streamdeck', 'mic', 'notebook', 'teclado', 'parlante', 'mousepad'], grande: ['ps5', 'xbox', 'gabinete', 'silla', 'volante', 'monitor', 'impresora'] };
GS.BOXES = { chica: { cm: 15, max: 20 }, mediana: { cm: 35, max: 40 }, grande: { cm: 60, max: 70 } };
GS.BUYERS = ['CRACK_DEL_TECLADO', 'LA_TIA_GAMER', 'PEPE_COMPRA_TODO', 'NO_SOY_UN_BOT_22', 'MATE_Y_FPS', 'ABUELA_PRO_PLAYER', 'EL_REY_DEL_ENVIO', 'CARRITO_LLENO_OK'];
GS.CITIES = ['Córdoba', 'Rosario', 'Mendoza', 'Salta', 'Bariloche', 'La Plata', 'Tucumán', 'Mar del Plata', 'Neuquén', 'Posadas'];

/* Utilidades chicas */
GS.util = {
  rnd: (a, b) => a + Math.random() * (b - a),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  money: n => '$' + Math.round(n).toLocaleString('es-AR'),
  clamp: (v, a, b) => Math.max(a, Math.min(b, v))
};

/* Analítica: cada evento del juego pasa por acá. Si hay un ID de Google Analytics 4 en GS.CONFIG.analytics.ga4,
   se envía (sin datos personales: solo el nombre del evento y números del juego). Si no, queda en memoria. */
GS.track = function (evento, datos) {
  (GS.track.log = GS.track.log || []).push({ evento, datos, t: Date.now() });
  if (GS.track.log.length > 200) GS.track.log.shift();
  try { if (window.gtag) window.gtag('event', evento, datos || {}); } catch (e) {}
};
GS.track.init = function () {
  const id = GS.CONFIG.analytics && GS.CONFIG.analytics.ga4; if (!id || !/^http/.test(location.protocol)) return;
  window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date()); window.gtag('config', id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  const sc = document.createElement('script'); sc.async = true; sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id); document.head.appendChild(sc);
};

/* Guardado local con manejo de error (si no hay almacenamiento, sigue en memoria) */
GS.Store = (function () {
  const KEY = 'gameshop_simulator_v1';
  let data = { best: [], tutorial: false, mute: false, quality: 'auto' };
  try { const raw = localStorage.getItem(KEY); if (raw) data = Object.assign(data, JSON.parse(raw)); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  return {
    get: k => data[k],
    set: (k, v) => { data[k] = v; save(); },
    addScore(entry) {
      data.best.push(entry); data.best.sort((a, b) => b.score - a.score); data.best = data.best.slice(0, 5); save();
      return data.best.indexOf(entry);
    },
    reset() { data = { best: [], tutorial: false, mute: data.mute, music: data.music, quality: data.quality, big: data.big, uid: data.uid, avatar: data.avatar }; save(); }
  };
})();
