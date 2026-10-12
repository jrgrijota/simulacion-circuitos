// ═══════════════════════════════════════════════════════════════════
//  SIMULACIÓN: CIRCUITOS ELÉCTRICOS SENCILLOS
//  Física y Química para Secundaria
//  La física está en circuit.js; aquí se dibuja y se conectan los controles.
// ═══════════════════════════════════════════════════════════════════

// Números con coma decimal, como se escriben en clase (punto en inglés).
function fmt(x, d) {
    return i18n.num(x, d);
}
function fmtV(v) { return v == null ? '—' : fmt(v, 2); }
function fmtI(i) { return fmt(i, 3); }
function fmtP(p) { return fmt(p, 2); }
function fmtR(r) {
    if (!isFinite(r)) return '∞';
    return Math.abs(r - Math.round(r)) < 0.005 ? fmt(Math.round(r), 0) : fmt(r, 2);
}

const SUB = ['₁', '₂', '₃'];
function elemName(k, mode) { return mode === 'ohm' ? 'R' : 'R' + SUB[k]; }

// --- MODELO ---
const circuit = new Circuit();
let sol = circuit.solve();
let receptorType = 'bombilla';     // 'bombilla' | 'resistencia'
let measurements = [];             // ley de Ohm: { R, V, I }
const MAX_MEAS = 12;

// --- INTERACCIÓN ---
let showElectrons = true;
let THEME = {};

// --- LAYOUT DEL CANVAS ---
const CV_W = 1050, CV_H = 700;
const SCENE  = { x: 16, y: 16, w: 1018, h: 430 };
const LOWER  = { x: 16, y: 462, w: 1018, h: 222 };

// Geometría del circuito (píxeles del lienzo)
const C_L = 130, C_T = 125, C_B = 395;          // lado de la pila, cable de arriba y de abajo
const C_MID = (C_T + C_B) / 2;                  // centro de la pila y de las ramas
const BAT_GAP = 8;                              // media separación entre las placas de la pila

// --- ELECTRONES ---
const E_SPACING = 24;      // separación entre electrones (px)
const E_SPEED   = 70;      // px/s por cada amperio
const E_VMAX    = 320;     // tope de velocidad para que se puedan seguir con la vista
let wirePhase = {};        // desplazamiento acumulado de cada tramo

// --- DOM ---
let sliderV, sliderR, sliderR1, sliderR2, sliderR3, typeSelect, switchToggle;

// ─────────────────────────────────────────────────────────────────
function setup() {
    const canvas = createCanvas(CV_W, CV_H);
    canvas.parent('canvas-container');
    frameRate(60);
    textFont('monospace');

    sliderV  = select('#slider-v');
    sliderR  = select('#slider-r');
    sliderR1 = select('#slider-r1');
    sliderR2 = select('#slider-r2');
    sliderR3 = select('#slider-r3');
    typeSelect   = select('#receptor-type');
    switchToggle = document.getElementById('switch-toggle');

    [sliderV, sliderR, sliderR1, sliderR2, sliderR3].forEach(s => s.input(readControls));
    typeSelect.changed(() => { receptorType = typeSelect.value(); });
    switchToggle.addEventListener('change', () => setSwitch(switchToggle.checked));

    select('#mode-ohm').mousePressed(() => setMode('ohm'));
    select('#mode-serie').mousePressed(() => setMode('serie'));
    select('#mode-paralelo').mousePressed(() => setMode('paralelo'));

    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            circuit.n = parseInt(btn.dataset.count, 10);
            document.querySelectorAll('.count-btn').forEach(b => b.classList.toggle('active', b === btn));
            refresh();
        });
    });
    document.querySelectorAll('.present-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleReceptor(parseInt(btn.dataset.index, 10)));
    });

    document.getElementById('btn-record').addEventListener('click', recordMeasurement);
    document.getElementById('btn-clear').addEventListener('click', () => { measurements = []; refresh(); });

    const eBtn = document.getElementById('electron-toggle');
    eBtn.addEventListener('click', () => {
        showElectrons = !showElectrons;
        eBtn.setAttribute('aria-pressed', String(showElectrons));
        eBtn.classList.toggle('active', showElectrons);
    });
    eBtn.classList.toggle('active', showElectrons);

    setupThemePanel();
    readControls();
}

function setupThemePanel() {
    const themeBtn   = document.getElementById('theme-btn');
    const themePanel = document.getElementById('theme-panel');
    const themeOpts  = document.querySelectorAll('.theme-opt');

    const close = () => {
        themePanel.classList.remove('open');
        themeBtn.classList.remove('active');
        themeBtn.setAttribute('aria-expanded', 'false');
        themePanel.setAttribute('aria-hidden', 'true');
    };

    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = themePanel.classList.toggle('open');
        themeBtn.classList.toggle('active', isOpen);
        themeBtn.setAttribute('aria-expanded', String(isOpen));
        themePanel.setAttribute('aria-hidden', String(!isOpen));
    });
    document.addEventListener('click', (e) => {
        if (!themeBtn.contains(e.target) && !themePanel.contains(e.target)) close();
    });
    themeOpts.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.body.classList.remove('theme-light', 'theme-contrast');
            if (theme !== 'dark') document.body.classList.add('theme-' + theme);
            themeOpts.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            close();
        });
    });
}

// ─────────────────────────────────────────────────────────────────
//  ESTADO Y CONTROLES
// ─────────────────────────────────────────────────────────────────
function setMode(mode) {
    circuit.mode = mode;
    ['ohm', 'serie', 'paralelo'].forEach(m => {
        document.body.classList.toggle('mode-' + m, m === mode);
        document.getElementById('mode-' + m).classList.toggle('active', m === mode);
    });
    wirePhase = {};
    refresh();
}

