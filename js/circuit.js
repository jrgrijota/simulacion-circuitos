// ═══════════════════════════════════════════════════════════════════
//  FÍSICA: CIRCUITOS DE CORRIENTE CONTINUA
//  Ley de Ohm con un receptor y asociaciones en serie y en paralelo.
//  No dibuja nada: sketch.js lee el resultado de solve() y lo representa.
//
//  Modelo de clase: pila ideal (sin resistencia interna), cables e
//  interruptor sin resistencia y receptores óhmicos (R constante, también
//  las bombillas). Un receptor quitado o un interruptor abierto es un hueco
//  por el que no pasa corriente.
// ═══════════════════════════════════════════════════════════════════

const R_MIN = 5, R_MAX = 100;     // Ω, deslizadores de las resistencias
const V_MAX = 12;                 // V, deslizador de la pila

class Circuit {
    constructor() {
        this.mode    = 'ohm';               // 'ohm' | 'serie' | 'paralelo'
        this.V       = 6;                   // tensión de la pila (V)
        this.R       = 20;                  // receptor del modo ley de Ohm (Ω)
        this.Rs      = [10, 20, 30];        // R₁, R₂, R₃ de serie y paralelo (Ω)
        this.n       = 3;                   // receptores conectados (2 o 3)
        this.present = [true, true, true];  // false: receptor quitado
        this.closed  = true;                // interruptor
    }

    // Resuelve el circuito. Devuelve, para cada receptor, su resistencia,
    // tensión, intensidad y potencia, además de los valores totales.
    //   gapV: tensión entre los extremos de un hueco (receptor quitado o
    //         interruptor abierto). Con un solo hueco en serie es la de la
    //         pila; con varios no está definida en un circuito ideal (null).
    solve() {
        const V = this.V;
        if (this.mode === 'ohm') {
            const I = this.closed ? V / this.R : 0;
            const e = { R: this.R, present: true, V: I * this.R, I, P: I * I * this.R };
            return {
                mode: 'ohm', V, I, Req: this.R, P: V * I, elems: [e],
                open: !this.closed, switchV: this.closed ? 0 : V,
            };
        }

        const idx = [0, 1, 2].slice(0, this.n);
        if (this.mode === 'serie') {
            const gaps = idx.filter(i => !this.present[i]).length + (this.closed ? 0 : 1);
            const open = gaps > 0;
            const Rtot = idx.reduce((s, i) => s + this.Rs[i], 0);
            const I = open ? 0 : V / Rtot;
            const gapV = gaps === 1 ? V : null;
            const elems = idx.map(i => {
                if (!this.present[i]) return { R: this.Rs[i], present: false, V: gapV, I: 0, P: 0 };
                const Vi = I * this.Rs[i];
                return { R: this.Rs[i], present: true, V: Vi, I, P: Vi * I };
            });
            return {
                mode: 'serie', V, I, Req: open ? Infinity : Rtot, Rnominal: Rtot, P: V * I, elems,
                open, switchV: this.closed ? 0 : gapV,
            };
        }

        // Paralelo: cada rama está conectada directamente a la pila.
        const on = this.closed;
        const elems = idx.map(i => {
            if (!this.present[i]) return { R: this.Rs[i], present: false, V: on ? V : 0, I: 0, P: 0 };
            const Ii = on ? V / this.Rs[i] : 0;
            return { R: this.Rs[i], present: true, V: on ? V : 0, I: Ii, P: (on ? V : 0) * Ii };
        });
        const I = elems.reduce((s, e) => s + e.I, 0);
        const inv = elems.reduce((s, e) => s + (e.present ? 1 / e.R : 0), 0);
        const invAll = idx.reduce((s, i) => s + 1 / this.Rs[i], 0);
        return {
            mode: 'paralelo', V, I, Req: inv > 0 && on ? 1 / inv : Infinity, Rnominal: 1 / invAll,
            P: V * I, elems, open: !on || inv === 0, switchV: on ? 0 : V,
        };
    }
}

// Brillo de una bombilla (0–1) según su potencia. Crece deprisa al principio y
// se satura: así se distinguen tanto 0,1 W como 3 W.
function bulbBrightness(P) {
    return P <= 0 ? 0 : P / (P + 0.5);
}
