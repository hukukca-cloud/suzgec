// Geri yerleştirme testleri — çalıştırma: node test/geri.test.js
'use strict';
const assert = require('assert');
const G = require('../src/geri.js');
let gecen = 0, kalan = 0;
function t(ad, fn) { try { fn(); gecen++; console.log('  ✓ ' + ad); } catch (e) { kalan++; console.log('  ✗ ' + ad + '\n    ' + e.message); } }

const CSV = '﻿"[KİŞİ-1]";"Kişi adı";"Ayşe Yılmaz";"dilekce.docx"\r\n"[KİŞİ-2]";"Kişi adı";"Mehmet Demir";"dilekce.docx"\r\n"[KİŞİ-3]";"Kişi adı";"Ali Koç";"dilekce.docx"\r\n"[TCKN-1]";"T.C. Kimlik No";"10000000146";"dilekce.docx"\r\n"[ADRES-1]";"Adres";"Atatürk Mah. 5. Sok. No: 3 Kadıköy";"dilekce.docx"';
const { harita, sayi } = G.eslemeOku(CSV);

console.log('Eşleme tablosu');
t('5 etiket okunur', () => assert.strictEqual(sayi, 5));
t('KİŞİ-1 → Ayşe Yılmaz', () => assert.strictEqual(harita['[KİŞİ-1]'].ifade, 'Ayşe Yılmaz'));
t('virgüllü CSV de okunur', () => assert.strictEqual(G.eslemeOku('[KİŞİ-1],Kişi adı,Ayşe Yılmaz,a.docx').harita['[KİŞİ-1]'].ifade, 'Ayşe Yılmaz'));

const g = (m) => G.geriYerlestir(m, harita);
console.log('Yerleştirme');
t('düz etiket', () => assert.strictEqual(g('Davacı [KİŞİ-1] dava açtı.').metin, 'Davacı Ayşe Yılmaz dava açtı.'));
t('aynı etiket iki kez', () => assert.strictEqual(g('[KİŞİ-1] ve yine [KİŞİ-1]').sayac.yerlesti, 2));
t('küçük harf ve köşeli parantezsiz yazım', () => assert.strictEqual(g('Kişi-2 tanıktır, [kisi-3] de.').metin, 'Mehmet Demir tanıktır, Ali Koç de.'));
t('TCKN', () => assert.strictEqual(g('T.C. no: [TCKN-1].').metin, 'T.C. no: 10000000146.'));
t('bilinmeyen etiket korunur ve sayılır', () => { const r = g('[KİŞİ-7] ile görüşüldü'); assert.strictEqual(r.metin, '[KİŞİ-7] ile görüşüldü'); assert.strictEqual(r.sayac.bilinmeyen, 1); });
t('karartma maskesine dokunulmaz', () => assert.strictEqual(g('Ad: █████').metin, 'Ad: █████'));

console.log('Hâl ekleri');
t("yönelme: [KİŞİ-2]'ye → Demir'e", () => assert.strictEqual(g("[KİŞİ-2]'ye ödeme yapıldı").metin, "Mehmet Demir'e ödeme yapıldı"));
t("ilgi: [KİŞİ-1]'nin → Yılmaz'ın", () => assert.strictEqual(g("[KİŞİ-1]'nin beyanı").metin, "Ayşe Yılmaz'ın beyanı"));
t("ilgi: [KİŞİ-3]'nin → Koç'un", () => assert.strictEqual(g("[KİŞİ-3]'nin tanıklığı").metin, "Ali Koç'un tanıklığı"));
t("bulunma: [KİŞİ-3]'de → Koç'ta", () => assert.strictEqual(g("dosya [KİŞİ-3]'de").metin, "dosya Ali Koç'ta"));
t("ayrılma: [KİŞİ-2]'den → Demir'den", () => assert.strictEqual(g("[KİŞİ-2]'den alındı").metin, "Mehmet Demir'den alındı"));
t("belirtme: [KİŞİ-1]'yi → Yılmaz'ı", () => assert.strictEqual(g("[KİŞİ-1]'yi aradı").metin, "Ayşe Yılmaz'ı aradı"));
t("vasıta: [KİŞİ-3]'yle → Koç'la", () => assert.strictEqual(g("[KİŞİ-3]'yle konuştu").metin, "Ali Koç'la konuştu"));
t("kesme işaretsiz ek: [KİŞİ-2]nin → Demir'in", () => assert.strictEqual(g("[KİŞİ-2]nin iddiası").metin, "Mehmet Demir'in iddiası"));
t("’ tipografik kesme korunur", () => assert.strictEqual(g("[KİŞİ-2]’ye").metin, "Mehmet Demir’e"));
t("rakamla biten ifadede ek değişmez", () => assert.strictEqual(g("[TCKN-1]'in").metin, "10000000146'in"));
t("ek düzeltmesi sayılır", () => assert.strictEqual(g("[KİŞİ-2]'ye ve [KİŞİ-1]'in").sayac.ekDuzeltildi, 2));
t("ekUyumla: Ayşe + ye", () => assert.strictEqual(G.ekUyumla('Ayşe', 'a'), 'ye'));

console.log('\n' + gecen + ' geçti, ' + kalan + ' kaldı');
process.exit(kalan ? 1 : 0);