function readControls() {
    circuit.V  = parseFloat(sliderV.value());
    circuit.R  = parseFloat(sliderR.value());
    circuit.Rs = [sliderR1, sliderR2, sliderR3].map(s => parseFloat(s.value()));
    refresh();
}

function setSwitch(closed) {
    circuit.closed = closed;
    switchToggle.checked = closed;
    refresh();
}

function toggleReceptor(k) {
    if (k >= circuit.n) return;
    circuit.present[k] = !circuit.present[k];
    refresh();
}

function recordMeasurement() {
    const e = sol.elems[0];
    const last = measurements[measurements.length - 1];
    if (last && last.R === e.R && last.V === e.V && last.I === e.I) return;
    measurements.push({ R: e.R, V: e.V, I: e.I });
    if (measurements.length > MAX_MEAS) measurements.shift();
    refresh();
}

// Recalcula el circuito y actualiza las etiquetas y el panel.
function refresh() {
    sol = circuit.solve();
    updateLabels();
    updatePanel();
}

function updateLabels() {
    select('#val-v').html(`${fmt(circuit.V, 1)} V`);
    select('#val-r').html(`${circuit.R} Ω`);
    select('#val-r1').html(`${circuit.Rs[0]} Ω`);
    select('#val-r2').html(`${circuit.Rs[1]} Ω`);
    select('#val-r3').html(`${circuit.Rs[2]} Ω`);
    select('#switch-state').html(i18n.t(circuit.closed ? '(cerrado)' : '(abierto)'));
    [[sliderV, 0, V_MAX], [sliderR, R_MIN, R_MAX], [sliderR1, R_MIN, R_MAX],
     [sliderR2, R_MIN, R_MAX], [sliderR3, R_MIN, R_MAX]].forEach(([s, a, b]) => setSliderFill(s, a, b));

    document.getElementById('wrap-r3').classList.toggle('is-disabled', circuit.n < 3);
    sliderR3.elt.disabled = circuit.n < 3;
    document.querySelectorAll('.present-btn').forEach(btn => {
        const k = parseInt(btn.dataset.index, 10);
        const inUse = k < circuit.n;
        btn.disabled = !inUse;
        btn.setAttribute('aria-pressed', String(inUse && circuit.present[k]));
        btn.classList.toggle('off', inUse && !circuit.present[k]);
    });
    document.getElementById('btn-clear').disabled = measurements.length === 0;
}

function setSliderFill(slider, minV, maxV) {
    const pct = ((parseFloat(slider.value()) - minV) / (maxV - minV)) * 100;
    slider.elt.style.setProperty('--fill', pct.toFixed(1) + '%');
}

// ─────────────────────────────────────────────────────────────────
function draw() {
    updateTheme();
    background(THEME.canvasBg);
    const dt = Math.min(deltaTime / 1000, 1 / 20);

    drawScene(dt);
    drawBottomPanel();
    updateCursor();
}

// ═══════════════════════════════════════════════════════════════════
//  TEMAS DEL LIENZO
// ═══════════════════════════════════════════════════════════════════
function updateTheme() {
    const isLight    = document.body.classList.contains('theme-light');
    const isContrast = document.body.classList.contains('theme-contrast');
    if (isLight) {
        THEME = {
            canvasBg: '#ccd6e8', sceneBg: '#e4ecf6', panelBg: '#b8c8dc', panelBorder: '#6888a0',
            wire: '#3a4858', comp: '#1a2838', compFill: '#f4f7fb',
            text: '#0d1520', textDim: '#3a4a5a', textFaint: '#5a6a7a', grid: color(30, 50, 80, 40),
            v: '#a16207', i: '#0369a1', r: '#c2410c', p: '#15803d',
            electron: '#0284c7', electronMark: '#ffffff', arrow: '#c2410c',
            glow: [255, 200, 40], heat: [230, 60, 20], warn: '#c02020',
            displayBg: '#1a2430', displayText: '#7dffb0',
            msgBg: color(255, 255, 255, 220),
            series: ['#0284c7', '#db2777', '#65a30d', '#ea580c', '#7c3aed'],
        };
    } else if (isContrast) {
        THEME = {
            canvasBg: '#000000', sceneBg: '#000000', panelBg: '#000000', panelBorder: '#ffff00',
            wire: '#ffffff', comp: '#ffffff', compFill: '#000000',
            text: '#ffffff', textDim: '#ffff00', textFaint: '#cccccc', grid: color(255, 255, 0, 60),
            v: '#ffff00', i: '#00ffff', r: '#ff9900', p: '#00ff66',
            electron: '#00ffff', electronMark: '#000000', arrow: '#ff9900',
            glow: [255, 255, 0], heat: [255, 80, 0], warn: '#ff4444',
            displayBg: '#000000', displayText: '#00ff66',
            msgBg: color(0, 0, 0, 235),
            series: ['#00ffff', '#ff66ff', '#00ff66', '#ff9900', '#ffff00'],
        };
    } else {
        THEME = {
            canvasBg: '#141414', sceneBg: '#151c24', panelBg: '#141c24', panelBorder: '#22303c',
            wire: '#9aa8b8', comp: '#d8e2ec', compFill: '#1c2530',
            text: '#e0e8f0', textDim: '#8a9aaa', textFaint: '#5a6a7a', grid: color(255, 255, 255, 22),
            v: '#facc15', i: '#38bdf8', r: '#fb923c', p: '#4ade80',
            electron: '#38bdf8', electronMark: '#0a1420', arrow: '#fb923c',
            glow: [255, 210, 60], heat: [255, 70, 30], warn: '#ff6b6b',
            displayBg: '#0a0f14', displayText: '#7dffb0',
            msgBg: color(10, 16, 24, 225),
            series: ['#38bdf8', '#f472b6', '#a3e635', '#fb923c', '#c084fc'],
        };
    }
}

