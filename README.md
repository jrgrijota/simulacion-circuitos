# Circuitos Eléctricos — Simulación Interactiva

Simulación para **Física y Química de ESO** sobre circuitos eléctricos sencillos de corriente
continua: las magnitudes eléctricas (tensión, intensidad, resistencia y potencia), la ley de Ohm y
la asociación de receptores en serie y en paralelo.

## Modos

- **Ley de Ohm:** una pila, un interruptor y un receptor, con un amperímetro en serie y un
  voltímetro en paralelo. Se elige la tensión de la pila (0–12 V) y la resistencia (5–100 Ω).
  El botón «＋ Anotar medida» guarda cada lectura en una tabla (con el cociente V / I) y la dibuja
  en una **gráfica intensidad–tensión**, con una recta para cada resistencia.
- **Serie:** dos o tres receptores, uno tras otro, con su resistencia (5–100 Ω cada uno).
- **Paralelo:** dos o tres receptores, cada uno en su rama.

En los tres modos los receptores pueden ser **bombillas** (brillan más cuanto mayor es su
potencia) o **resistencias** (se ponen al rojo), y el **interruptor** se abre o se cierra desde el
panel o pulsándolo en el circuito. En serie y en paralelo se puede **quitar un receptor** (desde el
panel o pulsándolo) para ver qué les pasa a los demás. El lienzo muestra:

- el circuito con sus símbolos, el valor de R, V, I y P de cada receptor y el sentido convencional
  de la corriente;
- los **electrones** moviéndose por los cables de − a +, más deprisa donde la intensidad es mayor
  (se pueden ocultar con el botón «Electrones»);
- en serie y en paralelo, unos **diagramas de barras** de las tensiones y las intensidades, con la
  barra total apilada cuando es la suma de las demás.

## Uso

Abre `index.html` en un navegador (con `?lang=en`, la interfaz se muestra en inglés, con `?lang=ca`, en catalán, con `?lang=eu`, en euskera, y con `?lang=gl`, en gallego). No necesita instalación ni conexión: incluye
[p5.js](https://p5js.org/) en `js/vendor/`. Tiene temas oscuro, claro y alto contraste
(botón del engranaje).

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Panel de controles, medidas y fórmulas |
| `css/style.css` | Estilos y temas |
| `js/circuit.js` | Resolución del circuito: ley de Ohm, serie y paralelo, con interruptor y receptores quitados |
| `js/sketch.js` | Dibujo del circuito, de los electrones, de la gráfica I–V y de las barras; controles |
| `js/i18n.js`, `js/i18n-*.js` | Traducciones de la interfaz |
| `js/estadisticas.js` | Recuento anónimo de visitas (GoatCounter, sin cookies) |
| `guias/circuitos.md` | Guía docente, lista para copiarse en `guias/` del portal |

## Licencia

Código bajo licencia MIT (`LICENSE`); contenidos didácticos bajo CC BY-SA 4.0
(`LICENSE-CONTENT.md`). Forma parte de [SimulaCiencia](https://simulaciencia.es).
