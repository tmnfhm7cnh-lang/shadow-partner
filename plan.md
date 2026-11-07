# shadow-partner — idea y plan

*Escrito el 2026-11-07 a partir de su encargo. El nombre de la carpeta es provisional.*

> **Actualización del mismo día:** Daniel dijo «monigote 3D sencillo… dame una buena primera versión ya». Eso decidió
> la §8.2 (opción A) y saltó la prueba del LOTE 0: la v1 está hecha (ver [README](README.md) y `ESTADO.md` del frente).
> Siguen abiertas la §8.1 (respuestas a cada movimiento: suyas), la §8.3 (pantalla), la §8.4 (música) y la §8.5
> (nombre; en pantalla pone «Sombra»). Los movimientos se escribieron desde la técnica descrita, **sin analizar vídeos**.

## 1 · La idea, en una frase

Un **compañero de sombra**: en una pantalla, un monigote hace ginga y, cuando no lo esperas, lanza un
movimiento de capoeira al azar. Tú respondes de verdad (esquivas, entras o imitas). Es la sombra de
siempre, pero con un estímulo que no decides tú.

## 2 · Qué entrena y qué no — léelo antes de enamorarte

**Sí entrena** (es lo que la pantalla puede dar):

- **Reacción de elección**: ver qué viene y por dónde, y elegir la respuesta. Ojo con la **ley de Hick**
  (Hick, 1952): el tiempo de reacción crece con el número de opciones posibles. Por eso la app tiene que
  dejar **elegir qué movimientos están activos**: se empieza con 2 o 3 y se van añadiendo.
- **Leer la ginga**: si el monigote ginga todo el rato y ataca *desde* la ginga, aprendes a ver la salida
  del golpe, que es lo que pasa en una roda. Si ataca desde parado, entrenas otra cosa, peor.
- **Ritmo y repertorio de respuestas** sin compañero.

**No entrena** (y no hay que venderlo):

- **Distancia.** Una pantalla no tiene profundidad: el monigote está siempre «a la misma distancia».
- **Contacto ni lectura de un rival real** que se adapta a ti.
- **Medir tu tiempo de reacción**, al menos al principio: sin cámara la app no sabe qué has hecho, y
  si mandas la imagen a la tele por AirPlay hay un retraso que no he medido. *(Inferido, no comprobado.)*

## 3 · Cómo funciona una sesión

1. Pones la pantalla a 2–3 m, en el suelo o sobre una silla, con espacio despejado alrededor
   (una cabeçada hacia la tele es un riesgo real).
2. Eliges deporte (capoeira; boxeo más adelante), movimientos activos, velocidad y duración del asalto.
3. Pulsas empezar: cuenta atrás, el monigote ginga al ritmo y lanza movimientos al azar.
4. Al acabar: resumen (cuántos de cada movimiento, duración). Nada más en la primera versión.

**La velocidad** son en realidad tres mandos, que en pantalla se juntan en uno solo (1–10) y se
separan en «avanzado»:

- **Tempo de la ginga** (en capoeira, el toque del berimbau: lento tipo Angola, rápido tipo São Bento Grande).
- **Duración del movimiento** (lo rápido que llega la patada).
- **Densidad**: cuánta ginga hay entre un movimiento y el siguiente.

**Lados:** todo se nombra **desde tus ojos**, no desde el cuerpo del monigote. «Viene por la derecha»
significa que entra por el lado derecho de la pantalla, que es tu derecha. Así no hay que traducir nada
mientras entrenas. Qué pierna usa el monigote es solo un detalle de la animación.

## 4 · Cómo se ve — sencilla pero atractiva

- **Escenario oscuro** con un foco sobre el monigote y su sombra en el suelo. Pocos colores.
- **Monigote estilizado**: miembros gruesos y redondeados, silueta limpia, sin cara. Se lee de lejos
  en una pantalla pequeña, que es lo que importa.
- **Personalización sencilla**: 3–4 monigotes predefinidos y, como detalle de capoeira, **el color del
  cordão** y del abadá. Avatares en 3D a medida son otro proyecto entero: fuera de esta versión.
- **Modo ayuda** (se puede quitar): durante el aprendizaje, una flecha o el nombre del movimiento indica
  la respuesta. Sin él, solo el monigote.
- **Pantalla siempre encendida** mientras dura el asalto (Wake Lock; Safari lo admite desde iOS 16.4
  según su documentación, *no comprobado en su iPhone*).

## 5 · El problema técnico de verdad: las animaciones

Todo lo demás (el sorteo, la velocidad, los menús) es fácil. **Lo difícil es que una armada o un au se vean
creíbles.** Si el monigote se mueve como un robot, la app no sirve, por bonita que sea la pantalla.

Las tres opciones:

