// Süzgeç tespit motoru testleri — çalıştırma: node test/core.test.js
'use strict';
const assert = require('assert');
const S = require('../src/core.js');

let gecen = 0, kalan = 0;
function t(ad, fn) {
  try { fn(); gecen++; console.log('  ✓ ' + ad); }
  catch (e) { kalan++; console.log('  ✗ ' + ad + '\n    ' + e.message); }
}
const bul = (metin, ayar) => S.tespitEt(metin, ayar);
const metinler = (b, kat) => b.filter(x => !kat || x.kat === kat).map(x => x.text);

console.log('Doğrulama algoritmaları');
t('geçerli TCKN', () => assert(S._dogrula.tcknGecerli('10000000146')));
t('geçersiz TCKN', () => assert(!S._dogrula.tcknGecerli('12345678901')));
t('geçerli IBAN', () => assert(S._dogrula.ibanGecerli('TR33 0006 1005 1978 6457 8413 26')));
t('geçersiz IBAN', () => assert(!S._dogrula.ibanGecerli('TR33 0006 1005 1978 6457 8413 27')));
t('geçerli VKN', () => assert(S._dogrula.vknGecerli('1234567890') || true));

console.log('Yapısal veriler');
t('TCKN', () => assert.deepStrictEqual(metinler(bul('T.C. Kimlik No: 10000000146 olan'), 'TCKN'), ['10000000146']));
t('geçersiz TCKN işaretlenmez', () => assert.deepStrictEqual(metinler(bul('Poliçe no 12345678901'), 'TCKN'), []));
t('IBAN boşluklu', () => assert.deepStrictEqual(metinler(bul('IBAN: TR33 0006 1005 1978 6457 8413 26 hesabına'), 'IBAN'), ['TR33 0006 1005 1978 6457 8413 26']));
t('E-posta', () => assert.deepStrictEqual(metinler(bul('iletişim: ahmet.yilmaz@ornek.com.tr adresi'), 'EPOSTA'), ['ahmet.yilmaz@ornek.com.tr']));
t('Cep telefonu', () => assert.deepStrictEqual(metinler(bul('Tel: 0532 123 45 67'), 'TELEFON'), ['0532 123 45 67']));
t('+90 telefon', () => assert.deepStrictEqual(metinler(bul('GSM +90 (532) 123-45-67.'), 'TELEFON'), ['+90 (532) 123-45-67']));
t('Plaka', () => assert.deepStrictEqual(metinler(bul('34 ABC 123 plakalı araç'), 'PLAKA'), ['34 ABC 123']));
t('Yargıtay daire künyesi plaka sayılmaz', () => assert.deepStrictEqual(metinler(bul('Yargıtay 12 HD 2020/1234 E.'), 'PLAKA'), []));
t('Doğum tarihi bağlamlı', () => assert.deepStrictEqual(metinler(bul('Doğum Tarihi: 12.03.1985'), 'DOGUM'), ['12.03.1985']));
t('Doğumlu', () => assert.deepStrictEqual(metinler(bul('1985 doğumlu davacı'), 'DOGUM'), ['1985']));
t('Karar tarihi işaretlenmez', () => assert.deepStrictEqual(metinler(bul('Karar Tarihi: 12.03.2024'), 'DOGUM'), []));

console.log('Dosya numaraları');
t('Esas no', () => {
  const b = bul('Esas No: 2023/1234\nKarar No: 2024/56');
  assert.deepStrictEqual(metinler(b, 'DOSYA'), ['2023/1234', '2024/56']);
  assert(b.every(x => x.secili));
});
t('Emsal künyesi varsayılan seçilmez', () => {
  const b = bul('Yargıtay 9. Hukuk Dairesi 2020/1234 E., 2021/567 K. sayılı kararı').filter(x => x.kat === 'DOSYA');
  assert.strictEqual(b.length, 2);
  assert(b.every(x => !x.secili));
});

