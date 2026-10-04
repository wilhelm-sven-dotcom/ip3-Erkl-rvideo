import { el, Lines, kicker, fadeEl, prog, ease, C } from './base.js';

// Texteinblendungen (eine Hauptaussage pro Szene). Linke Spalte: x 112 bis 652.
// Die untere Bildzone (y > 920) bleibt für Untertitel frei.

const X = 112, COL = 548;

const H = [
  // Szene 1: Hook über dem Luftbild
  { in: 2.45, out: 4.85, lines: ['Sonne da.', 'Leistung weg.'], size: 92, y: 382 },
  { in: 5.0, out: 8.75, lines: ['Wer regelt', 'Ihren Solarpark?'], size: 92, y: 382 },
  // Szene 2
  { in: 15.75, out: 22.55, kicker: 'Datenerfassung', lines: ['Alle relevanten', 'Betriebsdaten.', 'Ein Überblick.'], size: 58, y: 360 },
  // Szene 3
  { in: 23.0, out: 37.35, kicker: 'Regelung', lines: ['Abregelungen', 'erkennen.', 'Ursachen', 'nachvollziehen.'], size: 58, y: 330 },
  // Szene 4
  { in: 38.0, out: 47.7, kicker: 'Ertrag', kout: 52.45, lines: ['Was hätte', 'Ihre Anlage', 'erzeugen können?'], size: 58, y: 330 },
  { in: 48.05, out: 52.45, lines: ['Entgangene', 'Energie', 'nachvollziehbar', 'berechnen.'], size: 58, y: 330 },
  // Szene 5: Kernaussage baut sich zeilenweise auf
  { in: 52.95, out: 64.95, kicker: 'Abrechnung', lines: ['Abrechnungen', 'prüfen.', 'Abweichungen', 'erkennen.', 'Nachweise', 'bereitstellen.'],
    ins: [52.95, 53.04, 59.4, 59.49, 61.25, 61.34], size: 54, y: 270,
    sub: { in: 61.9, out: 64.95, text: '<span style="font-size:18px;color:rgba(232,231,239,.78)">Ob ein Ausgleich zusteht, hängt vom Abregelungsgrund, den geltenden Regelungen und den Verträgen ab.</span>' } },
  // Szene 6a
  { in: 65.55, out: 70.55, kicker: 'Betriebsführung', lines: ['Technische', 'Betriebsführung.'], size: 58, y: 340,
    sub: { in: 66.2, out: 70.45, text: 'Stammdaten, Unterlagen und Betriebsinformationen an einem Ort.' },
    sub2: { in: 69.5, out: 70.45, text: 'Persönlich betreut durch ip³.' } },
  // Szene 6b: über dem Luftbild
  { in: 71.6, out: 80.05, kicker: 'Beratung', lines: ['Vermarktung', 'bewerten.', 'Speicherpotenzial', 'prüfen.'], ins: [71.6, 71.69, 76.0, 76.09], size: 64, y: 300,
    sub: { in: 78.55, out: 79.95, text: 'Individuelle Wirtschaftlichkeitsprüfung.' } },
];

export class Headlines {
  constructor(root) {
    this.root = el('div', 'abs', root);
    Object.assign(this.root.style, { inset: '0' });
    this.items = H.map((h) => {
      const k = h.kicker ? kicker(this.root, h.kicker, { x: X, y: h.y - 44 }) : null;
      const lines = new Lines(this.root, h.lines, { x: X, y: h.y, size: h.size, width: COL + 200 });
      const mk = (s) => {
        if (!s) return null;
        const e = el('div', 'abs', this.root, s.text);
        Object.assign(e.style, { left: X + 'px', width: COL - 20 + 'px', fontFamily: 'var(--head)', fontWeight: 400, fontSize: '23px', lineHeight: 1.45, color: C.hell });
        return e;
      };
      return { h, k, lines, sub: mk(h.sub), sub2: mk(h.sub2) };
    });
  }

  // nach dem ersten Layout: Untertexte unter die Headline setzen
  layout() {
    for (const it of this.items) {
      const hgt = it.lines.root.getBoundingClientRect().height || it.h.lines.length * it.h.size * 1.06;
      let y = it.h.y + hgt + 26;
      if (it.sub) { it.sub.style.top = y + 'px'; y += it.sub.getBoundingClientRect().height + 14; }
      if (it.sub2) { it.sub2.style.top = y + 'px'; }
    }
  }

  update(t) {
    for (const it of this.items) {
      const h = it.h;
      it.lines.update(t, h.in, h.out, { ins: h.ins });
      if (it.k) fadeEl(it.k, t, h.in - 0.1, h.kout || h.out, 0.45, 0.4, 10);
      if (it.sub) fadeEl(it.sub, t, h.sub.in, h.sub.out, 0.5, 0.35, 12);
      if (it.sub2) fadeEl(it.sub2, t, h.sub2.in, h.sub2.out, 0.5, 0.35, 12);
    }
  }
}
