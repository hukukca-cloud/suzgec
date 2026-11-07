/*
 * Süzgeç — Arayüz
 */
(function () {
  'use strict';
  var S = window.Suzgec, C = S.core;
  var MODULLER = { pdf: S.pdf, docx: S.docx, udf: S.udf };

  var durum = {
    dosyalar: [], sayac: 0, tarandi: false, indirildi: false,
    tercih: {},        // kullanıcının elle değiştirdiği seçimler: anahtar -> true/false (yeniden taramada korunur)
    ara: ''
  };

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function boyutYaz(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function seciliSay(liste) { return liste.filter(function (b) { return b.secili; }).length; }

  function ayarlar() {
    return {
      kapsam: {
        yapisal: $('#k-yapisal').checked, kisi: $('#k-kisi').checked,
        adres: $('#k-adres').checked, ozel: $('#k-ozel').checked
      },
      ozelListe: $('#ozel-liste').value.split(/\n/),
      haricListe: $('#haric-liste').value.split(/\n/),
      soyadYayilimi: $('#soyad-yayilimi').checked
    };
  }
  function mod() { return $('input[name="mod"]:checked').value; }

  function bildir(mesaj, tur) {
    var d = $('#durum');
    d.textContent = mesaj || '';
    d.className = 'durum' + (tur ? ' ' + tur : '');
  }

  function tercihAnahtari(d, b) { return d.id + '|' + b.kat + '|' + b.start + '|' + b.end; }
  function secimiDegistir(d, b, deger) { b.secili = deger; durum.tercih[tercihAnahtari(d, b)] = deger; durum.indirildi = false; }

  /* ---------- Konum bilgisi ---------- */

  function konumHazirla(d) {
    var m = d.belge.metin, satirlar = [0];
    for (var i = 0; i < m.length; i++) if (m.charCodeAt(i) === 10) satirlar.push(i + 1);
    // Boş satırları saymadan paragraf numarası
    var paragrafNo = [], n = 0;
    for (var j = 0; j < satirlar.length; j++) {
      var bas = satirlar[j], son = j + 1 < satirlar.length ? satirlar[j + 1] - 1 : m.length;
      if (m.slice(bas, son).trim()) n++;
      paragrafNo.push(n);
    }
    d.konum = { satirlar: satirlar, paragrafNo: paragrafNo };
  }
  function konumYaz(d, b) {
    if (d.tur === 'pdf') {
      var h = null;
      for (var i = b.start; i < b.end && !h; i++) h = d.belge.harita[i];
      return h ? 'Sayfa ' + (h.s + 1) : '';
    }
    var s = d.konum.satirlar, lo = 0, hi = s.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (s[mid] <= b.start) lo = mid; else hi = mid - 1; }
    return 'Paragraf ' + Math.max(1, d.konum.paragrafNo[lo]);
  }
  function numaralandir(d) {
    var n = 0;
    d.bulgular.forEach(function (b) { b.no = b.secili ? ++n : null; });
  }

  /* ---------- Dosya ekleme ---------- */

  function turBul(ad) {
    var m = /\.([a-z0-9]+)$/i.exec(ad);
    var u = m ? m[1].toLowerCase() : '';
    if (u === 'pdf' || u === 'docx' || u === 'udf') return u;
    if (u === 'doc') throw new Error('Eski Word (.doc) biçimi desteklenmemektedir; lütfen belgeyi .docx olarak kaydediniz.');
    throw new Error('Desteklenmeyen dosya türü. PDF, Word (.docx) ve UDF dosyaları kabul edilmektedir.');
  }

  async function dosyalariEkle(liste) {
    for (var i = 0; i < liste.length; i++) {
      var f = liste[i];
      var kayit = { id: ++durum.sayac, ad: f.name, boyut: f.size, tur: null, buf: null, belge: null, bulgular: [], hata: null, elle: {}, ui: { sekme: 'belge', gorunum: 'ozgun' } };
      try { kayit.tur = turBul(f.name); kayit.buf = await f.arrayBuffer(); }
      catch (e) { kayit.hata = e.message; }
      durum.dosyalar.push(kayit);
    }
    durum.tarandi = false; durum.indirildi = false;
    ciz();
    if (durum.dosyalar.some(function (d) { return !d.hata; })) bildir('Dosyalar eklendi. “Tara ve incele” ile taramayı başlatabilirsiniz.');
  }

  /* ---------- Tarama ---------- */

  async function tara() {
    var gecerli = durum.dosyalar.filter(function (d) { return !d.hata || d.taramaHatasi; });
    if (!gecerli.length) { bildir('Önce en az bir dosya ekleyiniz.', 'uyari'); return; }
    var ayar = ayarlar();
    $('#tara').disabled = true;
    try {
      for (var i = 0; i < gecerli.length; i++) {
        var d = gecerli[i];
        bildir('Taranıyor: ' + d.ad + ' (' + (i + 1) + '/' + gecerli.length + ')');
        try {
          if (!d.belge) { d.belge = await MODULLER[d.tur].oku(d.buf); konumHazirla(d); }
          d.hata = null; d.taramaHatasi = false;
          d.bulgular = C.tespitEt(d.belge.metin, ayar);
        } catch (e) {
          console.error(e);
          d.hata = e.message || 'Dosya işlenemedi.'; d.taramaHatasi = true; d.bulgular = [];
        }
      }
      // Bir belgede bulunan kişi adlarını diğer belgelerde de ara
      var okunan = gecerli.filter(function (d) { return d.belge && !d.hata; });
      if (okunan.length > 1 && ayar.kapsam.kisi) {
        var tumKisiler = [];
        okunan.forEach(function (d) { tumKisiler = tumKisiler.concat(C.kisiListesi(d.bulgular)); });
        var ayar2 = Object.assign({}, ayar, { ekKisiler: tumKisiler });
        okunan.forEach(function (d) { d.bulgular = C.tespitEt(d.belge.metin, ayar2); });
      }
      // Kullanıcının önceki tercihlerini uygula
      okunan.forEach(function (d) {
        d.bulgular.forEach(function (b) {
          var t = durum.tercih[tercihAnahtari(d, b)];
          if (t !== undefined) b.secili = t;
        });
      });
      C.etiketAta(okunan.map(function (d) { return d.bulgular; }));
      durum.tarandi = true; durum.indirildi = false;
      var toplam = okunan.reduce(function (t, d) { return t + seciliSay(d.bulgular); }, 0);
      bildir(okunan.length + ' belgede ' + toplam + ' ifade temizlenmek üzere işaretlendi. Belge görünümünde her değişikliği inceleyebilir, işaretli bir ifadeye tıklayarak kaldırabilirsiniz.', 'basari');
    } finally {
      $('#tara').disabled = false;
      ciz();
    }
  }

  /* ---------- Genel çizim ---------- */

  function ciz() {
    var liste = $('#dosya-listesi');
    liste.innerHTML = '';
    $('#bos-durum').hidden = durum.dosyalar.length > 0;
    durum.dosyalar.forEach(function (d) { liste.appendChild(dosyaKarti(d)); });
    var hazir = durum.tarandi && durum.dosyalar.some(function (d) { return d.belge && !d.hata; });
    $('#indir').disabled = !hazir;
    $('#esleme-sat').hidden = mod() !== 'etiket';
    $('#tara').textContent = durum.tarandi ? 'Yeniden tara' : 'Tara ve incele';
    ozetCiz();
    adimlariCiz();
  }

  function adimlariCiz() {
    var var_ = durum.dosyalar.length > 0;
    var a = [$('#adim-1'), $('#adim-2'), $('#adim-3')];
    var aktif = !var_ ? 0 : !durum.tarandi ? 1 : !durum.indirildi ? 2 : 3;
    a.forEach(function (x, i) { x.className = 'adim' + (i < aktif ? ' tamam' : i === aktif ? ' aktif' : ''); });
  }

  function ozetCiz() {
    var kutu = $('#ozet');
    var hazir = durum.dosyalar.filter(function (d) { return d.belge && !d.hata; });
    if (!durum.tarandi || !hazir.length) { kutu.classList.remove('gorunur'); return; }
    kutu.classList.add('gorunur');
    var tum = []; hazir.forEach(function (d) { tum = tum.concat(d.bulgular); });
    $('#ozet-sayi').innerHTML = seciliSay(tum) + '<small>temizlenecek ifade · ' + hazir.length + ' belge</small>';
    var cipler = $('#cipler'); cipler.innerHTML = '';
    Object.keys(C.KATEGORILER).forEach(function (kat) {
      var g = tum.filter(function (b) { return b.kat === kat; });
      if (!g.length) return;
      var s = seciliSay(g);
      var c = el('button', { type: 'button', class: 'cip' + (s ? '' : ' kapali'), 'aria-pressed': String(!!s), title: s ? 'Bu kategoriyi tüm belgelerde kapat' : 'Bu kategoriyi tüm belgelerde aç' },
        esc(C.KATEGORILER[kat].ad) + '<b>' + s + '</b>');
      c.onclick = function () {
        var yeni = s === 0;
        hazir.forEach(function (d) { d.bulgular.forEach(function (b) { if (b.kat === kat) secimiDegistir(d, b, yeni); }); });
        ciz();
      };
      cipler.appendChild(c);
    });
  }

  /* ---------- Dosya kartı ---------- */

  function dosyaKarti(d) {
    var kart = el('section', { class: 'kart', 'data-id': d.id });
    kartIcerigi(kart, d);
    return kart;
  }

  function kartYenile(d) {
    var eski = $('.kart[data-id="' + d.id + '"]');
    if (!eski) return ciz();
    var belgeKutu = $('.belge', eski), kaydirma = belgeKutu ? belgeKutu.scrollTop : 0;
    var listeKutu = $('.deg-listesi', eski), listeKaydirma = listeKutu ? listeKutu.scrollTop : 0;
    eski.innerHTML = '';
    kartIcerigi(eski, d);
    var yb = $('.belge', eski); if (yb) yb.scrollTop = kaydirma;
    var yl = $('.deg-listesi', eski); if (yl) yl.scrollTop = listeKaydirma;
    ozetCiz(); adimlariCiz();
  }

  function kartIcerigi(kart, d) {
    var ust = el('div', { class: 'kart-ust' });
    ust.appendChild(el('span', { class: 'rozet rozet-' + (d.tur || 'hata') }, esc((d.tur || '?').toUpperCase())));
    ust.appendChild(el('div', { class: 'kart-ad' }, '<strong>' + esc(d.ad) + '</strong><span>' + boyutYaz(d.boyut) +
      (d.belge && d.tur === 'pdf' ? ' · ' + d.belge.sayfalar.length + ' sayfa' : '') +
      (durum.tarandi && !d.hata ? ' · ' + seciliSay(d.bulgular) + '/' + d.bulgular.length + ' ifade temizlenecek' : '') + '</span>'));
    if (durum.tarandi && !d.hata && d.tur === 'pdf') {
      var onz = el('button', { class: 'dugme-ikincil', type: 'button' }, 'Sayfa önizlemesi ve elle karartma');
      onz.onclick = function () { pdfOnizleme(d); };
      ust.appendChild(onz);
    }
    var kaldir = el('button', { class: 'dugme-metin', type: 'button', 'aria-label': d.ad + ' dosyasını listeden çıkar' }, 'Çıkar');
    kaldir.onclick = function () { if (d.belge && d.belge.pdf) d.belge.pdf.destroy(); durum.dosyalar = durum.dosyalar.filter(function (x) { return x !== d; }); ciz(); };
    ust.appendChild(kaldir);
    kart.appendChild(ust);

    if (d.hata) { kart.appendChild(el('p', { class: 'hata' }, esc(d.hata))); return; }
    var govde = el('div', { class: 'kart-govde' });
    kart.appendChild(govde);
    if (d.belge && d.belge.uyarilar.length) {
      var ul = el('ul', { class: 'uyarilar' });
      d.belge.uyarilar.forEach(function (u) { ul.appendChild(el('li', null, esc(u))); });
      govde.appendChild(ul);
    }
    if (!durum.tarandi) { govde.appendChild(el('p', { class: 'kucuk' }, 'Tarama bekleniyor.')); return; }
    if (d.tur === 'pdf') {
      var elleSayisi = Object.keys(d.elle).reduce(function (t, k) { return t + d.elle[k].length; }, 0);
      if (elleSayisi) govde.appendChild(el('p', { class: 'kucuk' }, elleSayisi + ' alan elle karartılacak.'));
    }
    numaralandir(d);

    // Sekmeler
    var sekmeler = el('div', { class: 'sekmeler', role: 'tablist' });
    [['belge', 'Belge görünümü', seciliSay(d.bulgular)], ['bulgular', 'Bulgu listesi', d.bulgular.length]].forEach(function (s) {
      var b = el('button', { class: 'sekme', role: 'tab', type: 'button', 'aria-selected': String(d.ui.sekme === s[0]) }, esc(s[1]) + '<span class="say">' + s[2] + '</span>');
      b.onclick = function () { d.ui.sekme = s[0]; kartYenile(d); };
      sekmeler.appendChild(b);
    });
    govde.appendChild(sekmeler);
    if (d.ui.sekme === 'belge') belgeGorunumu(govde, d); else bulguListesi(govde, d);
  }

  /* ---------- Belge görünümü: neyin değiştiği ---------- */

  function belgeGorunumu(kap, d) {
    var m = mod();
    var ust = el('div', { class: 'gorunum-ust' });
    var anahtar = el('div', { class: 'anahtar', role: 'group', 'aria-label': 'Görünüm' });
    [['ozgun', 'Özgün metin'], ['temiz', 'Temizlenmiş hâli']].forEach(function (g) {
      var b = el('button', { type: 'button', 'aria-pressed': String(d.ui.gorunum === g[0]) }, g[1]);
      b.onclick = function () { d.ui.gorunum = g[0]; kartYenile(d); };
      anahtar.appendChild(b);
    });
    ust.appendChild(anahtar);
    var toplu = el('div', { class: 'toplu' });
    [['Tümünü temizle', true], ['Hiçbirini temizleme', false]].forEach(function (t) {
      var b = el('button', { class: 'dugme-metin', type: 'button' }, t[0]);
      b.onclick = function () { d.bulgular.forEach(function (x) { secimiDegistir(d, x, t[1]); }); kartYenile(d); };
      toplu.appendChild(b);
    });
    ust.appendChild(el('div', { class: 'lejant' }, d.ui.gorunum === 'ozgun'
      ? '<span class="l-secili">Temizlenecek</span><span class="l-birak">Bırakılacak</span><span>Tıklayarak değiştirin · metin seçerek ekleyin</span>'
      : '<span class="l-deg">Değiştirildi</span><span class="l-birak">Bırakıldı</span>'));
    ust.appendChild(toplu);
    kap.appendChild(ust);

    var izgara = el('div', { class: 'belge-izgara' });
    var metin = d.belge.metin, parca = [], konum = 0;
    d.bulgular.forEach(function (b, i) {
      if (b.start < konum) return;
      parca.push(esc(metin.slice(konum, b.start)));
      var baslik = esc(C.KATEGORILER[b.kat].ad + (b.etiket ? ' · ' + b.etiket : '') + ' — tıklayarak ' + (b.secili ? 'bırakın' : 'temizleyin'));
      if (!b.secili) parca.push('<mark class="birak" data-i="' + i + '" title="' + baslik + '">' + esc(metin.slice(b.start, b.end)) + '</mark>');
      else if (d.ui.gorunum === 'ozgun') parca.push('<mark data-i="' + i + '" title="' + baslik + '">' + esc(metin.slice(b.start, b.end)) + '<sup>' + b.no + '</sup></mark>');
      else parca.push('<span class="deg' + (m === 'karart' ? ' karart' : '') + '" data-i="' + i + '" title="' + baslik + '">' + esc(C.yerineKonacak(b, m)) + '<sup>' + b.no + '</sup></span>');
      konum = b.end;
    });
    parca.push(esc(metin.slice(konum)));
    var belge = el('div', { class: 'belge', tabindex: '0', 'aria-label': d.ad + ' belge metni' }, parca.join('').replace(/\n{3,}/g, '\n\n'));
    belge.addEventListener('click', function (e) {
      var hedef = e.target.closest('[data-i]');
      if (!hedef || String(window.getSelection())) return;
      var b = d.bulgular[+hedef.getAttribute('data-i')];
      secimiDegistir(d, b, !b.secili);
      kartYenile(d);
    });
    belge.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.matches('[data-i]')) { e.preventDefault(); document.activeElement.click(); }
    });
    izgara.appendChild(belge);

    // Değişiklik listesi
    var liste = el('div', { class: 'deg-listesi' });
    var secili = d.bulgular.filter(function (b) { return b.secili; });
    liste.appendChild(el('h3', null, '<span>Değişiklikler</span><span>' + secili.length + '</span>'));
    var ol = el('ol');
    secili.forEach(function (b) {
      var li = el('li');
      var btn = el('button', { type: 'button' },
        '<span class="no">' + b.no + '</span><span class="yeni"><span class="eski">' + esc(b.text.replace(/\s+/g, ' ')) + '</span> → ' + esc(C.yerineKonacak(b, m)) + '</span>' +
        '<span class="yer">' + esc(konumYaz(d, b)) + ' · ' + esc(C.KATEGORILER[b.kat].ad) + '</span>');
      btn.onclick = function () { odakla(belge, d.bulgular.indexOf(b)); };
      li.appendChild(btn); ol.appendChild(li);
    });
    if (!secili.length) ol.appendChild(el('li', { class: 'kucuk', style: 'padding:10px' }, 'Temizlenecek ifade yok.'));
    liste.appendChild(ol);
    izgara.appendChild(liste);
    kap.appendChild(izgara);
  }

  function odakla(belge, i) {
    var hedef = $('[data-i="' + i + '"]', belge);
    if (!hedef) return;
    belge.scrollTop = hedef.offsetTop - belge.clientHeight / 3;
    hedef.classList.remove('yanip'); void hedef.offsetWidth; hedef.classList.add('yanip');
  }

  /* ---------- Bulgu listesi ---------- */

  function bulguListesi(kap, d) {
    if (!d.bulgular.length) { kap.appendChild(el('p', { class: 'kucuk' }, 'Bu belgede otomatik bulgu tespit edilmedi.')); return; }
    var ara = C.trKucuk(durum.ara.trim());
    var gruplar = {};
    d.bulgular.forEach(function (b) { (gruplar[b.kat] = gruplar[b.kat] || []).push(b); });
    var gosterilen = 0;
    Object.keys(C.KATEGORILER).forEach(function (kat) {
      var g = gruplar[kat];
      if (!g) return;
      var gorunur = ara ? g.filter(function (b) { return C.trKucuk(b.text).indexOf(ara) >= 0 || C.trKucuk(b.etiket || '').indexOf(ara) >= 0; }) : g;
      if (!gorunur.length) return;
      gosterilen += gorunur.length;
      var det = el('details', { class: 'grup' });
      var s = seciliSay(g);
      var sum = el('summary');
      var hepsi = el('input', { type: 'checkbox', 'aria-label': C.KATEGORILER[kat].ad + ' kategorisinin tümünü seç' });
      hepsi.checked = s === g.length; hepsi.indeterminate = s > 0 && s < g.length;
      hepsi.onclick = function (e) { e.stopPropagation(); };
      hepsi.onchange = function () { g.forEach(function (b) { secimiDegistir(d, b, hepsi.checked); }); kartYenile(d); };
      sum.appendChild(hepsi);
      sum.appendChild(el('span', { class: 'grup-ad' }, esc(C.KATEGORILER[kat].ad)));
      sum.appendChild(el('span', { class: 'grup-sayi' }, s + '/' + g.length));
      det.appendChild(sum);
      det.open = !!ara || !!d.ui['acik-' + kat];
      det.addEventListener('toggle', function () { d.ui['acik-' + kat] = det.open; });

      var tablo = el('table', { class: 'bulgular' });
      tablo.innerHTML = '<thead><tr><th scope="col"><span class="gizli">Seç</span></th><th scope="col">Bulunan ifade</th><th scope="col">Yerine</th><th scope="col">Bağlam</th><th scope="col"><span class="gizli">Belgede göster</span></th></tr></thead>';
      var tb = el('tbody');
      gorunur.forEach(function (b) {
        var tr = el('tr', { class: b.secili ? '' : 'pasif' });
        var cb = el('input', { type: 'checkbox', 'aria-label': b.text + ' ifadesini temizle' });
        cb.checked = b.secili;
        cb.onchange = function () { secimiDegistir(d, b, cb.checked); kartYenile(d); };
        var td0 = el('td'); td0.appendChild(cb); tr.appendChild(td0);
        tr.appendChild(el('td', { class: 'ifade' }, esc(b.text) + '<small style="color:var(--gri)">' + esc(konumYaz(d, b)) + '</small>' + (b.not ? '<small>' + esc(b.not) + '</small>' : '')));
        tr.appendChild(el('td', { class: 'etiket' }, esc(C.yerineKonacak(b, mod()))));
        var m = d.belge.metin;
        var once = m.slice(Math.max(0, b.start - 40), b.start).replace(/\s+/g, ' ');
        var sonra = m.slice(b.end, b.end + 40).replace(/\s+/g, ' ');
        tr.appendChild(el('td', { class: 'baglam' }, '…' + esc(once) + '<mark>' + esc(b.text) + '</mark>' + esc(sonra) + '…'));
        var tdg = el('td', { class: 'git' });
        var git = el('button', { class: 'dugme-ikincil', type: 'button', 'aria-label': 'Belgede göster' }, 'Göster');
        git.onclick = function () {
          if (!b.secili) secimiDegistir(d, b, true);
          d.ui.sekme = 'belge'; d.ui.gorunum = 'ozgun'; kartYenile(d);
          var kartEl = $('.kart[data-id="' + d.id + '"]');
          odakla($('.belge', kartEl), d.bulgular.indexOf(b));
          kartEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
        };
        tdg.appendChild(git); tr.appendChild(tdg);
        tb.appendChild(tr);
      });
      tablo.appendChild(tb);
      det.appendChild(tablo);
      kap.appendChild(det);
    });
    if (!gosterilen) kap.appendChild(el('p', { class: 'kucuk' }, 'Aramanızla eşleşen bulgu yok.'));
  }

  /* ---------- Seçimden ekleme ---------- */

  function secimDugmesiBagla() {
    var dugme = $('#secim-dugmesi');
    var secilen = '';
    document.addEventListener('mouseup', function (e) {
      if (e.target === dugme) return;
      setTimeout(function () {
        var sel = window.getSelection();
        var metin = sel ? String(sel).replace(/\s+/g, ' ').trim() : '';
        var kapsayan = sel && sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
        var belgeIcinde = kapsayan && (kapsayan.nodeType === 1 ? kapsayan : kapsayan.parentNode).closest('.belge');
        if (!metin || metin.length < 2 || metin.length > 150 || !belgeIcinde) { dugme.classList.remove('gorunur'); return; }
        secilen = metin;
        var r = sel.getRangeAt(0).getBoundingClientRect();
        dugme.style.left = Math.max(8, Math.min(window.innerWidth - 260, r.left)) + 'px';
        dugme.style.top = Math.max(8, r.top - 42) + 'px';
        dugme.textContent = '“' + (metin.length > 28 ? metin.slice(0, 26) + '…' : metin) + '” ifadesini temizle';
        dugme.classList.add('gorunur');
      }, 0);
    });
    document.addEventListener('scroll', function () { dugme.classList.remove('gorunur'); }, true);
    dugme.addEventListener('click', function () {
      dugme.classList.remove('gorunur');
      var alan = $('#ozel-liste');
      var satirlar = alan.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (satirlar.map(C.trKucuk).indexOf(C.trKucuk(secilen)) < 0) satirlar.push(secilen);
      alan.value = satirlar.join('\n');
      $('#k-ozel').checked = true;
      window.getSelection().removeAllRanges();
      tara().then(function () { bildir('“' + secilen + '” özel listeye eklendi ve tüm belgelerde işaretlendi.', 'basari'); });
    });
  }

  /* ---------- PDF önizleme ve elle karartma ---------- */

  async function pdfOnizleme(d) {
    var pencere = $('#onizleme');
    var govde = $('#onizleme-govde');
    $('#onizleme-baslik').textContent = d.ad;
    govde.innerHTML = '';
    pencere.showModal();
    var olcek = Math.min(1.6, (govde.clientWidth - 32) / Math.max.apply(null, d.belge.sayfalar.map(function (s) { return s.genislik; })));
    if (!isFinite(olcek) || olcek <= 0) olcek = 1;
    var oturum = {};
    pencere._oturum = oturum;
    for (var i = 0; i < d.belge.sayfalar.length; i++) {
      if (pencere._oturum !== oturum || !pencere.open) return;
      var kap = el('div', { class: 'sayfa' });
      kap.appendChild(el('div', { class: 'sayfa-no' }, 'Sayfa ' + (i + 1)));
      var sarmal = el('div', { class: 'sayfa-sarmal' });
      var taban = await S.pdf.sayfaCiz(d.belge, i, olcek, [], mod(), true);
      taban.className = 'taban';
      var ust = document.createElement('canvas');
      ust.width = taban.width; ust.height = taban.height; ust.className = 'ust';
      sarmal.style.width = taban.width + 'px'; sarmal.style.height = taban.height + 'px';
      sarmal.appendChild(taban); sarmal.appendChild(ust);
      kap.appendChild(sarmal);
      govde.appendChild(kap);
      elleKarartmaBagla(d, i, ust, olcek, S.pdf.dikdortgenler(d.belge, d.bulgular)[i]);
    }
  }

  function elleKarartmaBagla(d, sayfaNo, canvas, olcek, otoKutular) {
    var ctx = canvas.getContext('2d');
    d.elle[sayfaNo] = d.elle[sayfaNo] || [];
    var elle = d.elle[sayfaNo];
    function yeniden(gecici) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      otoKutular.forEach(function (k) {
        if (!k.bulgu.secili) return;
        ctx.fillStyle = 'rgba(200,16,46,0.30)'; ctx.fillRect(k.x * olcek, k.y * olcek, k.w * olcek, k.h * olcek);
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 1; ctx.strokeRect(k.x * olcek, k.y * olcek, k.w * olcek, k.h * olcek);
      });
      elle.forEach(function (k) {
        ctx.fillStyle = 'rgba(14,14,16,0.55)'; ctx.fillRect(k.x * olcek, k.y * olcek, k.w * olcek, k.h * olcek);
        ctx.strokeStyle = '#0e0e10'; ctx.lineWidth = 2; ctx.strokeRect(k.x * olcek, k.y * olcek, k.w * olcek, k.h * olcek);
      });
      if (gecici) { ctx.setLineDash([5, 4]); ctx.strokeStyle = '#0e0e10'; ctx.lineWidth = 1.5; ctx.strokeRect(gecici.x, gecici.y, gecici.w, gecici.h); ctx.setLineDash([]); }
    }
    yeniden();
    var bas = null;
    function nokta(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
    canvas.addEventListener('pointerdown', function (e) { bas = nokta(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!bas) return; var p = nokta(e);
      yeniden({ x: Math.min(bas.x, p.x), y: Math.min(bas.y, p.y), w: Math.abs(p.x - bas.x), h: Math.abs(p.y - bas.y) });
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!bas) return; var p = nokta(e);
      var w = Math.abs(p.x - bas.x), h = Math.abs(p.y - bas.y);
      if (w < 4 && h < 4) {
        for (var i = elle.length - 1; i >= 0; i--) {
          var k = elle[i];
          if (p.x >= k.x * olcek && p.x <= (k.x + k.w) * olcek && p.y >= k.y * olcek && p.y <= (k.y + k.h) * olcek) { elle.splice(i, 1); break; }
        }
      } else {
        elle.push({ x: Math.min(bas.x, p.x) / olcek, y: Math.min(bas.y, p.y) / olcek, w: w / olcek, h: h / olcek });
      }
      bas = null; durum.indirildi = false; yeniden();
    });
  }

  /* ---------- PDF elle karartma alanlarının metne yansıtılması ---------- */

  // PDF Word'e dönüştürülürken, elle karartılan alanlarla kesişen metin parçaları da temizlenir.
  function elleBulgular(d) {
    var sonuc = [], belge = d.belge;
    var hedef = {};
    Object.keys(d.elle).forEach(function (n) {
      var sayfa = belge.sayfalar[n];
      d.elle[n].forEach(function (k) {
        sayfa.ogeler.forEach(function (o, oi) {
          var x0 = Math.min(o.x, o.x + Math.cos(o.aci) * o.w), x1 = Math.max(o.x, o.x + Math.cos(o.aci) * o.w);
          var y0 = o.y - o.h, y1 = o.y + o.h * 0.3;
          if (x1 > k.x && x0 < k.x + k.w && y1 > k.y && y0 < k.y + k.h) hedef[n + ':' + oi] = true;
        });
      });
    });
    var aktif = null;
    belge.harita.forEach(function (h, i) {
      var uygun = h && hedef[h.s + ':' + h.o];
      if (uygun && aktif && aktif.end === i) { aktif.end = i + 1; return; }
      if (uygun) { aktif = { kat: 'ELLE', start: i, end: i + 1, secili: true, etiket: '[KARARTMA]' }; sonuc.push(aktif); }
    });
    return sonuc;
  }

  /* ---------- Listeleri dışa ve içe aktarma ---------- */

  function listeleriKaydet() {
    var veri = { surum: 1, ozelListe: $('#ozel-liste').value.split('\n').filter(function (x) { return x.trim(); }),
      haricListe: $('#haric-liste').value.split('\n').filter(function (x) { return x.trim(); }) };
    indirBaslat(new TextEncoder().encode(JSON.stringify(veri, null, 2)), 'suzgec_listeler.json', 'application/json');
    bildir('Özel ve hariç listeler dosya olarak kaydedildi. Bu dosya, listelere yazdığınız ifadeleri içerir.');
  }
  function listeleriYukle(dosya) {
    if (!dosya) return;
    dosya.text().then(function (t) {
      var v = JSON.parse(t);
      if (!v || (!Array.isArray(v.ozelListe) && !Array.isArray(v.haricListe))) throw new Error('biçim');
      if (Array.isArray(v.ozelListe)) $('#ozel-liste').value = v.ozelListe.map(String).join('\n');
      if (Array.isArray(v.haricListe)) $('#haric-liste').value = v.haricListe.map(String).join('\n');
      bildir('Listeler yüklendi' + (durum.tarandi ? '; değişikliklerin uygulanması için belgeleri yeniden taratınız.' : '.'), 'basari');
    }).catch(function () { bildir('Liste dosyası okunamadı. Süzgeç ile kaydedilmiş bir .json dosyası seçiniz.', 'hata'); });
  }

  /* ---------- Çıktı ---------- */

  function indirBaslat(veri, ad, mime) {
    var blob = veri instanceof Blob ? veri : new Blob([veri], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: ad });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function ciktiAdi(ad, tur) { return ad.replace(/\.[^.]+$/, '') + '_suzgec.' + tur; }

  async function indir() {
    var hazir = durum.dosyalar.filter(function (d) { return d.belge && !d.hata; });
    if (!hazir.length) return;
    var m = mod();
    var dpi = parseInt($('#pdf-dpi').value, 10) || 200;
    var isaretle = $('#isaretle').checked;
    var bicim = $('input[name="bicim"]:checked').value;
    $('#indir').disabled = true;
    var ciktilar = [];
    try {
      for (var i = 0; i < hazir.length; i++) {
        var d = hazir[i];
        bildir('Temizleniyor: ' + d.ad + ' (' + (i + 1) + '/' + hazir.length + ')');
        var modul = MODULLER[d.tur];
        var veri;
        if (bicim === 'docx' && d.tur !== 'docx') {
          // PDF ve UDF belgeleri, temizlenmiş metinden yeni bir Word dosyasına dönüştürülür
          var liste = d.tur === 'pdf' ? d.bulgular.concat(elleBulgular(d)) : d.bulgular;
          veri = await S.wordUret.belgedenUret(d.belge.metin, liste, m, isaretle);
          ciktilar.push({ ad: ciktiAdi(d.ad, 'docx'), veri: veri, mime: S.docx.mime });
          continue;
        }
        if (d.tur === 'pdf') {
          d.belge.sayfalar.forEach(function (s, n) { s.elle = d.elle[n] || []; });
          veri = await modul.yaz(d.belge, d.bulgular, m, { dpi: dpi, ilerleme: function (a, b) { bildir('Temizleniyor: ' + d.ad + ' — sayfa ' + a + '/' + b); } });
        } else {
          // Word ve UDF belgeleri yazım sırasında değiştirildiğinden her seferinde özgün dosyadan yeniden okunur.
          var taze = await modul.oku(d.buf);
          veri = await modul.yaz(taze, d.bulgular, m, { isaretle: isaretle });
        }
        ciktilar.push({ ad: ciktiAdi(d.ad, modul.uzanti), veri: veri, mime: modul.mime });
      }
      if ($('#esleme').checked && m === 'etiket') {
        var satirlar = ['Etiket;Kategori;Özgün ifade;Belge'];
        var gorulen = {};
        hazir.forEach(function (d) {
          d.bulgular.forEach(function (b) {
            if (!b.secili) return;
            var k = b.etiket + '|' + b.text + '|' + d.ad;
            if (gorulen[k]) return; gorulen[k] = 1;
            satirlar.push([b.etiket, C.KATEGORILER[b.kat].ad, b.text.replace(/\s+/g, ' '), d.ad].map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(';'));
          });
        });
        ciktilar.push({ ad: 'suzgec_esleme_tablosu_GIZLI.csv', veri: new TextEncoder().encode('﻿' + satirlar.join('\r\n')), mime: 'text/csv' });
      }
      // Aynı adlı çıktılar (ör. ornek.pdf ve ornek.udf → Word) çakışmasın
      var kullanilan = {};
      ciktilar.forEach(function (c, i) {
        var ad = c.ad, kaynak = (hazir[i] && hazir[i].tur) || '', n = 2;
        if (kullanilan[ad] && kaynak) ad = c.ad.replace(/_suzgec\./, '_' + kaynak + '_suzgec.');
        while (kullanilan[ad]) ad = c.ad.replace(/\.([^.]+)$/, '_' + (n++) + '.$1');
        kullanilan[ad] = true; c.ad = ad;
      });
      if (ciktilar.length === 1) indirBaslat(ciktilar[0].veri, ciktilar[0].ad, ciktilar[0].mime);
      else {
        var zip = new JSZip();
        ciktilar.forEach(function (c) { zip.file(c.ad, c.veri); });
        indirBaslat(await zip.generateAsync({ type: 'blob' }), 'suzgec_ciktilar.zip', 'application/zip');
      }
      durum.indirildi = true;
      bildir(hazir.length + ' belge temizlendi ve ' + (bicim === 'docx' ? 'Word olarak ' : '') + 'indirildi' + (isaretle ? '; değiştirilen yerler çıktıda işaretlidir' : '') + '. Çıktıları paylaşmadan önce açarak kontrol etmeniz önerilir.', 'basari');
    } catch (e) {
      console.error(e);
      bildir('Temizleme sırasında bir hata oluştu: ' + (e.message || e), 'hata');
    } finally {
      $('#indir').disabled = false;
      adimlariCiz();
    }
  }

  function oturumuTemizle() {
    durum.dosyalar.forEach(function (d) { if (d.belge && d.belge.pdf) d.belge.pdf.destroy(); });
    durum.dosyalar = []; durum.tarandi = false; durum.indirildi = false; durum.tercih = {};
    $('#dosya-sec').value = ''; $('#ara').value = ''; durum.ara = '';
    bildir('Oturum temizlendi; yüklenen belgeler bellekten kaldırıldı.');
    ciz();
  }

  /* ---------- Başlangıç ---------- */

  function baslat() {
    var alan = $('#birak');
    $('#dosya-sec').addEventListener('change', function (e) { var liste = Array.prototype.slice.call(e.target.files); e.target.value = ''; dosyalariEkle(liste); });
    ['dragenter', 'dragover'].forEach(function (t) { alan.addEventListener(t, function (e) { e.preventDefault(); alan.classList.add('aktif'); }); });
    ['dragleave', 'drop'].forEach(function (t) { alan.addEventListener(t, function (e) { e.preventDefault(); alan.classList.remove('aktif'); }); });
    alan.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) dosyalariEkle(Array.prototype.slice.call(e.dataTransfer.files)); });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
    $('#tara').addEventListener('click', tara);
    $('#indir').addEventListener('click', indir);
    $('#temizle').addEventListener('click', oturumuTemizle);
    $$('input[name="mod"]').forEach(function (r) { r.addEventListener('change', function () { durum.indirildi = false; ciz(); }); });
    var araZaman = null;
    $('#ara').addEventListener('input', function (e) {
      clearTimeout(araZaman);
      araZaman = setTimeout(function () {
        durum.ara = e.target.value;
        if (durum.ara.trim()) durum.dosyalar.forEach(function (d) { d.ui.sekme = 'bulgular'; });
        ciz();
        $('#ara').focus();
      }, 180);
    });
    $('#onizleme-kapat').addEventListener('click', function () { $('#onizleme').close(); });
    $('#onizleme').addEventListener('close', function () { $('#onizleme-govde').innerHTML = ''; ciz(); });
    secimDugmesiBagla();
    $('#liste-disa').addEventListener('click', listeleriKaydet);
    $('#liste-ice').addEventListener('change', function (e) { listeleriYukle(e.target.files[0]); e.target.value = ''; });
    var csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    $('#ag-rozet').title = csp ? csp.getAttribute('content') : '';
    ciz();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat); else baslat();
  window.Suzgec.ui = { durum: durum, dosyalariEkle: dosyalariEkle, tara: tara, indir: indir };
})();