// ═══════════════════════════════════════════════════════════════════
//  GEOMETRÍA DEL CIRCUITO
//  Los tramos de cable se recorren en el sentido convencional de la
//  corriente (de + a −); los electrones avanzan en sentido contrario.
// ═══════════════════════════════════════════════════════════════════
function receptorXs() {
    if (circuit.mode === 'ohm') return [620];
    if (circuit.n === 2) return circuit.mode === 'serie' ? [470, 730] : [500, 760];
    return [420, 610, 800];
}

function layout() {
    const mode = circuit.mode;
    const xs = receptorXs();
    const lay = { xs, wires: [], gaps: [], recs: [], sw: null };
    const top = [C_L, C_MID - BAT_GAP], bot = [C_L, C_MID + BAT_GAP];

    if (mode === 'ohm' || mode === 'serie') {
        const Rx = 900;
        lay.wires.push({ id: 'loop', I: sol.I, pts: [top, [C_L, C_T], [Rx, C_T], [Rx, C_B], [C_L, C_B], bot] });
        lay.sw = { x: 515, y: C_B };
        xs.forEach((x, k) => lay.recs.push({ k, x, y: C_T, vertical: false }));
        if (mode === 'ohm') lay.ammeter = { x: 340, y: C_T };
    } else {
        // Paralelo: raíles de arriba y de abajo, una rama vertical por receptor.
        const n = xs.length;
        const Ib = sol.elems.map(e => e.I);
        const after = (k) => Ib.slice(k).reduce((s, v) => s + v, 0);   // corriente del raíl a la derecha de la rama k−1
        lay.wires.push({ id: 'main-top', I: sol.I, pts: [top, [C_L, C_T], [xs[0], C_T]] });
        lay.wires.push({ id: 'main-bot', I: sol.I, pts: [[xs[0], C_B], [C_L, C_B], bot] });
        for (let k = 1; k < n; k++) {
            lay.wires.push({ id: 'rail-top' + k, I: after(k), pts: [[xs[k - 1], C_T], [xs[k], C_T]] });
            lay.wires.push({ id: 'rail-bot' + k, I: after(k), pts: [[xs[k], C_B], [xs[k - 1], C_B]] });
        }
        xs.forEach((x, k) => {
            lay.wires.push({ id: 'branch' + k, I: Ib[k], pts: [[x, C_T], [x, C_B]] });
            lay.recs.push({ k, x, y: C_MID, vertical: true });
        });
        lay.sw = { x: 275, y: C_B };
    }
    // Huecos sin cable: la pila, el interruptor abierto y los receptores quitados.
    lay.gaps.push({ x: C_L, y: C_MID, hw: 6, hh: BAT_GAP });
    if (!circuit.closed) lay.gaps.push({ x: lay.sw.x, y: lay.sw.y, hw: 22, hh: 6 });
    lay.recs.forEach(r => {
        r.present = sol.elems[r.k].present;
        if (!r.present) lay.gaps.push(r.vertical ? { x: r.x, y: r.y, hw: 6, hh: 34 } : { x: r.x, y: r.y, hw: 34, hh: 6 });
    });
    return lay;
}

function inGap(lay, x, y) {
    return lay.gaps.some(g => Math.abs(x - g.x) <= g.hw && Math.abs(y - g.y) <= g.hh);
}

function polyLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    return L;
}

function pointAt(pts, s) {
    for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const d = dist(x0, y0, x1, y1);
        if (s <= d) return [x0 + (x1 - x0) * s / d, y0 + (y1 - y0) * s / d];
        s -= d;
    }
    return pts[pts.length - 1];
}

// ═══════════════════════════════════════════════════════════════════
//  ESCENA
// ═══════════════════════════════════════════════════════════════════
function drawScene(dt) {
    fill(THEME.sceneBg);
    stroke(THEME.panelBorder);
    strokeWeight(1);
    rect(SCENE.x, SCENE.y, SCENE.w, SCENE.h, 8);

    const lay = layout();
    const titles = {
        ohm:      ['CIRCUITO CON UN RECEPTOR', 'amperímetro en serie y voltímetro en paralelo'],
        serie:    ['RECEPTORES EN SERIE', 'un solo camino para la corriente'],
        paralelo: ['RECEPTORES EN PARALELO', 'un camino para cada receptor'],
    }[circuit.mode];
    drawSceneTitle(i18n.t(titles[0]), i18n.t(titles[1]));

    // 1. Cables
    stroke(THEME.wire);
    strokeWeight(3);
    noFill();
    lay.wires.forEach(w => {
        beginShape();
        w.pts.forEach(p => vertex(p[0], p[1]));
        endShape();
    });
    // Los huecos se borran con el color de fondo
    stroke(THEME.sceneBg);
    strokeWeight(7);
    lay.gaps.forEach(g => {
        if (g.hw > g.hh) line(g.x - g.hw + 1, g.y, g.x + g.hw - 1, g.y);
        else line(g.x, g.y - g.hh + 1, g.x, g.y + g.hh - 1);
    });

    if (circuit.mode === 'ohm') drawVoltmeterWires(lay.recs[0]);

    // 2. Electrones
    lay.wires.forEach(w => {
        const v = Math.min(E_SPEED * w.I, E_VMAX);
        wirePhase[w.id] = ((wirePhase[w.id] || 0) - v * dt) % E_SPACING;
    });
    if (showElectrons) drawElectrons(lay);

    // 3. Componentes
    drawBattery();
    drawSwitch(lay.sw);
    lay.recs.forEach(r => drawReceptor(r));
    if (lay.ammeter) drawAmmeter(lay.ammeter);
    if (circuit.mode === 'ohm') drawVoltmeter(lay.recs[0]);

    // 4. Rótulos y sentido de la corriente
    lay.recs.forEach(r => drawReceptorLabels(r));
    drawCurrentArrows(lay);
    drawLegend();

    if (sol.open) {
        const msg = circuit.mode === 'paralelo' && circuit.closed
            ? i18n.t('Todas las ramas están abiertas: no circula corriente.')
            : i18n.t('Circuito abierto: no circula corriente (I = 0).');
        drawMessage(msg);
    } else if (circuit.V === 0) {
        drawMessage(i18n.t('La pila tiene 0 V: no impulsa a los electrones y no circula corriente.'));
    }
}

