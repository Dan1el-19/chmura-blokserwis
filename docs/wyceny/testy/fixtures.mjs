const products = [
  ['Monitor 24” Xiaomi', 'Podgląd obrazu z kamer', 399],
  ['Kamera IP KG-6430TAS-IL', '6 MPX · obiektyw 2,8 mm', 779],
  ['Puszka montażowa KW-100W-V2', 'Mocowanie kamery', 72],
  ['Szafa RACK GETFORT 19” 12U', '600 × 450 mm', 569],
  ['Robocizna i konfiguracja', 'Montaż oraz uruchomienie systemu', 500],
];
export const scopes = [
  ['System monitoringu', 'Monitor Xiaomi i kamera IP służą do podglądu obrazu z systemu monitoringu. Kamera ma rozdzielczość 6 MPX i obiektyw 2,8 mm.'],
  ['Montaż i infrastruktura', 'Wycena obejmuje puszkę montażową do kamery oraz szafę RACK 19” 12U o wymiarach 600 × 450 mm.'],
  ['Uruchomienie', 'Zakres obejmuje robociznę związaną z montażem oraz konfigurację systemu.'],
];
export function data(count, options = {}) {
  return {
    title: options.title ?? 'Monitoring Piotrkowska 44',
    items: Array.from({ length: count }, (_, i) => {
      const [name, desc, price] = products[i % products.length];
      return { name: options.long ? `${name} - dostawa i montaż w budynku administracyjnym przy ul. Piotrkowskiej 44, klatka A, kondygnacja druga` : name,
        desc, price: options.large ? 9876543.20 : price, qty: options.large ? 1234.5 : 1 };
    }),
    scopes: options.scope ?? scopes,
  };
}
