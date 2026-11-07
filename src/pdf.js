/*
 * Süzgeç — PDF işleyici
 * PDF metni pdf.js ile okunur; bulunan ifadelerin sayfadaki konumları hesaplanır.
 * Çıktı, her sayfanın görüntüye dönüştürülüp üzerine karartma/etiket uygulanmasıyla
 * yeniden üretilir. Bu yöntemde orijinal metin katmanı, gizli metinler, yorumlar,
 * form alanları ve üst veriler çıktıya hiçbir biçimde taşınmaz (kalıcı karartma).
 */
(function (root) {
  'use strict';

  var olcuCtx = null;
  // Karakter konumları, sayfa çizimi sırasında yüklenen gerçek PDF yazı tipiyle ölçülür;
  // yazı tipi kullanılamıyorsa pdf.js'nin bildirdiği yedek aileye düşülür.
  function genislikOrani(o, a, b) {
    var str = o.str;
    if (!olcuCtx) olcuCtx = document.createElement('canvas').getContext('2d');
    olcuCtx.font = '100px "' + o.font + '", ' + (o.yedek || 'sans-serif');
    var toplam = olcuCtx.measureText(str).width;
    if (!toplam) return [a / Math.max(1, str.length), b / Math.max(1, str.length)];
    return [olcuCtx.measureText(str.slice(0, a)).width / toplam, olcuCtx.measureText(str.slice(0, b)).width / toplam];
  }

  async function oku(arrayBuffer) {
    var pdfjsLib = root.pdfjsLib;
    var veri = new Uint8Array(arrayBuffer.slice(0));
    var pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: veri, isEvalSupported: false, disableAutoFetch: true, disableStream: true, useSystemFonts: true }).promise;
    } catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('Parola korumalı PDF dosyaları desteklenmemektedir. Lütfen önce parolayı kaldırınız.');
      throw new Error('PDF dosyası okunamadı.');
    }
    var sayfalar = [], parcalar = [], harita = [];
    var metinsizSayfa = 0;
    for (var n = 1; n <= pdf.numPages; n++) {
      var sayfa = await pdf.getPage(n);
      var vp = sayfa.getViewport({ scale: 1 });
      var tc = await sayfa.getTextContent();
      var ogeler = [];
      var onceki = null;
      tc.items.forEach(function (it) {
        if (typeof it.str !== 'string') return;
        var tx = pdfjsLib.Util.transform(vp.transform, it.transform);
        var h = Math.hypot(tx[2], tx[3]) || 10;
        var aci = Math.atan2(tx[1], tx[0]);
        var st = tc.styles && tc.styles[it.fontName];
        var o = { str: it.str, x: tx[4], y: tx[5], h: h, aci: aci, w: it.width * (vp.scale || 1), eol: !!it.hasEOL,
          font: it.fontName, yedek: st && st.fontFamily ? st.fontFamily : 'sans-serif' };
        // Ayırıcı belirleme
        if (onceki) {
          if (onceki.eol) { ayir('\n'); }
          else {
            var ux = Math.cos(onceki.aci), uy = Math.sin(onceki.aci);
            var sonX = onceki.x + ux * onceki.w, sonY = onceki.y + uy * onceki.w;
            var dx = o.x - sonX, dy = o.y - sonY;
            var ilerleme = dx * ux + dy * uy;
            var dikey = Math.abs(-dx * uy + dy * ux);
            if (dikey > onceki.h * 0.5) ayir('\n');
            else if (ilerleme > onceki.h * 0.15 && !/\s$/.test(onceki.str) && !/^\s/.test(o.str)) ayir(' ');
          }
        }
        if (o.str.length) {
          var idx = ogeler.length; ogeler.push(o);
          for (var i = 0; i < o.str.length; i++) harita.push({ s: n - 1, o: idx, c: i });
          parcalar.push(o.str);
        }
        onceki = (o.str.length || o.eol) ? o : onceki;
        if (!o.str.length && o.eol && onceki) onceki.eol = true;
      });
      if (!ogeler.length) metinsizSayfa++;
      sayfalar.push({ no: n, genislik: vp.width, yukseklik: vp.height, ogeler: ogeler, elle: [] });
      ayir('\n\n');
      sayfa.cleanup();
    }
    function ayir(s) { for (var i = 0; i < s.length; i++) harita.push(null); parcalar.push(s); }

    var uyarilar = [];
    if (metinsizSayfa === pdf.numPages) uyarilar.push('Bu PDF metin katmanı içermiyor (taranmış belge olabilir). Otomatik tespit yapılamadı; önizleme üzerinden elle karartma yapabilirsiniz.');
    else if (metinsizSayfa) uyarilar.push(metinsizSayfa + ' sayfada metin katmanı bulunamadı; bu sayfaları önizlemeden elle kontrol ediniz.');
    uyarilar.push('PDF çıktısı, kalıcılığın güvencesi olarak görüntü tabanlıdır; çıktıda metin seçimi ve arama yapılamaz.');
    return { tur: 'pdf', pdf: pdf, sayfalar: sayfalar, harita: harita, metin: parcalar.join(''), uyarilar: uyarilar };
  }

  /** Bulguları sayfa bazında dikdörtgenlere çevirir (ölçek 1 görünüm koordinatları). */
  function dikdortgenler(belge, bulgular) {
    var sonuc = belge.sayfalar.map(function () { return []; });
    bulgular.forEach(function (b) {
      var gruplar = {}; // "sayfa:öğe" -> {s, o, a, b}
      for (var i = b.start; i < b.end; i++) {
        var h = belge.harita[i];
        if (!h) continue;
        var k = h.s + ':' + h.o;
        if (!gruplar[k]) gruplar[k] = { s: h.s, o: h.o, a: h.c, b: h.c + 1 };
        else gruplar[k].b = h.c + 1;
      }
      Object.keys(gruplar).forEach(function (k) {
        var g = gruplar[k];
        var o = belge.sayfalar[g.s].ogeler[g.o];
        var oran = genislikOrani(o, g.a, g.b);
        var ux = Math.cos(o.aci), uy = Math.sin(o.aci);
        var vx = uy, vy = -ux; // metnin "yukarı" yönü (görünümde y aşağı doğru artar)
        // Ölçüm hatalarına karşı metin yönünde güvenlik payı
        var yanPay = o.h * 0.12;
        var p0x = o.x + ux * (o.w * oran[0] - yanPay), p0y = o.y + uy * (o.w * oran[0] - yanPay);
        var p1x = o.x + ux * (o.w * oran[1] + yanPay), p1y = o.y + uy * (o.w * oran[1] + yanPay);
        var noktalar = [];
        [[p0x, p0y], [p1x, p1y]].forEach(function (p) {
          noktalar.push([p[0] - vx * o.h * 0.28, p[1] - vy * o.h * 0.28]);
          noktalar.push([p[0] + vx * o.h * 1.0, p[1] + vy * o.h * 1.0]);
        });
        var xs = noktalar.map(function (p) { return p[0]; }), ys = noktalar.map(function (p) { return p[1]; });
        var pay = Math.max(0.5, o.h * 0.05);
        sonuc[g.s].push({
          x: Math.min.apply(null, xs) - pay, y: Math.min.apply(null, ys) - pay,
          w: Math.max.apply(null, xs) - Math.min.apply(null, xs) + 2 * pay,
          h: Math.max.apply(null, ys) - Math.min.apply(null, ys) + 2 * pay,
          bulgu: b
        });
      });
    });
    return sonuc;
  }

  async function sayfaCiz(belge, sayfaNo, olcek, kutular, mod, onizleme) {
    var sayfa = await belge.pdf.getPage(sayfaNo + 1);
    var vp = sayfa.getViewport({ scale: olcek });
    var canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await sayfa.render({ canvasContext: ctx, viewport: vp, annotationMode: root.pdfjsLib.AnnotationMode ? root.pdfjsLib.AnnotationMode.ENABLE : 1 }).promise;
    // Kutular, yazı tipleri yüklendikten sonra hesaplanabilsin diye işlev olarak da verilebilir
    if (typeof kutular === 'function') kutular = kutular();
    kutular.forEach(function (k) {
      var x = k.x * olcek, y = k.y * olcek, w = k.w * olcek, h = k.h * olcek;
      if (onizleme) {
        ctx.fillStyle = k.elle ? 'rgba(180,30,30,0.45)' : 'rgba(20,40,90,0.40)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = k.elle ? '#b41e1e' : '#14285a'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
        return;
      }
      if (mod === 'etiket' && k.bulgu && k.bulgu.etiket) {
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, olcek * 0.6); ctx.strokeRect(x, y, w, h);
        var yazi = k.bulgu.etiket;
        var boy = Math.min(h * 0.72, 14 * olcek);
        ctx.font = 'bold ' + boy + 'px sans-serif';
        var tw = ctx.measureText(yazi).width;
        if (tw > w - 4) { boy = boy * (w - 4) / tw; ctx.font = 'bold ' + boy + 'px sans-serif'; }
        ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        ctx.fillText(yazi, x + w / 2, y + h / 2);
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
      }
    });
    sayfa.cleanup();
    return canvas;
  }

  function kutulariTopla(belge, kutuListesi, sayfaNo) {
    var oto = kutuListesi[sayfaNo].filter(function (k) { return k.bulgu.secili; });
    var elle = belge.sayfalar[sayfaNo].elle.map(function (k) { return { x: k.x, y: k.y, w: k.w, h: k.h, elle: true }; });
    return oto.concat(elle);
  }

  function canvasJpeg(canvas) {
    return new Promise(function (coz, red) {
      canvas.toBlob(function (blob) {
        if (!blob) return red(new Error('Sayfa görüntüsü oluşturulamadı.'));
        blob.arrayBuffer().then(function (ab) { coz(new Uint8Array(ab)); }, red);
      }, 'image/jpeg', 0.9);
    });
  }

  /* Basit PDF yazıcısı: her sayfa tek bir JPEG görüntüsünden oluşur. */
  function pdfOlustur(sayfaGorselleri) {
    var enc = new TextEncoder();
    var parcalar = [], ofsetler = [], boy = 0;
    function yaz(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parcalar.push(b); boy += b.length; }
    var nesneSayisi = 2 + sayfaGorselleri.length * 3;
    var bas = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]);
    parcalar.push(bas); boy += bas.length;

    function nesne(no, govde) { ofsetler[no] = boy; yaz(no + ' 0 obj\n'); govde(); yaz('\nendobj\n'); }
    var kids = sayfaGorselleri.map(function (_, i) { return (3 + i * 3) + ' 0 R'; }).join(' ');
    nesne(1, function () { yaz('<< /Type /Catalog /Pages 2 0 R >>'); });
    nesne(2, function () { yaz('<< /Type /Pages /Kids [' + kids + '] /Count ' + sayfaGorselleri.length + ' >>'); });
    sayfaGorselleri.forEach(function (sg, i) {
      var sayfaNo = 3 + i * 3, gorselNo = sayfaNo + 1, icerikNo = sayfaNo + 2;
      var w = sg.genislik.toFixed(2), h = sg.yukseklik.toFixed(2);
      nesne(sayfaNo, function () {
        yaz('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /XObject << /Im0 ' + gorselNo + ' 0 R >> >> /Contents ' + icerikNo + ' 0 R >>');
      });
      nesne(gorselNo, function () {
        yaz('<< /Type /XObject /Subtype /Image /Width ' + sg.pw + ' /Height ' + sg.ph + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + sg.jpeg.length + ' >>\nstream\n');
        yaz(sg.jpeg); yaz('\nendstream');
      });
      var akis = 'q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im0 Do Q';
      nesne(icerikNo, function () { yaz('<< /Length ' + akis.length + ' >>\nstream\n' + akis + '\nendstream'); });
    });
    var bilgiNo = nesneSayisi + 1;
    nesne(bilgiNo, function () { yaz('<< /Producer (Suzgec) /Creator (Suzgec) >>'); });
    var xref = boy;
    var satirlar = ['xref', '0 ' + (bilgiNo + 1), '0000000000 65535 f '];
    for (var i = 1; i <= bilgiNo; i++) satirlar.push(String(ofsetler[i]).padStart(10, '0') + ' 00000 n ');
    yaz(satirlar.join('\n') + '\ntrailer\n<< /Size ' + (bilgiNo + 1) + ' /Root 1 0 R /Info ' + bilgiNo + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var sonuc = new Uint8Array(boy), p = 0;
    parcalar.forEach(function (b) { sonuc.set(b, p); p += b.length; });
    return sonuc;
  }

  async function yaz(belge, bulgular, mod, secenek) {
    secenek = secenek || {};
    var dpi = secenek.dpi || 200;
    var gorseller = [];
    for (var s = 0; s < belge.sayfalar.length; s++) {
      var sy = belge.sayfalar[s];
      var olcek = dpi / 72;
      var enBuyuk = Math.max(sy.genislik, sy.yukseklik) * olcek;
      if (enBuyuk > 6000) olcek = olcek * 6000 / enBuyuk;
      var canvas = await sayfaCiz(belge, s, olcek, (function (sn) {
        return function () { return kutulariTopla(belge, dikdortgenler(belge, bulgular), sn); };
      })(s), mod, false);
      var jpeg = await canvasJpeg(canvas);
      gorseller.push({ genislik: sy.genislik, yukseklik: sy.yukseklik, pw: canvas.width, ph: canvas.height, jpeg: jpeg });
      canvas.width = canvas.height = 0;
      if (secenek.ilerleme) secenek.ilerleme(s + 1, belge.sayfalar.length);
    }
    return pdfOlustur(gorseller);
  }

  root.Suzgec = root.Suzgec || {};
  root.Suzgec.pdf = {
    oku: oku, yaz: yaz, uzanti: 'pdf', mime: 'application/pdf',
    dikdortgenler: dikdortgenler, sayfaCiz: sayfaCiz, kutulariTopla: kutulariTopla
  };
})(typeof self !== 'undefined' ? self : this);