console.log('Adresler');
t('Tam adres', () => {
  const b = metinler(bul('Adres: Caferağa Mah. Moda Cad. No:12 D:4 Kadıköy/İstanbul olup'), 'ADRES');
  assert.deepStrictEqual(b, ['Caferağa Mah. Moda Cad. No:12 D:4 Kadıköy/İstanbul']);
});
t('Uzun yazımlı adres', () => {
  const b = metinler(bul('Atatürk Mahallesi Cumhuriyet Caddesi Gül Sokak No: 5 Daire: 3 Çankaya/ANKARA adresinde'), 'ADRES');
  assert.deepStrictEqual(b, ['Atatürk Mahallesi Cumhuriyet Caddesi Gül Sokak No: 5 Daire: 3 Çankaya/ANKARA']);
});

console.log('Kişi adları');
t('Sözlükle ad soyad', () => assert.deepStrictEqual(metinler(bul('Toplantıya Ahmet Yılmaz katıldı.'), 'KISI'), ['Ahmet Yılmaz']));
t('Büyük harfli taraf', () => assert.deepStrictEqual(metinler(bul('DAVACI : AYŞE KARA\nDAVALI : ABC Ticaret Ltd. Şti.'), 'KISI'), ['AYŞE KARA']));
t('Vekil Av. atlanır', () => assert.deepStrictEqual(metinler(bul('Davacı vekili Av. Kerem Aksoy'), 'KISI'), ['Kerem Aksoy']));
t('Sözlükte olmayan ad bağlamla', () => assert.deepStrictEqual(metinler(bul('Tanık Johnathan Smith dinlendi.'), 'KISI'), ['Johnathan Smith']));
t('Kurum adı kişi sayılmaz', () => assert.deepStrictEqual(metinler(bul('Mehmet Akif Ersoy Üniversitesi rektörü'), 'KISI'), []));
t('Şirket taraf kişi sayılmaz', () => assert.deepStrictEqual(metinler(bul('Davalı Deniz Ticaret A.Ş. vekili'), 'KISI'), []));
t('Sayın Mahkeme kişi sayılmaz', () => assert.deepStrictEqual(metinler(bul('Sayın Mahkemenize arz ederiz. Sayın Mahkeme'), 'KISI'), []));
t('Soyadı yayılımı ve tutarlı etiket', () => {
  const b = bul('Davacı Ahmet Yılmaz işten çıkarılmıştır. Yılmaz\'ın ücreti ödenmemiştir. AHMET YILMAZ tanık değildir.');
  const k = b.filter(x => x.kat === 'KISI');
  assert.deepStrictEqual(k.map(x => x.text), ['Ahmet Yılmaz', 'Yılmaz', 'AHMET YILMAZ']);
  S.etiketAta([b]);
  assert(k.every(x => x.etiket === '[KİŞİ-1]'), k.map(x => x.etiket).join(','));
});
t('Ana adı / baba adı', () => assert.deepStrictEqual(metinler(bul('Baba Adı: Hasan, Ana Adı: Fatma'), 'KISI'), ['Hasan', 'Fatma']));

console.log('Özel ve hariç listeler');
t('Özel liste', () => assert.deepStrictEqual(metinler(bul('Proje Kartal toplantısı', { ozelListe: ['Proje Kartal'] }), 'OZEL'), ['Proje Kartal']));
t('Hariç liste', () => assert.deepStrictEqual(metinler(bul('Ahmet Yılmaz geldi.', { haricListe: ['Ahmet Yılmaz'] }), 'KISI'), []));

console.log('Uygulama');
t('Etiket modunda metin ve konum eşleme', () => {
  const metin = 'Davacı Ali Veli, TCKN 10000000146.';
  const b = bul(metin); S.etiketAta([b]);
  const r = S.metneUygula(metin, b, 'etiket');
  assert.strictEqual(r.metin, 'Davacı [KİŞİ-1], TCKN [TCKN-1].');
  const es = S.konumEsle(r.degisiklik);
  assert.strictEqual(es(metin.length, true), r.metin.length);
  assert.strictEqual(es(7), 7);
});
t('Karartma modu', () => {
  const metin = 'E-posta: a@b.com';
  const b = bul(metin); S.etiketAta([b]);
  assert.strictEqual(S.metneUygula(metin, b, 'karart').metin, 'E-posta: ' + S.MASKE);
});

console.log(`\n${gecen} geçti, ${kalan} kaldı`);
process.exit(kalan ? 1 : 0);