function drawSceneTitle(title, sub) {
    noStroke();
    fill(THEME.textDim);
    textSize(11);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    text(title, SCENE.x + 16, SCENE.y + 12);
    textStyle(NORMAL);
    fill(THEME.textFaint);
    textSize(10);
    text(sub, SCENE.x + 16, SCENE.y + 27);
}

function drawMessage(msg) {
    const w = 460, x = SCENE.x + SCENE.w - w - 150, y = SCENE.y + 12;
    textSize(12);
    textAlign(CENTER, CENTER);
    fill(THEME.msgBg);
    stroke(THEME.warn);
    strokeWeight(1.5);
    rect(x, y, w, 34, 8);
    noStroke();
    fill(THEME.warn);
    text(msg, x + 10, y + 1, w - 20, 32);
}

function drawElectrons(lay) {
    noStroke();
    lay.wires.forEach(w => {
        const L = polyLength(w.pts);
        let s = ((wirePhase[w.id] || 0) % E_SPACING + E_SPACING) % E_SPACING;
        for (; s < L; s += E_SPACING) {
            const [x, y] = pointAt(w.pts, s);
            if (inGap(lay, x, y)) continue;
            fill(THEME.electron);
            circle(x, y, 9);
            stroke(THEME.electronMark);
            strokeWeight(1.5);
            line(x - 2.2, y, x + 2.2, y);
            noStroke();
        }
    });
}

// ── Pila: placa larga (+) arriba y placa corta y gruesa (−) abajo ──
function drawBattery() {
    stroke(THEME.comp);
    strokeCap(SQUARE);
    strokeWeight(3);
    line(C_L - 24, C_MID - BAT_GAP, C_L + 24, C_MID - BAT_GAP);
    strokeWeight(7);
    line(C_L - 12, C_MID + BAT_GAP, C_L + 12, C_MID + BAT_GAP);
    strokeCap(ROUND);

    noStroke();
    fill(THEME.text);
    textSize(16);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('+', C_L + 30, C_MID - BAT_GAP - 9);
    text('−', C_L + 30, C_MID + BAT_GAP + 9);
    textAlign(RIGHT, CENTER);
    fill(THEME.v);
    textSize(15);
    text(`${fmt(circuit.V, 1)} V`, C_L - 32, C_MID - 2);
    textStyle(NORMAL);
    fill(THEME.textDim);
    textSize(10);
    text(i18n.t('pila'), C_L - 32, C_MID + 16);
}

// ── Interruptor: dos bornes y una palanca ──
function drawSwitch(sw) {
    const x0 = sw.x - 22, x1 = sw.x + 22;
    stroke(THEME.comp);
    strokeWeight(3);
    const ang = circuit.closed ? 0 : -0.55;
    line(x0, sw.y, x0 + 44 * Math.cos(ang), sw.y + 44 * Math.sin(ang));
    fill(THEME.sceneBg);
    strokeWeight(2);
    circle(x0, sw.y, 8);
    circle(x1, sw.y, 8);

    noStroke();
    fill(circuit.closed ? THEME.p : THEME.warn);
    textSize(10);
    textAlign(CENTER, TOP);
    text(i18n.t(circuit.closed ? 'interruptor cerrado' : 'interruptor abierto'), sw.x, sw.y + 14);
    if (!circuit.closed && sol.switchV) {
        fill(THEME.v);
        text(`V = ${fmtV(sol.switchV)} V`, sw.x, sw.y + 28);
    }
}

// ── Receptores: bombilla (círculo con aspa) o resistencia (rectángulo) ──
function drawReceptor(r) {
    const e = sol.elems[r.k];
    if (!r.present) {
        // Bornes vacíos y la silueta del receptor quitado
        stroke(THEME.textFaint);
        strokeWeight(1.5);
        drawingContext.setLineDash([4, 4]);
        noFill();
        if (receptorType === 'bombilla') circle(r.x, r.y, 44);
        else if (r.vertical) rect(r.x - 12, r.y - 32, 24, 64, 3);
        else rect(r.x - 32, r.y - 12, 64, 24, 3);
        drawingContext.setLineDash([]);
        stroke(THEME.comp);
        strokeWeight(2);
        fill(THEME.sceneBg);
        const d = 34;
        if (r.vertical) { circle(r.x, r.y - d, 8); circle(r.x, r.y + d, 8); }
        else            { circle(r.x - d, r.y, 8); circle(r.x + d, r.y, 8); }
        return;
    }

    const b = bulbBrightness(e.P);
    push();
    translate(r.x, r.y);
    if (r.vertical) rotate(HALF_PI);
    if (receptorType === 'bombilla') {
        // Halo
        noStroke();
        const [gr, gg, gb] = THEME.glow;
        for (let k = 5; k >= 1; k--) {
            fill(gr, gg, gb, 34 * b);
            circle(0, 0, 44 + k * 14 * b);
        }
        // Cables hasta el borde de la bombilla
        stroke(THEME.wire);
        strokeWeight(3);
        line(-34, 0, -22, 0);
        line(22, 0, 34, 0);
        // Ampolla
        stroke(THEME.comp);
        strokeWeight(2.5);
        fill(lerpColor(color(THEME.compFill), color(gr, gg, gb), b));
        circle(0, 0, 44);
        const c = 22 * Math.SQRT1_2;
        line(-c, -c, c, c);
        line(-c, c, c, -c);
    } else {
        stroke(THEME.wire);
        strokeWeight(3);
        line(-34, 0, -32, 0);
        line(32, 0, 34, 0);
        const [hr, hg, hb] = THEME.heat;
        stroke(THEME.comp);
        strokeWeight(2.5);
        fill(lerpColor(color(THEME.compFill), color(hr, hg, hb), 0.85 * b));
        rect(-32, -12, 64, 24, 3);
    }
    pop();
}

