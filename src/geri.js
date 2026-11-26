/*!
 * Süzgeç — Geri yerleştirme
 * Tutarlı etiketleme ile temizlenen bir metne (ya da o metne dayanarak yapay zekanın ürettiği cevaba)
 * eşleme tablosundaki özgün ifadeleri geri koyar. Türkçe hâl eklerini yeni kelimeye göre uyumlar.
 * Ağ bağlantısı kullanmaz; her şey tarayıcının belleğinde olur.
 */
(function (root) {
  'use strict';

  // Süzgeç'in kullandığı etiket adları (core.js KATEGORILER ile aynı)
  var ETIKETLER = ['KARARTMA', 'ÖZEL', 'IBAN', 'TCKN', 'E-POSTA', 'VKN', 'TELEFON', 'PLAKA', 'DOĞUM-TARİHİ', 'DOSYA-NO', 'ADRES', 'KİŞİ'];

  function trKucuk(s) { return String(s).replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase(); }
  function sade(s) {
    return trKucuk(s).replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/̇/g, '').toUpperCase();
  }
  var KANONIK = Object.create(null);
  ETIKETLER.forEach(function (e) { KANONIK[sade(e)] = e; });

  // Her harf için büyük/küçük ve Türkçe karakterli/karaktersiz yazımı kabul eden desen
  var HARF = { 'İ': '[İiIı]', 'I': '[IıİiI]', 'Ş': '[ŞşSs]', 'Ğ': '[ĞğGg]', 'Ü': '[ÜüUu]', 'Ö': '[ÖöOo]', 'Ç': '[ÇçCc]' };
  function desenYaz(e) {
    return e.split('').map(function (c) {
      if (HARF[c]) return HARF[c];
      if (c === '-') return '\\s*[-‐–]\\s*';
      if (/[A-Z]/.test(c)) return '[' + c + c.toLowerCase() + ']';
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
  }
  var ETIKET_RE_KAYNAK = '\\[\\s*(' + ETIKETLER.slice().sort(function (a, b) { return b.length - a.length; }).map(desenYaz).join('|') +
    ')\\s*[-‐–]\\s*(\\d{1,4})\\s*\\]|(?<![\\p{L}\\d])(' + ETIKETLER.slice().sort(function (a, b) { return b.length - a.length; }).map(desenYaz).join('|') +
    ')[-‐–](\\d{1,4})(?![\\d])';

  function etiketAnahtari(ad, no) { return '[' + (KANONIK[sade(ad)] || sade(ad)) + '-' + parseInt(no, 10) + ']'; }

  /* ---------- Eşleme tablosu (CSV) ---------- */

  function csvSatirlari(metin) {
    metin = String(metin).replace(/^﻿/, '');
    var satirlar = [], satir = [], alan = '', tirnak = false, ayrac = null;
    for (var i = 0; i < metin.length; i++) {
      var c = metin[i];
      if (tirnak) {
        if (c === '"') { if (metin[i + 1] === '"') { alan += '"'; i++; } else tirnak = false; }
        else alan += c;
        continue;
      }
      if (c === '"') { tirnak = true; continue; }
      if (ayrac === null && (c === ';' || c === ',' || c === '\t')) ayrac = c;
      if (c === ayrac) { satir.push(alan); alan = ''; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && metin[i + 1] === '\n') i++;
        satir.push(alan); alan = '';
        if (satir.some(function (x) { return x.trim(); })) satirlar.push(satir);
        satir = [];
        continue;
      }
      alan += c;
    }
    satir.push(alan);
    if (satir.some(function (x) { return x.trim(); })) satirlar.push(satir);
    return satirlar;
  }

  /** Eşleme tablosunu okur: { '[KİŞİ-1]': { ifade, kategori }, ... } */
  function eslemeOku(metin) {
    var harita = Object.create(null), sayi = 0;
    csvSatirlari(metin).forEach(function (s) {
      if (s.length < 3) return;
      var m = /^\s*\[?\s*([^\]\-–‐]+(?:-[^\]\-–‐\d]+)*)\s*[-‐–]\s*(\d+)\s*\]?\s*$/.exec(s[0]);
      if (!m) return;
      var anahtar = etiketAnahtari(m[1].trim(), m[2]);
      var ifade = s[2].replace(/\s+/g, ' ').trim();
      if (!ifade) return;
      // Aynı etiketin birden çok yazımı varsa en uzun olanı esas alınır (ör. ad ve soyadı birlikte)
      if (!harita[anahtar]) { harita[anahtar] = { ifade: ifade, kategori: s[1].trim() }; sayi++; }
      else if (ifade.length > harita[anahtar].ifade.length) harita[anahtar].ifade = ifade;
    });
    return { harita: harita, sayi: sayi };
  }

  /* ---------- Türkçe hâl ekleri ---------- */

  var UNLU = 'aeıioöuü', KALIN = 'aıou', SERT = 'fstkçşhp';
  var DORTLU = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' };
  var EKLER = [
    ['bulunma-ki', /^[dt][ae]ki$/], ['ayrilma', /^[dt][ae]n$/], ['bulunma', /^[dt][ae]$/],
    ['ilgi', /^n?[ıiuü]n$/], ['vasita', /^y?l[ae]$/], ['yonelme', /^y?[ae]$/], ['belirtme', /^y?[ıiuü]$/]
  ];

  /** Kelimenin sonuna göre hâl ekini yeniden kurar. Tanınmayan ekleri olduğu gibi bırakır. */
  function ekUyumla(kelime, ek) {
    var k = trKucuk(String(kelime).trim());
    if (!/[a-zçğıöşü]$/.test(k)) return ek; // rakam, kısaltma sonu vb.: ek değiştirilmez
    var son = k.split(/\s+/).pop();
    var unluler = son.replace(new RegExp('[^' + UNLU + ']', 'g'), '');
    if (!unluler) return ek;
    var v = unluler[unluler.length - 1];
    var sonHarf = son[son.length - 1];
    var unluyleBiter = UNLU.indexOf(sonHarf) >= 0, sert = SERT.indexOf(sonHarf) >= 0;
    var iki = KALIN.indexOf(v) >= 0 ? 'a' : 'e', dort = DORTLU[v];
    var kucukEk = trKucuk(ek), tur = null;
    for (var i = 0; i < EKLER.length; i++) if (EKLER[i][1].test(kucukEk)) { tur = EKLER[i][0]; break; }
    if (!tur) return ek;
    var yeni;
    switch (tur) {
      case 'yonelme': yeni = (unluyleBiter ? 'y' : '') + iki; break;
      case 'belirtme': yeni = (unluyleBiter ? 'y' : '') + dort; break;
      case 'ilgi': yeni = (unluyleBiter ? 'n' : '') + dort + 'n'; break;
      case 'bulunma': yeni = (sert ? 't' : 'd') + iki; break;
      case 'ayrilma': yeni = (sert ? 't' : 'd') + iki + 'n'; break;
      case 'bulunma-ki': yeni = (sert ? 't' : 'd') + iki + 'ki'; break;
      case 'vasita': yeni = (unluyleBiter ? 'y' : '') + 'l' + iki; break;
    }
    // Özgün ekin büyük harf kullanımını koru
    return ek === ek.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(ek) ? yeni.toLocaleUpperCase('tr') : yeni;
  }

  /* ---------- Geri yerleştirme ---------- */

  /**
   * Metindeki etiketleri eşleme tablosuna göre özgün ifadelerle değiştirir.
   * Dönüş: { metin, parcalar: [{ tur: 'metin'|'yerlesti'|'bilinmeyen', ... }], sayac }
   */
  function geriYerlestir(metin, harita) {
    var re = new RegExp(ETIKET_RE_KAYNAK, 'gu');
    var parcalar = [], cikti = '', son = 0, m;
    var sayac = { yerlesti: 0, ekDuzeltildi: 0, bilinmeyen: 0, farkliEtiket: Object.create(null) };
    while ((m = re.exec(metin))) {
      var bas = m.index, bitis = bas + m[0].length;
      var ad = m[1] || m[3], no = m[2] || m[4];
      var anahtar = etiketAnahtari(ad, no);
      // Etiketten sonraki ek: kesme işaretli ('ye, ’nin) ya da doğrudan bitişik (ye, nin)
      var ekM = /^(['’])?([a-zçğıöşüA-ZÇĞİÖŞÜ]{1,5})(?![a-zçğıöşüA-ZÇĞİÖŞÜ])/.exec(metin.slice(bitis));
      var ek = null, kesme = "'";
      if (ekM && (ekM[1] || EKLER.some(function (x) { return x[1].test(trKucuk(ekM[2])); }))) {
        ek = ekM[2]; kesme = ekM[1] || "'"; bitis += ekM[0].length;
      }
      if (bas > son) { parcalar.push({ tur: 'metin', metin: metin.slice(son, bas) }); cikti += metin.slice(son, bas); }
      var kayit = harita[anahtar];
      if (!kayit) {
        var ham = metin.slice(bas, bitis);
        parcalar.push({ tur: 'bilinmeyen', metin: ham, etiket: anahtar });
        cikti += ham; sayac.bilinmeyen++;
      } else {
        var yeniEk = ek ? ekUyumla(kayit.ifade, ek) : null;
        var yeni = kayit.ifade + (ek ? kesme + yeniEk : '');
        var ekDegisti = !!(ek && yeniEk !== ek);
        parcalar.push({ tur: 'yerlesti', metin: yeni, etiket: anahtar, eski: metin.slice(bas, bitis), ekDegisti: ekDegisti });
        cikti += yeni; sayac.yerlesti++;
        if (ekDegisti) sayac.ekDuzeltildi++;
        sayac.farkliEtiket[anahtar] = true;
      }
      son = bitis;
      re.lastIndex = bitis;
    }
    if (son < metin.length) { parcalar.push({ tur: 'metin', metin: metin.slice(son) }); cikti += metin.slice(son); }
    sayac.farkli = Object.keys(sayac.farkliEtiket).length;
    delete sayac.farkliEtiket;
    return { metin: cikti, parcalar: parcalar, sayac: sayac };
  }

  var api = { eslemeOku: eslemeOku, geriYerlestir: geriYerlestir, ekUyumla: ekUyumla, csvSatirlari: csvSatirlari };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Suzgec = root.Suzgec || {}; root.Suzgec.geri = api; }
})(typeof self !== 'undefined' ? self : this);
