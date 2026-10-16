# GolfBet

Web responsive para organizar partidas de golf de 18 hoyos y liquidar apuestas en ARS, USD o UYU. Firebase Authentication permite entrar con Google; Firestore permite partidas privadas, compartidas por correo de Google o públicas para usuarios registrados. Las nuevas son privadas por defecto. Solo el creador puede editarlas. No procesa pagos.

## Desarrollo

Requiere Node.js 22.12+ (probado con Node 24).

```sh
npm ci
cp .env.example .env.local
# Completar la configuración pública de la app web de Firebase.
npm run dev
```

No sobrescribir una `.env.local` existente. Vite lee las variables al iniciar: reiniciar el servidor después de modificarlas. La configuración del cliente Firebase es pública; las reglas de Firestore protegen los datos. Nunca incluir claves privadas de cuentas de servicio.

En la portada, **Probar una partida de ejemplo** funciona sin Google. Es un modo local explícito: sus partidas se guardan en ese navegador y no se publican. El acceso y el guardado real requieren los pasos de Firebase de abajo.

## Configurar Firebase — proyecto golfbet-34a06

1. Abrir https://console.firebase.google.com/project/golfbet-34a06/overview.
2. Configuración del proyecto → General → Tus apps → registrar una app web. Copiar `apiKey`, `authDomain`, `projectId` y `appId` a las variables de `.env.local` correspondientes. No necesita Analytics ni Storage.
3. Compilación / Build → Authentication → Comenzar → Método de acceso / Sign-in method → Google → Activar. Seleccionar un correo de soporte y guardar.
4. Compilación / Build → Firestore Database → Crear base de datos. Elegir edición Standard, ID `(default)`, región apropiada (por ejemplo São Paulo si está disponible) y modo producción. La región no se puede cambiar después.
5. Firestore Database → Reglas: reemplazar el contenido con `firestore.rules` y publicar, o desplegarlo con la CLI junto a Hosting. Las reglas incluidas permiten lectura según privacidad (creador, correos verificados autorizados o todos los registrados para públicas), creación con autor válido y edición solo por el creador.
6. Authentication → Configuración → Dominios autorizados: comprobar `golfbet-34a06.web.app` y `golfbet-34a06.firebaseapp.com`. Para pruebas locales agregar `localhost` y, si se usa, `127.0.0.1`. Agregar también cualquier dominio propio.

## Publicar

Firebase CLI está incluida como dependencia de desarrollo. Desde una máquina con navegador:

```sh
npx firebase login
npm run deploy
```

La CLI solicita acceso a la cuenta de Google. No compartir tokens por chat. En una terminal remota se puede usar `npx firebase login --no-localhost` y completar el flujo indicado. El despliegue requiere que la cuenta tenga permisos sobre el proyecto. `npm run deploy` construye la web y publica Hosting y las reglas de Firestore; no crea Authentication ni la base de datos.

La dirección esperada tras desplegar Hosting es `https://golfbet-34a06.web.app`. No se debe considerar publicada hasta que el despliegue termine correctamente.

## Autorizar el despliegue desde Codex

Para esta versión de Firebase CLI se puede usar `FIREBASE_TOKEN` mediante el secreto personal del entorno. En una terminal propia con Node instalado, ejecutar `npx --yes firebase-tools@15.33.0 login:ci`, completar el acceso Google con una cuenta que tenga permisos sobre `golfbet-34a06`, y guardar el token generado **solo** en el campo seguro `FIREBASE_TOKEN` de la configuración del entorno. Nunca enviarlo por chat, guardarlo en `.env.local`, versionarlo ni incluirlo en comandos registrados.

Este mecanismo está deprecado por Firebase, aunque la versión instalada aún lo admite. Para automatización permanente se debe acordar una autenticación de servicio o identidad federada. No se crearon claves privadas ni cuentas de servicio durante este trabajo.

El borrador del entorno incluye dominios de Firebase y `www.googleapis.com` para el intercambio OAuth. Revisar y guardar esos cambios y publicar el entorno cuando lo solicite la interfaz. Esto prepara Codex; **no publica la web**. Verificar primero acceso de lectura con Firebase CLI y luego ejecutar el despliegue autorizado. No activar logs de depuración con credenciales. Si el home no es escribible, usar `XDG_CONFIG_HOME=/tmp/golfbet-firebase-config XDG_CACHE_HOME=/tmp/golfbet-firebase-cache` al invocar la CLI.

