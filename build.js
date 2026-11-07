#!/usr/bin/env node
/*
 * Süzgeç — derleme betiği
 * Tüm kaynakları ve üçüncü taraf kütüphaneleri tek bir, ağ bağlantısı gerektirmeyen
 * HTML dosyasında birleştirir: dist/suzgec.html
 * Kullanım: npm install && node build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const kok = __dirname;
const paket = require('./package.json');
const oku = (p) => fs.readFileSync(path.join(kok, p), 'utf8');

const betikler = [
  ['JSZip ' + require('./node_modules/jszip/package.json').version + ' (MIT)', 'node_modules/jszip/dist/jszip.min.js'],
  ['pdf.js ' + require('./node_modules/pdfjs-dist/package.json').version + ' (Apache-2.0)', 'node_modules/pdfjs-dist/build/pdf.min.js'],
  ['pdf.js worker — ana iş parçacığında çalışır (Apache-2.0)', 'node_modules/pdfjs-dist/build/pdf.worker.min.js'],
  ['Süzgeç: ad sözlüğü', 'src/adlar.js'],
  ['Süzgeç: tespit motoru', 'src/core.js'],
  ['Süzgeç: metin haritası', 'src/metin-haritasi.js'],
  ['Süzgeç: Word işleyici', 'src/docx.js'],
  ['Süzgeç: UDF işleyici', 'src/udf.js'],
  ['Süzgeç: PDF işleyici', 'src/pdf.js'],
  ['Süzgeç: Word üretici', 'src/word-uret.js'],
  ['Süzgeç: arayüz', 'src/ui.js']
];

function guvenli(js, ad) {
  // Satır içi <script> içinde betiği erken kapatabilecek diziler kaçırılır
  let s = js.replace(/<\/script/gi, '<\\/script');
  if (s.includes('<!--')) throw new Error(ad + ': <!-- dizisi içeriyor; elle incelenmeli');
  if (/<\/script/i.test(s)) throw new Error(ad + ': kaçırılamayan </script dizisi');
  return s;
}

let bolumler = betikler.map(([ad, dosya]) => `<!-- ${ad} -->\n<script>\n${guvenli(oku(dosya), dosya)}\n</script>`);

// İmza: assets/imza.json (ad, kullanıcı adı, bağlantı) ve isteğe bağlı assets/logo.(png|jpg|webp) hesap logosu.
// Logo, dış kaynak yüklenmemesi için data URI olarak gömülür; yoksa yerleşik terazi simgesi kullanılır.
const imzaAyar = Object.assign({ ad: 'IsThisLegal', alt: '@isthis_legal', baglanti: 'https://x.com/isthis_legal' },
  fs.existsSync(path.join(kok, 'assets/imza.json')) ? JSON.parse(oku('assets/imza.json')) : {});
const logoDosya = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp'].map(f => path.join(kok, 'assets', f)).find(f => fs.existsSync(f));
const htmlKac = (x) => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let fotoHtml = '<svg viewBox="0 0 24 24" width="58%" height="58%" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 3v17M7 20h10M5 7h14M12 5.5l0 0M5 7l-3 6a3 3 0 0 0 6 0L5 7zm14 0-3 6a3 3 0 0 0 6 0l-3-6z"/></svg>';
if (logoDosya) {
  const uz = path.extname(logoDosya).slice(1).replace('jpg', 'jpeg');
  fotoHtml = `<img alt="" src="data:image/${uz};base64,${fs.readFileSync(logoDosya).toString('base64')}">`;
}
const onay = '<svg class="onay" viewBox="0 0 24 24" aria-label="doğrulanmış"><path fill="currentColor" d="M22.5 12.5c0-1.58-.88-2.95-2.18-3.65.15-.44.23-.91.23-1.4 0-2.21-1.71-4-3.82-4-.47 0-.92.08-1.34.25C14.81 2.48 13.5 1.5 12 1.5s-2.8.98-3.38 2.19c-.42-.17-.88-.25-1.34-.25-2.11 0-3.82 1.79-3.82 4 0 .49.08.96.22 1.4C2.38 9.55 1.5 10.92 1.5 12.5c0 1.5.8 2.8 1.97 3.53-.03.21-.04.43-.04.64 0 2.21 1.71 4 3.82 4 .47 0 .92-.08 1.34-.25.58 1.21 1.88 2.08 3.41 2.08s2.83-.87 3.41-2.08c.42.17.87.25 1.34.25 2.11 0 3.82-1.79 3.82-4 0-.21-.01-.43-.04-.64 1.17-.73 1.97-2.03 1.97-3.53z"/><path fill="#fff" d="M10.54 16.2 6.8 12.46l1.41-1.41 2.33 2.33 5.26-5.26 1.41 1.41z"/></svg>';
const imza = (buyuk) => `<a class="imza${buyuk ? ' buyuk' : ''}" href="${htmlKac(imzaAyar.baglanti)}" target="_blank" rel="noopener noreferrer" title="${htmlKac(imzaAyar.ad)} hesabını X'te aç"><span class="foto">${fotoHtml}</span><span class="ad"><strong>${htmlKac(imzaAyar.ad)}${onay}</strong><small>${htmlKac(imzaAyar.alt)}</small></span></a>`;

let html = oku('src/sablon.html')
  .replace('__SURUM__', paket.version)
  .replace('__IMZA_KUCUK__', () => imza(false))
  .replace('__IMZA_BUYUK__', () => imza(true))
  .replace('__SCRIPTS__', () => bolumler.join('\n'));

// Ağ çağrısı yapabilecek kalıpların yalnızca kütüphane kodunda bulunduğunu doğrulamak için uygulama kodu denetimi
for (const [, dosya] of betikler.filter(([, d]) => d.startsWith('src/'))) {
  const kod = oku(dosya);
  for (const yasak of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'importScripts', 'navigator.sendBeacon', '.src = ', 'new Image']) {
    if (kod.includes(yasak)) throw new Error(`${dosya} yasak ifade içeriyor: ${yasak}`);
  }
}

fs.mkdirSync(path.join(kok, 'dist'), { recursive: true });
const hedef = path.join(kok, 'dist', 'suzgec.html');
fs.writeFileSync(hedef, html);
const ozet = crypto.createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(kok, 'dist', 'suzgec.html.sha256'), `${ozet}  suzgec.html\n`);
console.log(`dist/suzgec.html oluşturuldu (${(html.length / 1048576).toFixed(2)} MB)\nSHA-256: ${ozet}`);