| Opción | A favor | En contra |
|---|---|---|
| **A. Esqueleto 3D propio dibujado en 2D**, sin librerías | Los giros (armada, meia-lua de compasso) se ven bien porque el cuerpo gira de verdad; sin dependencias, como angle-lab; cada movimiento es un archivo de datos | Las poses clave las escribo yo a mano: lento, y el resultado depende de tu revisión |
| B. Monigote plano 2D | Lo más rápido de hacer | De frente, un giro no se entiende: la armada se ve como una pierna que cruza la pantalla |
| C. Motor 3D (three.js) con modelos y animaciones descargadas | Puede quedar más vistoso | Dependencia nueva, más peso, licencias de cada animación por revisar, y menos control sobre los movimientos |

**Recomiendo A.** Y para no escribir las poses a ciegas, un acelerador opcional: **grabarte haciendo
cada movimiento de pie y sacar las poses con el MediaPipe que ya tienes** (`venv-vision`). Eso sirve para
ginga, armada, meia-lua de frente, queixada, martelo y cabeçada. **No sirve para au ni bananeira**:
MediaPipe falla boca abajo (ya visto el 2026-10-21). Esos irían a mano.

**Por eso la primera sesión de construcción es una prueba, no la app**: ginga + armada y nada más.
Si al verlo en tu pantalla no te convence, se decide entonces (más trabajo de poses, o la opción C con tu sí).

## 6 · Fases

| Fase | Qué sale | Cuándo se da por buena |
|---|---|---|
| **0 · Prueba** | Monigote, ginga en bucle y una armada a la orden | La ves en el iPhone/iPad y dices «se entiende y no da vergüenza» |
| **1 · Mínima usable** | Los movimientos que elijas, sorteo al azar, velocidad 1–10, asalto con tiempo, pantalla completa | Haces un asalto real de 3 min solo con ella |
| **2 · Bonita** | Escenario, monigotes predefinidos, cordão, modo ayuda | Te gusta lo bastante para usarla una semana |
| **3 · Música y publicación** | Ritmo de berimbau que marca el tempo; instalable en el iPhone; publicada | Funciona sin conexión desde la pantalla de inicio |
| Después | Fintas, combinaciones, pack de boxeo, registro de sesiones, cámara que comprueba hacia dónde te moviste | Cada una, con su propio criterio cuando toque |

**Terminada cuando** (el criterio del frente): publicada y la usas solo, ha sobrevivido a entrenamientos
reales de capoeira, y si guarda datos, salen en el formato del sistema.

## 7 · Cómo está hecha por dentro (para el prompt)

Como angle-lab: JavaScript sin librerías, capas separadas, tests con Node.

- `core/` — sin pantalla, todo probado con tests:
  - el **esqueleto** (unas 15 articulaciones) y la cinemática que convierte ángulos en posiciones;
  - la **biblioteca de movimientos** como datos: nombre, deporte, tipo (ataque, desplazamiento, floreio,
    neutro), **por dónde llega** (izquierda, derecha, centro; alto o bajo), duración, poses clave, desde
    qué posición de la ginga puede salir, y **las respuestas válidas, que escribes tú**;
  - el **sorteo**: con semilla (para poder probarlo), con pesos, sin repetir el mismo más de N veces
    seguidas, equilibrando lados, y lanzando solo desde la fase de ginga que toca.
- `render/` — dibuja el esqueleto en un canvas, con perspectiva.
- `ui/` — menús, mandos y pantalla completa.

Un **deporte es un paquete de movimientos más su postura base**: capoeira, la ginga; boxeo, la guardia.
El motor es el mismo. Así meter boxeo después es añadir datos, no rehacer la app.

## 8 · Lo que necesito de ti antes de construir

1. **La lista de movimientos de la primera versión y su respuesta válida** (o respuestas). Esto es tuyo,
   no mío. Una propuesta para que la taches o la corrijas, sacada de lo que dijiste:

   | Movimiento del monigote | Respuesta (tuya, a confirmar) |
   |---|---|
   | Armada (giratoria) | Esquiva hacia el lado contrario por el que llega |
   | Meia-lua de compasso | Esquiva baja / negativa hacia el lado contrario |
   | Meia-lua de frente | ¿? |
   | Queixada | ¿? |
   | Au hacia un lado | Desplazarte al lado contrario o entrar con cabeçada |
   | Bananeira (se queda) | Imitarla o entrar con cabeçada |

2. **¿Opción A** (esqueleto propio, sin librerías)? Recomendada.
3. **¿En qué pantalla la vas a usar primero?** (iPad sobre una silla, tele por AirPlay, móvil…). Decide
   el tamaño del monigote y dónde se prueba.
4. **Música:** ¿tocas berimbau o tienes grabaciones tuyas? Una grabación tuya evita cualquier problema
   de licencia. Si no, la primera versión va sin música y con un metrónomo discreto.
5. **Nombre** de la app (la carpeta se llama `shadow-partner` hasta que digas otro).