// Nombre y resistencia encima (o a la derecha); tensión, intensidad y potencia debajo.
function drawReceptorLabels(r) {
    const e = sol.elems[r.k];
    const name = elemName(r.k, circuit.mode);
    const sub = circuit.mode === 'ohm' ? '' : SUB[r.k];
    let x, y, align;
    if (r.vertical) { x = r.x + 36; y = r.y - 30; align = LEFT; }
    else            { x = r.x;      y = r.y + 34; align = CENTER; }

    noStroke();
    textAlign(align, TOP);
    textSize(13);
    textStyle(BOLD);
    fill(THEME.r);
    if (r.vertical) text(`${name} = ${fmtR(e.R)} Ω`, x, y);
    else {
        textAlign(CENTER, BASELINE);
        text(`${name} = ${fmtR(e.R)} Ω`, r.x, r.y - (receptorType === 'bombilla' && r.present ? 40 : 24));
        textAlign(align, TOP);
    }
    textStyle(NORMAL);
    textSize(11.5);
    const y0 = r.vertical ? y + 20 : y;
    if (!r.present) {
        fill(THEME.textFaint);
        text(i18n.t(receptorType === 'bombilla' ? 'bombilla quitada' : 'resistencia quitada'), x, y0);
        if (e.V != null && e.V > 0) {
            fill(THEME.v);
            text(`V${sub} = ${fmtV(e.V)} V`, x, y0 + 16);
        }
        return;
    }
    if (circuit.mode === 'ohm') return;   // en este modo miden los aparatos
    fill(THEME.v);
    text(`V${sub} = ${fmtV(e.V)} V`, x, y0);
    fill(THEME.i);
    text(`I${sub} = ${fmtI(e.I)} A`, x, y0 + 16);
    fill(THEME.p);
    text(`P${sub} = ${fmtP(e.P)} W`, x, y0 + 32);
}

// ── Aparatos de medida del modo ley de Ohm ──
function drawMeter(x, y, letter) {
    stroke(THEME.comp);
    strokeWeight(2.5);
    fill(THEME.compFill);
    circle(x, y, 44);
    noStroke();
    fill(THEME.text);
    textSize(20);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(letter, x, y + 1);
    textStyle(NORMAL);
}

function drawDisplay(x, y, value, col, caption) {
    const w = 120, h = 32;
    stroke(col);
    strokeWeight(1.5);
    fill(THEME.displayBg);
    rect(x - w / 2, y - h / 2, w, h, 6);
    noStroke();
    fill(THEME.displayText);
    textSize(17);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(value, x, y + 1);
    textStyle(NORMAL);
    fill(col);
    textSize(10);
    text(caption, x, y - h / 2 - 9);
}

function drawAmmeter(a) {
    drawMeter(a.x, a.y, 'A');
    drawDisplay(a.x, a.y + 72, `${fmtI(sol.I)} A`, THEME.i, i18n.t('amperímetro'));
}

const VM_DY = 135;   // distancia del voltímetro por debajo del receptor
function drawVoltmeterWires(r) {
    stroke(THEME.wire);
    strokeWeight(2);
    noFill();
    const y = r.y + VM_DY;
    beginShape(); vertex(r.x - 52, r.y); vertex(r.x - 52, y); vertex(r.x - 22, y); endShape();
    beginShape(); vertex(r.x + 52, r.y); vertex(r.x + 52, y); vertex(r.x + 22, y); endShape();
    fill(THEME.wire);
    noStroke();
    circle(r.x - 52, r.y, 7);
    circle(r.x + 52, r.y, 7);
}

function drawVoltmeter(r) {
    const y = r.y + VM_DY;
    drawMeter(r.x, y, 'V');
    drawDisplay(r.x + 140, y, `${fmtV(sol.elems[0].V)} V`, THEME.v, i18n.t('voltímetro'));
}

// ── Flechas del sentido convencional de la corriente ──
function arrowHead(x, y, dir, col) {
    push();
    translate(x, y);
    rotate(dir);
    noStroke();
    fill(col);
    triangle(9, 0, -6, -6.5, -6, 6.5);
    pop();
}

function drawCurrentArrows(lay) {
    if (sol.I <= 0) return;
    const col = THEME.arrow;
    arrowHead(C_L, C_T + 62, -HALF_PI, col);
    arrowHead(C_L + 70, C_T, 0, col);
    noStroke();
    fill(col);
    textSize(12);
    textStyle(BOLD);
    textAlign(LEFT, BASELINE);
    text(`I = ${fmtI(sol.I)} A`, C_L + 84, C_T - 10);
    textStyle(NORMAL);
    if (circuit.mode === 'paralelo') {
        lay.recs.forEach(r => { if (sol.elems[r.k].I > 0) arrowHead(r.x, C_T + 40, HALF_PI, col); });
    }
}