Estado de validación: 45 pruebas de cálculo/exportación y 20 pruebas de navegador pasaron, y la compilación de producción pasó. También pasaron las 11 pruebas de permisos en Firestore Emulator. Las reglas se desplegaron correctamente en `golfbet-34a06`. Hosting se desplegó correctamente en https://golfbet-34a06.web.app. Se descargaron los archivos publicados mediante curl con verificación TLS y se ejecutaron en Chromium con interceptación de esas respuestas: la demo liquidó cuatro jugadores sin errores JavaScript. La navegación directa de Chromium fue bloqueada por la confianza del certificado del proxy del entorno; no se desactivó TLS. El inicio de sesión Google y el guardado de una partida real siguen pendientes de validación con el usuario. El usuario confirmó haber activado Google y creado Firestore, pero el flujo real de autenticación y persistencia todavía debe verificarse. La auditoría npm detecta avisos en la dependencia Node `@grpc/grpc-js` de Firebase, sin corrección publicada en esa línea; la aplicación desplegada usa el SDK del navegador y no un servidor gRPC.

## Reglas de cálculo

Todos los cálculos usan centavos enteros de la moneda elegida por partida (ARS por defecto, USD o UYU). Cambiar la moneda no convierte los importes. El total ganado coincide con el total aportado, y la suma de saldos es cero. Los centavos indivisibles se asignan de forma determinista por identificador.

- **Ida y vuelta:** todos aportan un monto fijo por tramo. Los ganadores comparten el pozo; su saldo descuenta su propio aporte.
- **Medal:** gana el score neto más bajo. Aporte fijo o escalonado. Con incremento $1.000, el primer puesto que paga aporta $1.000, el siguiente que paga $2.000 y así sucesivamente. Los premiados o exentos no consumen escalones: si primero, segundo y tercero reciben premio, cuarto paga $1.000 y quinto $2.000. Segundo y tercero pueden pagar, estar exentos o recibir un porcentaje; el primer puesto recibe el porcentaje restante. Desde el cuarto todos pagan.
- **Empates Medal:** se ocupan posiciones de competición: dos segundos ocupan segundo y tercero, y el siguiente es cuarto. Los aportes de esos puestos se suman y dividen entre los empatados. Dos segundos pagan ($1.000 + $2.000) / 2 = $1.500 cada uno. Si un grupo empatado incluye un puesto premiado, todos sus integrantes están exentos y comparten el porcentaje de los puestos premiados ocupados. Esta última regla es una decisión inicial a revisar con el usuario si prefiere otra modalidad.
- **Laguneada:** todos pertenecen a un equipo, cada equipo tiene un score y gana el menor. Los aportes son **por jugador**, según la posición de su equipo. En fijo todos aportan; en escalonado los ganadores están exentos. Equipos empatados promedian escalones. El premio se divide por igual entre los equipos ganadores y luego entre sus integrantes; equipos con distinto tamaño pueden producir distintos saldos por persona.
- **Approach:** un pozo independiente por hoyo (1–18). Todos aportan un fijo por hoyo. Ganadores empatados comparten el pozo.
- **Liquidación:** al tocar un nombre aparece el aporte, premio y saldo por juego. Se sugieren transferencias que cubren todos los saldos; no se garantiza el menor número matemáticamente posible de transferencias. Se puede exportar el desglose en CSV.

Se pueden guardar partidas antes de completar resultados. Liquidar exige scores y ganadores de todos los juegos activos. Los porcentajes premiados correspondientes a puestos presentes deben sumar 100%.

## Validación

```sh
npm test                     # Motor de apuestas
npm run build                # Producción
npm run test:browser         # Flujos desktop y móvil
npm run test:rules           # Permisos con Firestore Emulator
```

Las pruebas de navegador usan Chromium instalado en `/usr/bin/chromium`; fuera de este entorno, instalar el navegador con `npx playwright install chromium`. Las pruebas de reglas requieren Java 21+ y descargan el emulador en su primera ejecución. Usan el proyecto ficticio `demo-golfbet`, nunca la base real.

Prueba real pendiente tras activar Firebase: entrar con Google, crear una partida, abrirla con un segundo usuario, comprobar que pueda leerla pero no editarla, y revisar que se conserve al recargar. Los permisos también se prueban de forma automatizada en el emulador.

## Alcance inicial

Listado de hasta 100 partidas por categoría (propias, públicas, compartidas), edición exclusiva por creador y demostración local. Equipos antes de jugadores, con editor abierto y nombres actualizados en los selectores. Exportación CSV y botón Copiar para WhatsApp (saldos, desglose y transferencias; texto seleccionable si el navegador bloquea el portapapeles). No incluye pagos, perfiles administrativos, historial de cambios, paginación, uso offline ni instalación PWA. No hace falta Google Sites para usarla.

