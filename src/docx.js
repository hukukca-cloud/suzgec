/*
 * Süzgeç — Word (.docx) işleyici
 * Belge gövdesi, üst/alt bilgiler, dipnotlar, son notlar ve yorumlar taranır;
 * izlenen değişikliklerdeki silinmiş metin de kapsama dahildir.
 * Yazar, son değiştiren, şirket gibi üst veriler ve ilk sayfa küçük resmi temizlenir.
 */
(function (root) {
  'use strict';
  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var XMLNS = 'http://www.w3.org/XML/1998/namespace';
  var METIN_PARCALARI = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments(Extended)?)\.xml$/;

  function xmlOku(str) {
    var doc = new DOMParser().parseFromString(str, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML okunamadı');
    return doc;
  }
  function xmlYaz(doc) {
    var s = new XMLSerializer().serializeToString(doc);
    if (s.indexOf('<?xml') !== 0) s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + s;
    return s;
  }

  // Bir öğenin en yakın w:p atasını bulur (metin kutularındaki iç içe paragraflar için)
  function paragrafi(el) {
    var n = el.parentNode;
    while (n && !(n.namespaceURI === W && n.localName === 'p')) n = n.parentNode;
    return n;
  }

  function haritaKur(doc, harita) {
    // Belge sırasıyla: metin, sekme, satır sonu ve paragraf sınırları
    var tumu = doc.getElementsByTagNameNS(W, '*');
    var oncekiP = null;
    for (var i = 0; i < tumu.length; i++) {
      var el = tumu[i], ad = el.localName;
      if (ad !== 't' && ad !== 'delText' && ad !== 'instrText' && ad !== 'tab' && ad !== 'br' && ad !== 'cr') continue;
      var p = paragrafi(el);
      if (p !== oncekiP) { if (oncekiP !== null) harita.ayirici('\n'); oncekiP = p; }
      if (ad === 'tab') harita.ayirici('\t');
      else if (ad === 'br' || ad === 'cr') harita.ayirici('\n');
      else if (ad === 'instrText') { harita.ayirici('\n'); harita.ekle(el); harita.ayirici('\n'); }
      else harita.ekle(el);
    }
    harita.ayirici('\n\n');
  }

  async function oku(arrayBuffer) {
    var zip = await JSZip.loadAsync(arrayBuffer);
    if (!zip.file('word/document.xml')) throw new Error('Geçerli bir Word (.docx) dosyası değil.');
    var parcalar = [];
    var harita = new root.Suzgec.MetinHaritasi();
    var adlar = Object.keys(zip.files).filter(function (n) { return METIN_PARCALARI.test(n); });
    // Gövde önce gelsin
    adlar.sort(function (a, b) { return (a === 'word/document.xml' ? -1 : 0) - (b === 'word/document.xml' ? -1 : 0) || a.localeCompare(b); });
    for (var i = 0; i < adlar.length; i++) {
      var doc = xmlOku(await zip.file(adlar[i]).async('string'));
      haritaKur(doc, harita);
      parcalar.push({ ad: adlar[i], doc: doc });
    }
    var uyarilar = [];
    var medya = Object.keys(zip.files).filter(function (n) { return /^word\/media\//.test(n); });
    if (medya.length) uyarilar.push('Belgede ' + medya.length + ' görsel bulunmaktadır. Görsellerin içindeki kişisel veriler (ör. taranmış kimlik, imza) otomatik olarak temizlenemez; lütfen elle kontrol ediniz.');
    var imza = Object.keys(zip.files).some(function (n) { return /^_xmlsignatures\//.test(n); });
    if (imza) uyarilar.push('Belge dijital imza içermektedir; temizleme sonrasında imza geçerliliğini yitirecektir.');
    return { tur: 'docx', zip: zip, parcalar: parcalar, harita: harita, metin: harita.bitir(), uyarilar: uyarilar };
  }

  function korunanBosluk(el) {
    if (el.localName === 't' || el.localName === 'delText' || el.localName === 'instrText') el.setAttributeNS(XMLNS, 'xml:space', 'preserve');
  }

  function ustVeriTemizle(doc) {
    // Yazar bilgisi taşıyan öznitelikler (izlenen değişiklikler, yorumlar)
    var tumu = doc.getElementsByTagName('*');
    for (var i = 0; i < tumu.length; i++) {
      var el = tumu[i];
      if (el.hasAttributeNS(W, 'author')) el.setAttributeNS(W, 'w:author', 'Süzgeç');
      if (el.hasAttributeNS(W, 'initials')) el.setAttributeNS(W, 'w:initials', 'S');
    }
  }

  function wEl(doc, ad, oz) {
    var e = doc.createElementNS(W, 'w:' + ad);
    if (oz) Object.keys(oz).forEach(function (k) { e.setAttributeNS(W, 'w:' + k, oz[k]); });
    return e;
  }

  // Değiştirilen metni ayrı bir "run"a alıp kırmızı zemin ve kenarlıkla işaretler.
  // İzlenen değişiklik (w:del) kullanılmaz; çünkü o yöntem silinen kişisel veriyi dosyada saklar.
  function isaretleyiciYap(mod) {
    return function (el, bolutler) {
      if (!bolutler || el.localName !== 't' || !bolutler.some(function (b) { return b.degisti; })) { korunanBosluk(el); return false; }
      var run = el.parentNode;
      if (!run || run.localName !== 'r') return false;
      var doc = el.ownerDocument;
      var rPr = null;
      for (var c = run.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.localName === 'rPr') { rPr = c; break; }
      // w:t'den sonra gelen kardeşler (sekme, satır sonu vb.) son bir run'a taşınır
      var sonrakiler = [];
      for (var n = el.nextSibling; n; n = n.nextSibling) sonrakiler.push(n);
      el.textContent = '';
      korunanBosluk(el);
      var ref = run;
      function yeniRun(metin, degisti) {
        var r = doc.createElementNS(W, 'w:r');
        var p = rPr ? rPr.cloneNode(true) : wEl(doc, 'rPr');
        if (degisti) {
          ['shd', 'highlight', 'color', 'bdr'].forEach(function (ad) {
            Array.prototype.slice.call(p.childNodes).forEach(function (x) { if (x.nodeType === 1 && x.localName === ad) p.removeChild(x); });
          });
          if (mod === 'etiket') { p.appendChild(wEl(doc, 'b')); p.appendChild(wEl(doc, 'color', { val: 'C8102E' })); }
          p.appendChild(wEl(doc, 'bdr', { val: 'single', sz: '4', space: '0', color: 'C8102E' }));
          p.appendChild(wEl(doc, 'shd', { val: 'clear', color: 'auto', fill: mod === 'etiket' ? 'FDE7EA' : 'F6C4CC' }));
        }
        if (p.childNodes.length) r.appendChild(p);
        if (metin !== null) { var t = wEl(doc, 't'); t.textContent = metin; korunanBosluk(t); r.appendChild(t); }
        run.parentNode.insertBefore(r, ref.nextSibling);
        ref = r;
        return r;
      }
      bolutler.forEach(function (b) { if (b.metin) yeniRun(b.metin, b.degisti); });
      if (sonrakiler.length) {
        var son = yeniRun(null, false);
        sonrakiler.forEach(function (x) { son.appendChild(x); });
      }
      return true;
    };
  }

  async function yaz(belge, bulgular, mod, secenek) {
    secenek = secenek || {};
    var C = root.Suzgec.core;
    var zip = belge.zip;
    belge.harita.uygula(bulgular, function (b) { return C.yerineKonacak(b, mod); }, secenek.isaretle ? isaretleyiciYap(mod) : korunanBosluk);
    belge.parcalar.forEach(function (p) {
      ustVeriTemizle(p.doc);
      zip.file(p.ad, xmlYaz(p.doc));
    });

    // Belge özellikleri
    var core = zip.file('docProps/core.xml');
    if (core) {
      var cd = xmlOku(await core.async('string'));
      ['creator', 'lastModifiedBy', 'lastPrinted'].forEach(function (ad) {
        var l = cd.getElementsByTagName('*');
        for (var i = 0; i < l.length; i++) if (l[i].localName === ad) l[i].textContent = (ad === 'lastPrinted') ? '' : 'Süzgeç';
      });
      zip.file('docProps/core.xml', xmlYaz(cd));
    }
    var app = zip.file('docProps/app.xml');
    if (app) {
      var ad2 = xmlOku(await app.async('string'));
      var l2 = ad2.getElementsByTagName('*');
      for (var j = 0; j < l2.length; j++) if (l2[j].localName === 'Company' || l2[j].localName === 'Manager') l2[j].textContent = '';
      zip.file('docProps/app.xml', xmlYaz(ad2));
    }
    // Kişi listesi (yorum yazarlarının e-posta/kimlik bilgileri)
    var people = zip.file('word/people.xml');
    if (people) {
      var pd = xmlOku(await people.async('string'));
      var kok = pd.documentElement;
      while (kok.firstChild) kok.removeChild(kok.firstChild);
      zip.file('word/people.xml', xmlYaz(pd));
    }
    // İlk sayfanın küçük resmi (kişisel veri içerebilir)
    var kucukResimler = Object.keys(zip.files).filter(function (n) { return /^docProps\/thumbnail\./i.test(n); });
    if (kucukResimler.length) {
      kucukResimler.forEach(function (n) { zip.remove(n); });
      var rels = zip.file('_rels/.rels');
      if (rels) {
        var rd = xmlOku(await rels.async('string'));
        var rl = Array.prototype.slice.call(rd.getElementsByTagName('Relationship'));
        rl.forEach(function (r) { if (/thumbnail/i.test(r.getAttribute('Type') || '') || /thumbnail/i.test(r.getAttribute('Target') || '')) r.parentNode.removeChild(r); });
        zip.file('_rels/.rels', xmlYaz(rd));
      }
      var ct = zip.file('[Content_Types].xml');
      if (ct) {
        var cdoc = xmlOku(await ct.async('string'));
        var ov = Array.prototype.slice.call(cdoc.getElementsByTagName('Override'));
        ov.forEach(function (o) { if (/thumbnail/i.test(o.getAttribute('PartName') || '')) o.parentNode.removeChild(o); });
        zip.file('[Content_Types].xml', xmlYaz(cdoc));
      }
    }
    // Dış bağlantılar: e-posta ve telefon bağlantıları ile kişisel veri içeren adresler
    var seciliMetinler = bulgular.filter(function (b) { return b.secili; }).map(function (b) { return C.trKucuk(b.text.replace(/\s+/g, '')); });
    var relDosyalari = Object.keys(zip.files).filter(function (n) { return /^word\/_rels\/.*\.rels$/.test(n); });
    for (var k = 0; k < relDosyalari.length; k++) {
      var rdoc = xmlOku(await zip.file(relDosyalari[k]).async('string'));
      var degisti = false;
      Array.prototype.forEach.call(rdoc.getElementsByTagName('Relationship'), function (r) {
        if (r.getAttribute('TargetMode') !== 'External') return;
        var hedef = r.getAttribute('Target') || '', coz;
        try { coz = decodeURIComponent(hedef); } catch (e) { coz = hedef; }
        var kh = C.trKucuk(coz.replace(/\s+/g, ''));
        if (/^(mailto|tel|sms):/i.test(hedef) || seciliMetinler.some(function (m) { return m.length >= 4 && kh.indexOf(m) >= 0; })) {
          r.setAttribute('Target', '#'); degisti = true;
        }
      });
      if (degisti) zip.file(relDosyalari[k], xmlYaz(rdoc));
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  root.Suzgec = root.Suzgec || {};
  root.Suzgec.docx = { oku: oku, yaz: yaz, uzanti: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
})(typeof self !== 'undefined' ? self : this);
