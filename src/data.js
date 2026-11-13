/* =====================================================================
   GameShop Simulator — DATOS
   Todo lo editable sin tocar la lógica vive acá: configuración, fases,
   catálogo, pedidos de clientes, personajes y frases.
   Precios y stock son FICTICIOS. Personajes inventados.
   ===================================================================== */
const GS = {};

GS.CONFIG = {
  version: '0.8.0',
  phase: 4,
  phaseNote: 'Parte B en curso: vereda con gente, cajas y avatares nuevos',                       // fase actual del proyecto (1 a 5)
  links: { tienda: '', instagram: '' },   // se conectan más adelante
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
    restSeconds: 9,               // respiro entre tandas: habla el Dueño y se ve el local
    customerGap: 7, taskGap: 9    // segundos entre llegadas dentro de una tanda
  }
};

/* Las 5 etapas del proyecto: se muestran siempre mientras esté en construcción */
GS.PHASES = [
  { n: 1, name: 'Base jugable',   desc: 'Inicio, salón 3D, Mostrador y Caja, una jornada completa.' },
  { n: 2, name: 'Minijuegos',     desc: 'Las 11 estaciones, modo Arcade, interrupciones, cordura y combos.' },
  { n: 3, name: 'Carrera',        desc: 'Rangos, jornadas-examen, eventos del año, el Dueño y los personajes.' },
  { n: 4, name: 'Mundo completo', desc: 'Exterior, depósito, oficina, música, final y tarjeta para compartir.' },
  { n: 5, name: 'Pulido',         desc: 'Rendimiento, balance, bugs, accesibilidad, analítica y lanzamiento.' }
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
  { id: 'juego',    name: 'Juego físico',            cat: 'consolas',    icon: '💿', price: 90000,   stock: 9, shelf: 'fondo',   url: '' },
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
  { t: 'Un juego en caja, de los de antes. Que se pueda prestar.', p: 'juego' },
  { t: 'Un jueguito de regalo, con cajita y todo.', p: 'juego' },
  { t: 'Un juego para la consola, de los que vienen con disco o cartucho.', p: 'juego' },
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
GS.SIMILAR = { ps5: 'xbox', xbox: 'ps5', switch2: 'deck', deck: 'switch2', quest: 'auris', dualsense: 'joyxbox', joyxbox: 'dualsense', juego: 'muneco', muneco: 'juego',
  airpods: 'auris', auris: 'airpods', homepod: 'parlante', parlante: 'homepod', magic: 'mouse', mouse: 'magic', ipad: 'notebook', watch: 'airpods', gpu: 'ram', ram: 'gpu',
  notebook: 'monitor', monitor: 'ipad', gabinete: 'xbox', router: 'disco', tinta: 'impresora', impresora: 'tinta', pendrive: 'disco', disco: 'pendrive', cable: 'cargador', cargador: 'cable',
  streamdeck: 'teclado', teclado: 'streamdeck', mic: 'webcam', webcam: 'mic', silla: 'volante', volante: 'joyxbox', mousepad: 'teclado' };

/* Mejoras del local: lugares fijos. Se compran con las monedas que deja cada jornada.
   pos = dónde hace zoom la cámara. Cada nivel es un "modelo" con su precio y su efecto. */
GS.UPGRADES = [
  { id: 'cartel', name: 'Cartel del frente', icon: '🪧', pos: [0, 10.5], zoom: 0.6, base: 'Cartel pintado',
    levels: [{ n: 'Cartel luminoso', d: 'Se ve desde la esquina: +1 cliente por jornada.', price: 800 }, { n: 'Cartel pantalla LED', d: 'El mejor cartel de la cuadra: +2 clientes por jornada.', price: 2500 }] },
  { id: 'sillas', name: 'Sillas gamer', icon: '💺', pos: [-4.6, 2.9], levels: [{ n: 'Sillas gamer de exhibición', d: 'Los clientes esperan cómodos: +10% de paciencia.', price: 350 }] },
  { id: 'mesa', name: 'Mesa de PC', icon: '💻', pos: [2.2, 1.5], levels: [{ n: 'Mesa de PC y accesorios', d: 'Más para vender: +10% de monedas por jornada.', price: 400 }] },
  { id: 'isla', name: 'Isla Apple', icon: '🍏', pos: [-3.2, 0.4], levels: [{ n: 'Isla de productos Apple', d: 'Más para vender: +10% de monedas por jornada.', price: 500 }] },
  { id: 'gondola', name: 'Góndola de periféricos', icon: '🎧', pos: [5.0, 2.7], levels: [{ n: 'Góndola de periféricos gamer', d: 'Más para vender: +10% de monedas por jornada.', price: 600 }] },
  { id: 'arcade', name: 'Arcade en la entrada', icon: '🕹️', pos: [0.7, 8.3], levels: [{ n: 'Arcade en la galería', d: 'Llama la atención desde la vereda: +1 cliente por jornada.', price: 700 }] },
  { id: 'escritorio', name: 'Escritorio gamer', icon: '🖥️', pos: [2.0, 4.6], levels: [{ n: 'Escritorio gamer para probar', d: 'Los clientes se entretienen: +15% de paciencia.', price: 900 }] }
];
GS.RANKS = [[1, 'Vendedor nuevo'], [3, 'Vendedor'], [5, 'Vendedor senior'], [8, 'Encargado']];
/* Condiciones del día: cambian cuánta gente viene y cuántos pedidos salen */
GS.CONDITIONS = {
  lluvia: { name: '🌧️ Día de lluvia', say: 'Llueve. Va a venir menos gente al local, pero van a salir más pedidos de Mercado Libre.', cust: -2, ml: 2 },
  blackfriday: { name: '🏷️ Black Friday', say: 'Hoy es Black Friday. Viene más gente y salen muchos pedidos. Tranquilos, que se puede.', cust: 2, ml: 2 },
  navidad: { name: '🎄 Semana de Navidad', say: 'Semana de Navidad. Todos compran regalos a último momento. Paciencia y buena cara.', cust: 2, ml: 1 }
};
GS.HAIRSTYLES = [['corto', 'Corto'], ['largo', 'Largo'], ['rodete', 'Rodete'], ['rulos', 'Rulos'], ['mohicano', 'Mohicano'], ['pelado', 'Pelado']];
GS.SKINS = [0xf6d7bd, 0xf2c9a0, 0xe0ac7e, 0xc68a5c, 0x9a643c, 0x6b4428];
GS.HAIRS = [0x2b2b3a, 0x4a3a2a, 0x7a3b1e, 0xd9a514, 0xc9c9d6, 0x2d6cdf, 0xff5fa2, 0x3bb54a];

/* Progresión: qué estaciones se suman en cada jornada (de menos a más) y cómo las explica el Dueño */
GS.UNLOCKS = [['mostrador', 'caja'], ['whatsapp', 'cierre'], ['repo', 'stock'], ['ml', 'proveedor'], ['pc', 'service'], ['devol']];
GS.EXPLAIN = {
  mostrador: 'El cliente pide como puede. Vos elegís el producto correcto. Ojo: siempre hay uno parecido para confundirte.',
  caja: 'Al cobrar: 10% OFF en efectivo o transferencia, y 3 cuotas sin interés con tarjeta. Si te muestran un comprobante, compará cada dato antes de aprobar. Si hay uno incorrecto, selecciónalo.',
  whatsapp: 'Contestá con el dato correcto y buena onda. Cada respuesta cuida nuestra reputación.',
  cierre: 'Antes de irnos a las 19, sumá los cobros en efectivo y fijate si coincide con lo que hay en el cajón.',
  repo: 'Cada caja va a su sector. Tocá en el local el sector que corresponde.',
  stock: 'Contá lo que hay de verdad en la góndola. El sistema a veces sueña.',
  ml: 'Caja del tamaño justo, cinta de punta a punta y la etiqueta correcta. Lo que se compra antes de las 14 sale en el día.',
  proveedor: 'Compará el remito con lo que bajó de la carreta. Si falta algo, no firmes.',
  pc: 'Elegí cada pieza y tocá dónde va en la placa. Si una viene al revés, tocala de nuevo para girarla.',
  service: 'En el service: diagnosticá con criterio, limpiá con paciencia y encajá la memoria justo en la ranura.',
  devol: 'Para una devolución mirá las tres reglas: ticket, plazo y estado. Si cumple, se acepta con una sonrisa.'
};

/* Clientes: arquetipos inventados (ninguno es una persona real) */
GS.CUSTOMERS = [
  { id: 'ruben', name: 'Don Rubén',  face: '👴', shirt: 0x6b7a8f, hair: 0xdddddd, tag: 'El nostálgico',
    bye: 'Qué lindo que todavía atienda una persona.', lost: 'Antes esto se arreglaba hablando. Chau.' },
  { id: 'marta', name: 'Marta',      face: '👵', shirt: 0xb86fa8, hair: 0xc9c9d6, tag: 'La tecnología es extraña',
    bye: 'Gracias, querido. No entendí nada, pero gracias.', lost: 'Yo de esto no entiendo. Vuelvo con mi nieto.' },
  { id: 'fede',  name: 'Fede',       face: '🧔', shirt: 0x3d7a4a, hair: 0x3a2a1a, tag: 'Lo vio más barato',
    bye: 'Igual en Mercado Libre estaba más barato, eh.', lost: 'Listo, lo compro en Mercado Libre.' },
  { id: 'tano',  name: 'El Tano',    face: '😎', shirt: 0xd9a514, hair: 0x1e1e1e, tag: 'Por ser cliente',
    bye: '¿Y por ser cliente no me regalás un cablecito?', lost: 'Así tratan a un cliente de toda la vida.' },
  { id: 'sergio',name: 'Sergio',     face: '👨', shirt: 0x4a6fb5, hair: 0x4a3a2a, tag: 'Padre que no sabe qué compra',
    bye: 'Si no es este, vuelvo. Seguro vuelvo.', lost: 'Mejor le pregunto de nuevo al nene.' },
  { id: 'luli',  name: 'Luli',       face: '🤨', shirt: 0xe07a5f, hair: 0x7a3b1e, tag: '¿Es original?',
    bye: 'Pero es original-original, ¿no?', lost: 'Tanta demora... me voy a preguntar a otro lado.' },
  { id: 'kevin', name: 'Kevin',      face: '🤓', shirt: 0x7b4fd1, hair: 0x15151f, tag: 'Gamer experto',
    bye: 'Es lo mejor que encontré según las specs.', lost: 'En el tiempo que esperé, ya lo speedruneé en otro lado.' },
  { id: 'nico',  name: 'Nico',       face: '🏃', shirt: 0x21a0a0, hair: 0x5a4632, tag: 'El apurado',
    bye: '¡Gracias! Dejé el auto en doble fila.', lost: 'Dejé el auto en doble fila y me lo llevó la grúa.' },
  { id: 'sofi',  name: 'Sofi',       face: '🎤', shirt: 0xff5fa2, hair: 0x2b1b3f, tag: 'Streamer en potencia',
    bye: 'Es para mi canal. Ya tengo 14 seguidores.', lost: 'Esto lo cuento en un vivo. A mis 14 seguidores.' }
];

GS.LINES = {
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
    'Productos nuevos, originales y con garantía. Lo digo yo, que soy el Dueño.'
  ],
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
  mostrador: { x: -1.5, z: -4.0, w: 6.0, d: 0.8, h: 1.05 },
  caja:      { x: 2.0,  z: -2.9, w: 0.8, d: 3.0, h: 1.05 },
  isla:      { x: -3.2, z: 0.4,  w: 1.8, d: 0.8, h: 1.05 },
  mesa:      { x: 2.2,  z: 1.5,  w: 1.5, d: 3.6, h: 0.9 },
  escritorio:{ x: 2.2,  z: 4.6,  w: 1.6, d: 0.8, h: 0.78 },
  gondola:   { x: 5.3,  z: 2.7,  w: 0.6, d: 4.8, h: 1.2 },
  service:   { x: 4.9,  z: -5.9, w: 1.8, d: 0.7, h: 0.95 },
  empaque:   { x: 5.3,  z: -2.3, w: 0.7, d: 1.9, h: 0.9 },
  reposicion:{ x: -4.9, z: 0.3 },
  arcade:    { x: 0.7,  z: 8.3 },
  puerta:    { x: -0.9 },                              // por dónde entran los clientes
  cartel:    { textos: ['ENTRÁ. ELEGÍ. JUGÁ.', 'EL JUEGO EMPIEZA ACÁ.'] },
  colaMostrador: [ [-3.9, -2.9], [-2.7, -2.9], [-1.5, -2.9], [-0.3, -2.9] ],
  colaCaja:      [ [1.0, -3.4], [1.0, -2.4], [1.0, -1.4], [0.9, -0.4] ]
};

