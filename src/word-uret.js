/*
 * Süzgeç — Temizlenmiş metinden Word (.docx) üretimi
 * PDF ve UDF belgelerinin Word olarak indirilmesinde kullanılır. Yalnızca temizlenmiş metin
 * yazılır; görseller, üst veriler ve gizli içerikler yeni dosyaya taşınmaz.
 */
(function (root) {
  'use strict';

  function xmlKac(s) {
    return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function run(metin, degisti, mod, isaretle) {
    var rpr = '';
    if (degisti && isaretle) {
      rpr = '<w:rPr>' + (mod === 'etiket' ? '<w:b/><w:color w:val="C8102E"/>' : '') +
        '<w:bdr w:val="single" w:sz="4" w:space="0" w:color="C8102E"/>' +
        '<w:shd w:val="clear" w:color="auto" w:fill="' + (mod === 'etiket' ? 'FDE7EA' : 'F6C4CC') + '"/></w:rPr>';
    }
    // Sekmeleri ayrı öğe olarak yaz
    return metin.split('\t').map(function (p, i) {
      return (i ? '<w:r>' + rpr + '<w:tab/></w:r>' : '') + (p ? '<w:r>' + rpr + '<w:t xml:space="preserve">' + xmlKac(p) + '</w:t></w:r>' : '');
    }).join('');
  }

  /**
   * @param {string} metin  temizlenmiş metin
   * @param {Array} araliklar  temizlenmiş metinde değiştirilen [başlangıç, bitiş] aralıkları
   * @param {object} secenek  { mod, isaretle, baslik }
   */
  function uret(metin, araliklar, secenek) {
    secenek = secenek || {};
    // Uzunluğu değiştirmeyen normalleştirme: aralık konumları geçerliliğini korur
    metin = metin.replace(/\r/g, ' ').replace(/\f/g, '\n');
    var paragraflar = [], konum = 0, bosSayisi = 0;
    metin.split('\n').forEach(function (satir) {
      var bas = konum, son = konum + satir.length;
      if (!satir.trim()) { konum = son + 1; if (++bosSayisi > 1) return; } else bosSayisi = 0;
      var parcalar = [], p = bas;
      araliklar.forEach(function (a) {
        if (a[1] <= bas || a[0] >= son) return;
        var as = Math.max(a[0], bas), ae = Math.min(a[1], son);
        if (as > p) parcalar.push([metin.slice(p, as), false]);
        parcalar.push([metin.slice(as, ae), true]);
        p = ae;
      });
      if (p < son) parcalar.push([metin.slice(p, son), false]);
      paragraflar.push('<w:p>' + parcalar.map(function (x) { return run(x[0], x[1], secenek.mod, secenek.isaretle); }).join('') + '</w:p>');
      konum = son + 1;
    });

    var W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    var belge = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ' + W + '><w:body>' + paragraflar.join('') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>';
    var stiller = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    var zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/document.xml', belge);
    zip.file('word/styles.xml', stiller);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  /** Bir belgenin metnini, seçili bulguları uygulayarak Word dosyasına dönüştürür. */
  function belgedenUret(metin, bulgular, mod, isaretle) {
    var C = root.Suzgec.core;
    // Çakışan bulgular birleştirilir; böylece hiçbir karakter açıkta kalmaz
    var secili = bulgular.filter(function (b) { return b.secili; }).slice().sort(function (a, b) { return a.start - b.start; });
    var birlesik = [];
    secili.forEach(function (b) {
      var son = birlesik[birlesik.length - 1];
      if (son && b.start < son.end) { son.end = Math.max(son.end, b.end); return; }
      birlesik.push({ start: b.start, end: b.end, secili: true, etiket: b.etiket, kat: b.kat });
    });
    var sonuc = C.metneUygula(metin, birlesik, mod);
    var araliklar = [], kayma = 0;
    sonuc.degisiklik.forEach(function (d) {
      var bas = d.start + kayma;
      araliklar.push([bas, bas + d.yeni.length]);
      kayma += d.yeni.length - (d.end - d.start);
    });
    return uret(sonuc.metin, araliklar, { mod: mod, isaretle: isaretle });
  }

  root.Suzgec = root.Suzgec || {};
  root.Suzgec.wordUret = { uret: uret, belgedenUret: belgedenUret };
})(typeof self !== 'undefined' ? self : this);