## Privacidad y compatibilidad

Seleccionar el acceso en La partida y guardar. Compartidas admite hasta 50 correos separados por comas, normalizados a minúsculas; los invitados deben iniciar sesión con esas cuentas de Google verificadas. Cambiar a privada revoca todos los invitados. Solo el creador puede modificar la configuración o resultados. El texto para WhatsApp exporta los resultados que el usuario elige copiar y no contiene enlaces a partidas privadas.

La partida existente antes de incorporar privacidad se migró de forma aditiva a `visibility: public` y `sharedEmails: []`, conservando su acceso previo y sus resultados. Su creador puede hacerla privada desde la interfaz. Las consultas están filtradas por permisos antes de traer documentos, y no necesitan índices compuestos.

## Scores negativos, NPT y resultados para WhatsApp

Los scores individuales y de equipo usan campos de texto con teclado completo para poder ingresar el signo menos en Android. Aceptan números negativos y coma decimal; un campo vacío no se interpreta como cero.

NPT significa no presentó tarjeta: se marca por jugador y solo afecta Medal. Todos los NPT quedan últimos empatados, no reciben premios y pagan el aporte fijo o el promedio de sus escalones. La penalidad NPT es un monto adicional por jugador (0 por defecto), que queda para la mesa y no incrementa los premios de Medal, con una línea separada en el desglose. La liquidación incluye el total para la mesa y transferencias hacia ella. Debe existir al menos una tarjeta presentada y los porcentajes de los puestos premiados con tarjeta deben sumar 100%. NPT no impide ganar ida, vuelta, laguneada o approach.

Copiar para WhatsApp incluye cuánto gana/pierde cada jugador, Medal ordenado con scores y NPT, laguneada ordenada con scores e integrantes de equipos, ganadores de ida/vuelta y de cada hoyo de approach, sin transferencias sugeridas. No envía mensajes automáticamente.

## Skins Game

Activar en las apuestas del día. Configurar el aporte general por jugador y hoyo (con valores particulares opcionales en cada fila), recorrido (18 hoyos, ida 1–9 o vuelta 10–18) y acumulación de empates. Cargar directamente el ganador de cada hoyo o marcar empate; Pendiente bloquea la liquidación. No se cargan scores de Skins.

Todos los jugadores aportan por hoyo. Con acumulación, el siguiente ganador único cobra el pozo del hoyo más los anteriores empatados. Sin acumulación se devuelve el aporte de cada hoyo empatado. Los pozos aún pendientes al final del recorrido se devuelven por igual a quienes aportaron. Las devoluciones están incluidas en los saldos; no son premios nuevos. NPT de Medal no excluye de Skins. El desglose individual, CSV y mensaje para WhatsApp incluyen Skins, con detalle de hoyos y devoluciones en pantalla y WhatsApp.

Los valores particulares de Skins reemplazan el general solo en ese hoyo. Vacío usa el valor general; 0 significa hoyo sin aporte. La acumulación y las devoluciones suman los importes reales de cada hoyo. La liquidación y el texto de WhatsApp muestran esos valores.

## Fourball, modalidades y moneda

Las nuevas partidas tienen todas las modalidades desactivadas. Primero se seleccionan en Modalidades del día; después se cargan jugadores y equipos y se configuran importes y resultados de las modalidades activas. Las partidas anteriores conservan su configuración.

Fourball necesita al menos dos parejas distintas y exactamente dos jugadores por pareja. Cada jugador tiene una asignación Fourball independiente de su equipo de laguneada. Se carga el score neto de la pareja, con el menor score ganando. Los aportes son **por jugador**. Aporte fijo o escalonado, premios porcentuales por puesto, exenciones, empates y NPT usan las mismas reglas que Medal. El primer puesto que paga inicia el escalonado. Las penalidades NPT van a la mesa por cada integrante. El resultado de la pareja se reparte entre sus dos jugadores, conservando los centavos. La web y WhatsApp muestran score, puesto e integrantes de cada pareja.

La moneda se selecciona en La partida. ARS/USD/UYU se muestran explícitamente en saldos, pozos, CSV y WhatsApp para evitar ambigüedad del símbolo $. No se convierten importes entre monedas. Documentos anteriores sin moneda se interpretan como ARS; las reglas de Firestore aceptan los tres códigos y conservan compatibilidad con esos documentos.

La paleta usa azul marino #191b45, celeste, blanco y dorado #e5aa3e, inspirada en el flyer proporcionado. No se incorporaron el logo ni la fotografía del club.