/* Estaciones de trabajo. pos = dónde hace foco la cámara. soon = llega en la próxima entrega. */
GS.STATIONS = [
  { id: 'mostrador', n: 1, name: 'Mostrador', icon: '🛎', pos: [-1.5, -4.0] },
  { id: 'caja', n: 2, name: 'Caja', icon: '💵', pos: [2.0, -2.9] },
  { id: 'pc', n: 3, name: 'Armado de PC', icon: '🖥️', pos: [2.2, 1.5],
    task: { name: 'PC para armar', tag: 'La quiere "con lucecitas"', late: 'El cliente de la PC se cansó de esperar. Se la arma el cuñado.' } },
  { id: 'service', n: 4, name: 'Service técnico', icon: '🔧', pos: [4.9, -5.6],
    task: { name: 'Equipo en service', tag: '"No hice nada, se rompió solo"', late: 'El equipo del service sigue esperando. Igual que su dueño.' } },
  { id: 'ml', n: 5, name: 'Mercado Libre', icon: '📦', pos: [5.1, -2.3],
    task: { name: 'Pedido para despachar', tag: 'Sale antes de las 14', late: 'Se pasó el corte de las 14. El pedido sale mañana.' } },
  { id: 'whatsapp', n: 6, name: 'WhatsApp', icon: '💬', pos: [-3.4, -4.2],
    task: { name: 'WhatsApp sin responder', tag: 'escribiendo...', late: 'Lo dejaste en visto. Te va a escribir de nuevo, pero con mayúsculas.' } },
  { id: 'repo', n: 7, name: 'Reposición', icon: '🧺', pos: [-4.9, 0.3],
    task: { name: 'Cajas para reponer', tag: 'Llegó mercadería', late: 'Las cajas siguen en el pasillo. Ya son parte del mobiliario.' } },
  { id: 'stock', n: 8, name: 'Control de stock', icon: '🔍', pos: [-5.0, -3.2],
    task: { name: 'Contar una góndola', tag: 'El sistema dice una cosa...', late: 'Nadie contó la góndola. El sistema sigue soñando.' } },
  { id: 'proveedor', n: 9, name: 'Recepción de proveedor', icon: '🚚', pos: [3.6, -5.2],
    task: { name: 'Llegó mercadería', tag: 'Firmame acá, jefe', late: 'El del reparto se cansó de esperar la firma y se fue.' } },
  { id: 'devol', n: 10, name: 'Devoluciones', icon: '↩️', pos: [0.2, -4.0],
    task: { name: 'Quieren devolver algo', tag: '"Lo usé poquito"', late: 'El de la devolución se fue. Vuelve mañana, con refuerzos.' } },
  { id: 'cierre', n: 11, name: 'Cierre de caja', icon: '🧾', pos: [2.0, -3.4], finalOnly: true,
    task: { name: 'Cerrar la caja', tag: 'Última tarea del día', late: 'La caja quedó sin cerrar. Mañana va a ser un día largo.' } }
];

