/*
 * Süzgeç — UYAP Doküman Formatı (.udf) işleyici
 * UDF, içinde content.xml bulunan bir ZIP arşividir. Belge metni tek bir CDATA bölümünde,
 * biçimlendirme ise bu metne başlangıç ofseti (startOffset) ve uzunluk (length) ile
 * atıf yapan öğelerde tutulur. Etiketleme metin uzunluğunu değiştirdiğinden, tüm ofsetler
 * yeniden hesaplanır.
 */
(function (root) {
  'use strict';

  function icerikOgesi(doc) {
    var kok = doc.documentElement;
    for (var n = kok.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && n.nodeName === 'content') return n;
    }
    return null;
  }

  async function oku(arrayBuffer) {
    var zip;
    try { zip = await JSZip.loadAsync(arrayBuffer); }
    catch (e) { throw new Error('UDF dosyası açılamadı (ZIP yapısı okunamadı).'); }
    var ad = Object.keys(zip.files).find(function (n) { return /(^|\/)content\.xml$/i.test(n); });
    if (!ad) throw new Error('UDF içinde content.xml bulunamadı.');
    var str = await zip.file(ad).async('string');
    var doc = new DOMParser().parseFromString(str, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('UDF içeriği (content.xml) okunamadı.');
    var icerik = icerikOgesi(doc);
    if (!icerik) throw new Error('UDF içinde metin bölümü (content) bulunamadı.');
    var uyarilar = [];
    if (doc.getElementsByTagName('image').length) uyarilar.push('Belgede görsel bulunmaktadır. Görsellerdeki kişisel veriler otomatik olarak temizlenemez; lütfen elle kontrol ediniz.');
    if (Object.keys(zip.files).some(function (n) { return /sign|imza/i.test(n); })) uyarilar.push('Belge e-imza bilgisi içeriyor olabilir; temizleme sonrasında imza geçerliliğini yitirecektir.');
    return { tur: 'udf', zip: zip, ad: ad, doc: doc, icerik: icerik, metin: icerik.textContent, uyarilar: uyarilar };
  }

  async function yaz(belge, bulgular, mod, secenek) {
    var C = root.Suzgec.core;
    var sonuc = C.metneUygula(belge.metin, bulgular, mod);
    var esle = C.konumEsle(sonuc.degisiklik);
    var doc = belge.doc;

    // Ofsetleri yeniden hesapla
    var tumu = doc.getElementsByTagName('*');
    for (var i = 0; i < tumu.length; i++) {
      var el = tumu[i];
      if (!el.hasAttribute('startOffset')) continue;
      var s = parseInt(el.getAttribute('startOffset'), 10);
      if (isNaN(s)) continue;
      var ys = esle(s);
      el.setAttribute('startOffset', String(ys));
      if (el.hasAttribute('length')) {
        var l = parseInt(el.getAttribute('length'), 10);
        if (!isNaN(l)) el.setAttribute('length', String(Math.max(0, esle(s + l) - ys)));
      }
    }
    // Değiştirilen yerleri kırmızı yazıyla işaretle: ilgili biçim öğeleri değişiklik sınırlarından bölünür
    if (secenek && secenek.isaretle && sonuc.degisiklik.length) {
      var yeniAraliklar = [], kayma = 0;
      sonuc.degisiklik.forEach(function (d) {
        var bas = d.start + kayma;
        yeniAraliklar.push([bas, bas + d.yeni.length]);
        kayma += d.yeni.length - (d.end - d.start);
      });
      var KIRMIZI = String(((0xFF << 24) | (0xC8 << 16) | (0x10 << 8) | 0x2E) | 0);
      var icerikOgeleri = Array.prototype.slice.call(doc.getElementsByTagName('content')).filter(function (e) { return e !== belge.icerik && e.hasAttribute('startOffset'); });
      icerikOgeleri.forEach(function (e) {
        var s0 = parseInt(e.getAttribute('startOffset'), 10), l0 = parseInt(e.getAttribute('length'), 10) || 0, e0 = s0 + l0;
        var kesisen = yeniAraliklar.filter(function (a) { return a[0] < e0 && a[1] > s0; });
        if (!kesisen.length) return;
        var parcalar = [], p = s0;
        kesisen.forEach(function (a) {
          var as = Math.max(a[0], s0), ae = Math.min(a[1], e0);
          if (as > p) parcalar.push([p, as, false]);
          parcalar.push([as, ae, true]);
          p = ae;
        });
        if (p < e0) parcalar.push([p, e0, false]);
        parcalar.forEach(function (pr) {
          var k = e.cloneNode(false);
          k.setAttribute('startOffset', String(pr[0]));
          k.setAttribute('length', String(pr[1] - pr[0]));
          if (pr[2]) { k.setAttribute('foreground', KIRMIZI); k.setAttribute('bold', 'true'); }
          e.parentNode.insertBefore(k, e);
        });
        e.parentNode.removeChild(e);
      });
    }
    // Metni yaz
    var icerik = belge.icerik;
    while (icerik.firstChild) icerik.removeChild(icerik.firstChild);
    icerik.appendChild(doc.createCDATASection(sonuc.metin.split(']]>').join(']] >')));

    var s2 = new XMLSerializer().serializeToString(doc);
    if (s2.indexOf('<?xml') !== 0) s2 = '<?xml version="1.0" encoding="UTF-8" ?>\n' + s2;
    belge.zip.file(belge.ad, s2);
    return belge.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  root.Suzgec = root.Suzgec || {};
  root.Suzgec.udf = { oku: oku, yaz: yaz, uzanti: 'udf', mime: 'application/octet-stream' };
})(typeof self !== 'undefined' ? self : this);