function drawLegend() {
    const x = SCENE.x + SCENE.w - 270, y = SCENE.y + SCENE.h - 34;
    noStroke();
    textSize(10);
    textAlign(LEFT, CENTER);
    arrowHead(x + 6, y, 0, THEME.arrow);
    fill(THEME.textFaint);
    text(i18n.t('sentido de la corriente (de + a −)'), x + 20, y);
    if (showElectrons) {
        fill(THEME.electron);
        circle(x + 6, y + 18, 9);
        fill(THEME.textFaint);
        text(i18n.t('electrones (se mueven de − a +)'), x + 20, y + 18);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  PANEL INFERIOR
// ═══════════════════════════════════════════════════════════════════
function drawBottomPanel() {
    if (circuit.mode === 'ohm') {
        drawIVGraph({ x: LOWER.x, y: LOWER.y, w: 640, h: LOWER.h });
        drawOhmBox({ x: LOWER.x + 656, y: LOWER.y, w: LOWER.w - 656, h: LOWER.h });
    } else {
        const w = (LOWER.w - 16) / 2;
        drawBarChart({ x: LOWER.x, y: LOWER.y, w, h: LOWER.h }, 'V');
        drawBarChart({ x: LOWER.x + w + 16, y: LOWER.y, w, h: LOWER.h }, 'I');
    }
}

function drawPanelBox(P, title) {
    fill(THEME.panelBg);
    stroke(THEME.panelBorder);
    strokeWeight(1);
    rect(P.x, P.y, P.w, P.h, 8);
    noStroke();
    fill(THEME.textDim);
    textSize(11);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    text(title, P.x + 14, P.y + 10);
    textStyle(NORMAL);
}

// Primer valor «redondo» (1, 2, 2,5 o 5 por una potencia de 10) mayor o igual que x.
function niceCeil(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x - 1e-9) return m * p;
    return 10 * p;
}

// ── Gráfica I–V del modo ley de Ohm ──
function drawIVGraph(G) {
    drawPanelBox(G, i18n.t('GRÁFICA INTENSIDAD – TENSIÓN'));

    // Una recta por cada resistencia medida, más la del receptor actual
    const Rlist = [];
    measurements.forEach(m => { if (!Rlist.includes(m.R)) Rlist.push(m.R); });
    if (!Rlist.includes(circuit.R)) Rlist.push(circuit.R);
    const colorOf = (R) => THEME.series[Rlist.indexOf(R) % THEME.series.length];

    const L = G.x + 62, R = G.x + G.w - 18, T = G.y + 36, B = G.y + G.h - 32;
    const Imax = niceCeil(Math.max(V_MAX / circuit.R, ...measurements.map(m => m.I), 0.01));
    const X = (v) => map(v, 0, V_MAX, L, R);
    const Y = (i) => map(i, 0, Imax, B, T);

    // Rejilla y ejes
    textSize(9.5);
    for (let v = 0; v <= V_MAX; v += 2) {
        stroke(THEME.grid);
        strokeWeight(1);
        line(X(v), T, X(v), B);
        noStroke();
        fill(THEME.textFaint);
        textAlign(CENTER, TOP);
        text(fmt(v, 0), X(v), B + 5);
    }
    const step = Imax / 5;
    const dI = step < 0.1 ? 3 : step < 1 ? 2 : 1;
    for (let k = 0; k <= 5; k++) {
        const i = k * step;
        stroke(THEME.grid);
        line(L, Y(i), R, Y(i));
        noStroke();
        fill(THEME.textFaint);
        textAlign(RIGHT, CENTER);
        text(fmt(i, dI), L - 6, Y(i));
    }
    textAlign(RIGHT, TOP);
    text(i18n.t('V (V)'), R, B + 17);
    textAlign(LEFT, TOP);
    text(i18n.t('I (A)'), L + 6, T + 3);

    // Rectas I = V / R
    Rlist.forEach(Rv => {
        const c = colorOf(Rv);
        stroke(c);
        strokeWeight(Rv === circuit.R ? 2.2 : 1.4);
        if (Rv === circuit.R) drawingContext.setLineDash([6, 5]);
        const vEnd = Math.min(V_MAX, Imax * Rv);
        line(X(0), Y(0), X(vEnd), Y(vEnd / Rv));
        drawingContext.setLineDash([]);
    });

    // Medidas anotadas
    measurements.forEach(m => {
        stroke(THEME.panelBg);
        strokeWeight(1.5);
        fill(colorOf(m.R));
        circle(X(m.V), Y(m.I), 10);
    });

    // Punto de funcionamiento actual
    const e = sol.elems[0];
    stroke(THEME.textFaint);
    strokeWeight(1);
    drawingContext.setLineDash([3, 4]);
    line(X(e.V), Y(e.I), X(e.V), B);
    line(X(e.V), Y(e.I), L, Y(e.I));
    drawingContext.setLineDash([]);
    noFill();
    stroke(THEME.text);
    strokeWeight(2);
    circle(X(e.V), Y(e.I), 15);

    // Leyenda
    textSize(10.5);
    let lx = R - Rlist.length * 92;
    Rlist.forEach(Rv => {
        stroke(colorOf(Rv));
        strokeWeight(3);
        line(lx, G.y + 17, lx + 16, G.y + 17);
        noStroke();
        fill(colorOf(Rv));
        textAlign(LEFT, CENTER);
        text(`R = ${fmtR(Rv)} Ω`, lx + 21, G.y + 17);
        lx += 92;
    });
}

// ── Cálculo con la ley de Ohm ──
function drawOhmBox(P) {
    drawPanelBox(P, i18n.t('LEY DE OHM'));
    const e = sol.elems[0];
    const x = P.x + 18;
    let y = P.y + 38;

    noStroke();
    fill(THEME.text);
    textSize(22);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    text('I = V / R', x, y);
    textStyle(NORMAL);
    y += 40;

    textSize(13);
    fill(THEME.i);
    text(`I = ${fmtV(e.V)} V / ${fmtR(e.R)} Ω = ${fmtI(e.I)} A`, x, y);
    y += 24;
    fill(THEME.p);
    text(`P = V · I = ${fmtP(e.P)} W`, x, y);
    y += 24;
    fill(THEME.r);
    text(i18n.t('pendiente = 1 / R = {s} A/V', { s: fmt(1 / e.R, 3) }), x, y);

    y += 32;
    fill(THEME.textFaint);
    textSize(10.5);
    text(i18n.t('Más tensión → más intensidad (proporcionales).'), x, y, P.w - 30);
    text(i18n.t('Más resistencia → menos intensidad.'), x, y + 16, P.w - 30);
}

// ── Diagramas de barras de tensiones e intensidades (serie y paralelo) ──
function drawBarChart(P, kind) {
    const isV = kind === 'V';
    const col = isV ? THEME.v : THEME.i;
    drawPanelBox(P, i18n.t(isV ? 'TENSIONES (V)' : 'INTENSIDADES (A)'));

    const elems = sol.elems;
    const total = isV ? sol.V : sol.I;
    const vmax = isV ? V_MAX : niceCeil(Math.max(total, 0.05));
    const L = P.x + 56, R = P.x + P.w - 16, T = P.y + 40, B = P.y + P.h - 34;
    const Y = (v) => map(v, 0, vmax, B, T);

    // Rejilla
    textSize(9.5);
    const nTicks = isV ? 6 : 5;
    const dec = isV ? 0 : (vmax / nTicks < 0.1 ? 2 : vmax / nTicks < 1 ? 1 : 0);
    for (let k = 0; k <= nTicks; k++) {
        const v = vmax * k / nTicks;
        stroke(THEME.grid);
        strokeWeight(1);
        line(L, Y(v), R, Y(v));
        noStroke();
        fill(THEME.textFaint);
        textAlign(RIGHT, CENTER);
        text(fmt(v, dec), L - 6, Y(v));
    }

    // Barras: una por receptor y la total (apilada cuando es una suma)
    const stacked = (isV && circuit.mode === 'serie') || (!isV && circuit.mode === 'paralelo');
    const nb = elems.length + 1;
    const slot = (R - L) / nb, bw = Math.min(56, slot * 0.55);

    // Un receptor quitado no conduce (I = 0), pero entre sus bornes puede haber tensión.
    const val = (e) => (isV ? e.V : e.I) || 0;
    const ghost = color(col);
    ghost.setAlpha(90);

    elems.forEach((e, k) => {
        const cx = L + slot * (k + 0.5);
        const v = val(e);
        noStroke();
        fill(e.present ? col : ghost);
        if (v > 0) rect(cx - bw / 2, Y(v), bw, B - Y(v), 3, 3, 0, 0);
        fill(THEME.textDim);
        textSize(12);
        textStyle(BOLD);
        textAlign(CENTER, TOP);
        text(`${kind}${SUB[k]}`, cx, B + 6);
        textStyle(NORMAL);
        textSize(10);
        textAlign(CENTER, BASELINE);
        fill(col);
        if (e.present || v > 0) text(isV ? fmtV(v) : fmtI(v), cx, Y(v) - 5);
        if (!e.present) {
            fill(THEME.textFaint);
            text(i18n.t('quitada'), cx, Y(v) - (v > 0 ? 18 : 5));
        }
    });

    // Barra total: apilada cuando es la suma de las de los receptores
    const cx = L + slot * (nb - 0.5);
    const sum = elems.reduce((acc, e) => acc + val(e), 0);
    if (stacked && sum > 0 && Math.abs(sum - total) < 1e-6) {
        let acc = 0;
        elems.forEach((e, k) => {
            const v = val(e);
            if (v <= 0) return;
            const y0 = Y(acc), y1 = Y(acc + v);
            fill(e.present ? col : ghost);
            stroke(THEME.panelBg);
            strokeWeight(2);
            rect(cx - bw / 2, y1, bw, y0 - y1);
            if (y0 - y1 > 15) {
                noStroke();
                fill(THEME.panelBg);
                textSize(10.5);
                textStyle(BOLD);
                textAlign(CENTER, CENTER);
                text(`${kind}${SUB[k]}`, cx, (y0 + y1) / 2);
                textStyle(NORMAL);
            }
            acc += v;
        });
    } else if (total > 0) {
        noStroke();
        fill(col);
        rect(cx - bw / 2, Y(total), bw, B - Y(total), 3, 3, 0, 0);
    }
    noStroke();
    fill(THEME.text);
    textSize(12);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text(i18n.t(isV ? 'pila' : 'total'), cx, B + 6);
    textStyle(NORMAL);
    textSize(10);
    fill(col);
    textAlign(CENTER, BASELINE);
    text(isV ? fmtV(total) : fmtI(total), cx, Y(total) - 5);

    // Línea del valor total
    stroke(THEME.textFaint);
    strokeWeight(1);
    drawingContext.setLineDash([4, 4]);
    line(L, Y(total), R, Y(total));
    drawingContext.setLineDash([]);

    // Regla que se cumple
    const rule = {
        'serie-V':    'V = V₁ + V₂ + V₃',
        'serie-I':    'I = I₁ = I₂ = I₃',
        'paralelo-V': 'V = V₁ = V₂ = V₃',
        'paralelo-I': 'I = I₁ + I₂ + I₃',
    }[circuit.mode + '-' + kind];
    noStroke();
    fill(THEME.textDim);
    textSize(11);
    textAlign(RIGHT, TOP);
    text(circuit.n === 2 ? rule.replace(/ [+=] [VI]₃/, '') : rule, R, P.y + 10);
}

// ═══════════════════════════════════════════════════════════════════
//  PULSAR EL INTERRUPTOR O UN RECEPTOR
// ═══════════════════════════════════════════════════════════════════
function hitTarget() {
    const lay = layout();
    if (Math.abs(mouseX - lay.sw.x) < 30 && Math.abs(mouseY - lay.sw.y) < 26) return { type: 'switch' };
    if (circuit.mode !== 'ohm') {
        for (const r of lay.recs) {
            if (Math.abs(mouseX - r.x) < 36 && Math.abs(mouseY - r.y) < 36) return { type: 'rec', k: r.k };
        }
    }
    return null;
}

function updateCursor() {
    cursor(hitTarget() ? HAND : ARROW);
}

function mousePressed() {
    const hit = hitTarget();
    if (!hit) return;
    if (hit.type === 'switch') setSwitch(!circuit.closed);
    else toggleReceptor(hit.k);
    return false;
}

// ═══════════════════════════════════════════════════════════════════
//  PANEL HTML
// ═══════════════════════════════════════════════════════════════════
function updatePanel() {
    const mode = circuit.mode;
    select('#metric-v').html(fmt(sol.V, 1));
    select('#metric-i').html(fmtI(sol.I));
    select('#metric-r').html(fmtR(sol.Req));

    // Tabla de receptores
    let rows = '';
    sol.elems.forEach((e, k) => {
        let name = elemName(k, mode);
        if (!e.present) name = i18n.t('{n} (quitada)', { n: name });
        rows += `<tr class="${e.present ? '' : 'removed'}"><td>${name}</td><td>${fmtR(e.R)}</td>` +
                `<td>${fmtV(e.V)}</td><td>${fmtI(e.I)}</td><td>${fmtP(e.P)}</td></tr>`;
    });
    if (mode !== 'ohm') {
        rows += `<tr class="total"><td>${i18n.t('Total')}</td><td>${fmtR(sol.Req)}</td>` +
                `<td>${fmtV(sol.V)}</td><td>${fmtI(sol.I)}</td><td>${fmtP(sol.P)}</td></tr>`;
    }
    select('#elem-table').html(rows);
    select('#circuit-note').html(circuitNote());

    // Tabla de medidas (ley de Ohm)
    let mrows = '';
    measurements.forEach((m, k) => {
        mrows += `<tr><td>${k + 1}</td><td>${fmtR(m.R)}</td><td>${fmtV(m.V)}</td><td>${fmtI(m.I)}</td>` +
                 `<td>${m.I > 0 ? fmtR(m.V / m.I) : '—'}</td></tr>`;
    });
    if (!mrows) mrows = `<tr><td colspan="5" class="empty">${i18n.t('Pulsa «＋ Anotar medida» para añadir filas.')}</td></tr>`;
    select('#meas-table').html(mrows);
}

function circuitNote() {
    const mode = circuit.mode;
    const sum = (key, f) => sol.elems.filter(e => e.present).map(e => f(e[key])).join(' + ');
    if (mode === 'ohm') {
        if (!circuit.closed) return i18n.t('Con el interruptor abierto no circula corriente: I = 0 y el voltímetro marca 0 V.');
        if (sol.V === 0) return i18n.t('Con 0 V no circula corriente: I = 0.');
        return i18n.t('V / I = {v} V / {i} A = <b>{r} Ω</b>. El cociente es la resistencia: no cambia al variar la tensión.',
                      { v: fmtV(sol.V), i: fmtI(sol.I), r: fmtR(sol.V / sol.I) });
    }
    if (mode === 'serie') {
        if (sol.open) {
            if (!circuit.closed && sol.elems.every(e => e.present)) return i18n.t('Con el interruptor abierto no circula corriente por ningún receptor.');
            return i18n.t('Al quitar un receptor en serie se corta el único camino: no circula corriente por ninguno.');
        }
        if (sol.V === 0) return i18n.t('Con 0 V no circula corriente: I = 0.');
        return i18n.t('En serie la intensidad es la misma en todos (<b>{i} A</b>) y las tensiones suman la de la pila: {s} = <b>{v} V</b>.',
                      { i: fmtI(sol.I), s: sum('V', fmtV), v: fmtV(sol.V) });
    }
    if (!circuit.closed) return i18n.t('Con el interruptor abierto no circula corriente por ningún receptor.');
    if (sol.open) return i18n.t('Todas las ramas están abiertas: no circula corriente.');
    if (sol.V === 0) return i18n.t('Con 0 V no circula corriente: I = 0.');
    const removed = sol.elems.some(e => !e.present);
    const base = i18n.t('En paralelo todos tienen la tensión de la pila (<b>{v} V</b>) y las intensidades suman la total: {s} = <b>{i} A</b>.',
                        { v: fmtV(sol.V), s: sum('I', fmtI), i: fmtI(sol.I) });
    return removed ? base + ' ' + i18n.t('La rama sin receptor no conduce, pero las demás siguen funcionando igual.') : base;
}