/* Datos de los minijuegos nuevos */
GS.PC_PARTS = [
  { id: 'cpu', name: 'Procesador', svg: '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="3" fill="#c9ccd1"/><rect x="11" y="11" width="18" height="18" rx="1" fill="#8d9199"/><path d="M5 35h7l-7-7z" fill="#d4a017"/></svg>' },
  { id: 'ram', name: 'Memoria RAM', svg: '<svg viewBox="0 0 64 20"><rect x="1" y="2" width="62" height="12" rx="1" fill="#1f8f4e"/><g fill="#101010"><rect x="6" y="4" width="9" height="7"/><rect x="19" y="4" width="9" height="7"/><rect x="36" y="4" width="9" height="7"/><rect x="49" y="4" width="9" height="7"/></g><rect x="1" y="14" width="62" height="4" fill="#d4a017"/></svg>' },
  { id: 'ssd', name: 'Disco SSD', svg: '<svg viewBox="0 0 64 20"><rect x="2" y="3" width="60" height="14" rx="1" fill="#1b1b22"/><rect x="8" y="6" width="14" height="8" fill="#3a3a48"/><rect x="26" y="6" width="20" height="8" fill="#e8e8ee"/><rect x="56" y="3" width="6" height="14" fill="#d4a017"/></svg>' },
  { id: 'gpu', name: 'Placa de video', svg: '<svg viewBox="0 0 90 30"><rect x="1" y="2" width="88" height="22" rx="3" fill="#23232b"/><circle cx="24" cy="13" r="9" fill="#0d0d10" stroke="#e10600" stroke-width="2"/><circle cx="62" cy="13" r="9" fill="#0d0d10" stroke="#e10600" stroke-width="2"/><rect x="14" y="24" width="44" height="5" fill="#d4a017"/></svg>' },
  { id: 'psu', name: 'Fuente', svg: '<svg viewBox="0 0 44 34"><rect x="2" y="2" width="40" height="30" rx="2" fill="#101014"/><circle cx="18" cy="17" r="11" fill="#2a2a32" stroke="#555" stroke-width="2"/><rect x="33" y="8" width="6" height="18" fill="#f5c518"/></svg>' }
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
  { cat: 'consolas', name: 'Consolas y juegos', icon: '🎮', pos: [-2.0, -6.2] }, { cat: 'apple', name: 'Apple', icon: '🍏', pos: [-3.7, 1.0] },
  { cat: 'pc', name: 'PC y accesorios', icon: '💻', pos: [1.6, 0.2] }, { cat: 'perifericos', name: 'Periféricos gamer', icon: '🎧', pos: [5.6, 5.0] }
];
GS.BOX_SIZE = { chica: ['cable', 'pendrive', 'tinta', 'airpods', 'juego', 'magic', 'watch', 'mouse', 'dualsense', 'homepod', 'webcam', 'joyxbox', 'muneco', 'disco', 'cargador', 'ram'],
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

/* Analítica: ganchos vacíos. Se conectan en la Fase 5. */
GS.track = function (evento, datos) {
  (GS.track.log = GS.track.log || []).push({ evento, datos, t: Date.now() });
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
    reset() { data = { best: [], tutorial: false, mute: data.mute, quality: data.quality }; save(); }
  };
})();
