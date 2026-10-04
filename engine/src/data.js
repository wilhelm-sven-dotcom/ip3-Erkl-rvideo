// Beispieldaten. Alle Zahlen im Film stammen aus diesem Modul und sind als Beispieldaten
// gekennzeichnet. Sie beschreiben einen fiktiven Freiflächenpark, keinen realen Kunden.

export const PARK = {
  name: 'Beispielpark',
  typ: 'Freifläche',
  kWp: 9800,              // installierte Leistung DC
  pAV: 8.5,               // vereinbarte Anschlusswirkleistung in MW (für Vorgabe in %)
  neigung: 20,
  ausrichtung: 'Süd',
  inbetriebnahme: '2021',
};

const T_RISE = 5.45, T_SET = 20.95;           // Beispieltag Mitte Mai, Uhrzeit MESZ
const G_MAX = 985;                             // W/m² in Modulebene
const PR = 0.84;

export const EVENTS = [
  { id: 'dv', akteur: 'Direktvermarkter', prozess: 'Vermarktungsbedingte Abregelung', von: 11.5, bis: 14.0, vorgabe: 0 },
  { id: 'rd', akteur: 'Netzbetreiber', prozess: 'Redispatch-Maßnahme', von: 15.0, bis: 17.0, vorgabe: 30 },
];

export function sunShape(h) {
  const x = (h - T_RISE) / (T_SET - T_RISE);
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(Math.sin(Math.PI * x), 1.25);
}
// leichte, deterministische Bewölkungsfreiheit-Schwankung, damit Kurven nicht synthetisch wirken
function wobble(h) { return 1 + 0.006 * Math.sin(h * 9.1) + 0.004 * Math.sin(h * 23.7 + 1.3); }

export const irr = (h) => G_MAX * sunShape(h) * wobble(h);                 // W/m²
export const pMoeglich = (h) => (PARK.kWp / 1000) * (irr(h) / 1000) * PR;  // MW, berechnet
export function vorgabe(h) {                                                // % der pAV
  for (const e of EVENTS) if (h >= e.von && h < e.bis) return e.vorgabe;
  return 100;
}
export function aktiverEingriff(h) {
  for (const e of EVENTS) if (h >= e.von && h < e.bis) return e;
  return null;
}
export const pIst = (h) => Math.min(pMoeglich(h), (vorgabe(h) / 100) * PARK.pAV); // MW

// Energie numerisch integrieren (MWh)
function integrate(f, a, b, n = 4000) {
  let s = 0; const dh = (b - a) / n;
  for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * dh) * dh;
  return s;
}
export const E_MOEGLICH = integrate(pMoeglich, 4, 22);
export const E_IST = integrate(pIst, 4, 22);
export const E_DV = integrate((h) => pMoeglich(h) - pIst(h), EVENTS[0].von, EVENTS[0].bis);
export const E_RD = integrate((h) => pMoeglich(h) - pIst(h), EVENTS[1].von, EVENTS[1].bis);
export const E_ENTGANGEN = E_DV + E_RD;

// Monatswerte für die Abrechnungsprüfung (Beispieldaten, Mai 2026)
export const MONAT = {
  label: 'Mai 2026',
  dv: { position: 'Direktvermarktung', quelle: 'Direktvermarkter', abgerechnet: '1.284,6 MWh', geprueft: '1.284,6 MWh', ok: true },
  mp: { position: 'Marktprämie', quelle: 'Netzbetreiber', abgerechnet: '21.838,20 €', geprueft: '21.838,20 €', ok: true },
  ae: { position: 'Ausfallenergie', quelle: 'Netzbetreiber', abgerechnet: '31,2 MWh', geprueft: '35,7 MWh', ok: false, abweichung: '4,5 MWh' },
};

// Stundenachse der Diagramme
export const H0 = 5, H1 = 21;
