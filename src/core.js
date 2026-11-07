/*
 * Süzgeç — Tespit motoru
 * Metin üzerinde kişisel veri adaylarını tespit eder. Tamamen yerel çalışır;
 * hiçbir ağ çağrısı yapmaz, hiçbir veriyi saklamaz.
 */
(function (root) {
  'use strict';

  var adlarModulu = (typeof module !== 'undefined' && module.exports)
    ? require('./adlar.js')
    : root.Suzgec.adlar;

  var KATEGORILER = {
    ELLE:    { ad: 'Elle karartma',       etiket: 'KARARTMA', grup: 'ozel',    oncelik: 0 },
    OZEL:    { ad: 'Özel liste',          etiket: 'ÖZEL',     grup: 'ozel',    oncelik: 0 },
    IBAN:    { ad: 'IBAN',                etiket: 'IBAN',     grup: 'yapisal', oncelik: 1 },
    TCKN:    { ad: 'T.C. Kimlik No',      etiket: 'TCKN',     grup: 'yapisal', oncelik: 2 },
    EPOSTA:  { ad: 'E-posta',             etiket: 'E-POSTA',  grup: 'yapisal', oncelik: 3 },
    VKN:     { ad: 'Vergi Kimlik No',     etiket: 'VKN',      grup: 'yapisal', oncelik: 4 },
    TELEFON: { ad: 'Telefon',             etiket: 'TELEFON',  grup: 'yapisal', oncelik: 5 },
    PLAKA:   { ad: 'Araç plakası',        etiket: 'PLAKA',    grup: 'yapisal', oncelik: 6 },
    DOGUM:   { ad: 'Doğum tarihi',        etiket: 'DOĞUM-TARİHİ', grup: 'yapisal', oncelik: 7 },
    DOSYA:   { ad: 'Dosya numarası',      etiket: 'DOSYA-NO', grup: 'adres',   oncelik: 8 },
    ADRES:   { ad: 'Adres',               etiket: 'ADRES',    grup: 'adres',   oncelik: 9 },
    KISI:    { ad: 'Kişi adı',            etiket: 'KİŞİ',     grup: 'kisi',    oncelik: 10 }
  };

  var MASKE = '█████';

  /* ---------- Yardımcılar ---------- */

  // Türkçe kurallarla, uzunluğu koruyarak küçük harfe çevirir (konum eşlemesi bozulmaz).
  function trKucuk(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      var l = c.toLocaleLowerCase('tr');
      out += (l.length === 1) ? l : c;
    }
    return out;
  }
  function buyukMu(c) {
    return !!c && c !== c.toLocaleLowerCase('tr') && c === c.toLocaleUpperCase('tr');
  }
  function sadeceRakam(s) { return s.replace(/\D/g, ''); }
  function bosluksuz(s) { return s.replace(/\s+/g, ' ').trim(); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

  function kumeYap(liste) {
    var k = Object.create(null);
    liste.forEach(function (x) { if (x) k[x] = true; });
    return k;
  }

  var ADLAR = kumeYap(adlarModulu.ADLAR);
  var BELIRSIZ = kumeYap(adlarModulu.BELIRSIZ);

  /* ---------- Doğrulama algoritmaları ---------- */

  function tcknGecerli(s) {
    if (!/^[1-9]\d{10}$/.test(s)) return false;
    var d = s.split('').map(Number);
    var tek = d[0] + d[2] + d[4] + d[6] + d[8];
    var cift = d[1] + d[3] + d[5] + d[7];
    var d10 = ((tek * 7 - cift) % 10 + 10) % 10;
    if (d10 !== d[9]) return false;
    var top = 0; for (var i = 0; i < 10; i++) top += d[i];
    return top % 10 === d[10];
  }

  function vknGecerli(s) {
    if (!/^\d{10}$/.test(s)) return false;
    var d = s.split('').map(Number), top = 0;
    for (var i = 0; i < 9; i++) {
      var t = (d[i] + 10 - (i + 1)) % 10;
      var v = (t * Math.pow(2, 10 - (i + 1))) % 9;
      if (t !== 0 && v === 0) v = 9;
      top += v;
    }
    return ((10 - (top % 10)) % 10) === d[9];
  }

  function ibanGecerli(s) {
    var x = s.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(x)) return false;
    if (x.slice(0, 2) === 'TR' && x.length !== 26) return false;
    var r = x.slice(4) + x.slice(0, 4), kalan = 0;
    for (var i = 0; i < r.length; i++) {
      var c = r.charCodeAt(i);
      var parca = (c >= 65 && c <= 90) ? String(c - 55) : r[i];
      for (var j = 0; j < parca.length; j++) kalan = (kalan * 10 + (parca.charCodeAt(j) - 48)) % 97;
    }
    return kalan === 1;
  }

  /* ---------- Sözlükler ---------- */

  var KURUM_KELIMELERI = kumeYap((
    'üniversitesi üniversite fakültesi lisesi okulu koleji enstitüsü vakfı vakfi derneği odası barosu ' +
    'mahkemesi mahkeme dairesi daire müdürlüğü başkanlığı bakanlığı bakanlık kurumu kurulu kurul belediyesi belediye valiliği ' +
    'kaymakamlığı savcılığı başsavcılığı cumhuriyet cumhuriyeti hastanesi hastane merkezi merkez parkı stadyumu camii köprüsü ' +
    'caddesi cadde sokağı sokak bulvarı mahallesi meydanı havalimanı limanı istasyonu ' +
    'ticaret sanayi limited ltd şti şirketi şirket anonim a.ş holding bankası banka grubu inşaat gıda turizm tekstil ' +
    'yayınları yayınevi hukuk bürosu ortaklığı kooperatifi sigorta sigortası enerji teknoloji yazılım danışmanlık lojistik ' +
    'partisi meclisi kanunu kanun yönetmeliği tebliği kararı kararname'
  ).split(/\s+/));

  // Tetikleyiciden sonra kişi adı yerine geçebilecek, ad olmayan kelimeler
  var ROL_KELIMELERI = kumeYap((
    'vekili vekilleri vekil av avukat avukatı dr doç prof öğr gör sayın sn bay bayan hanım bey ' +
    'asil asiller müvekkil müvekkili müvekkilimiz yönünden adına tarafından vekaleten'
  ).split(/\s+/));

  var DURDUR = kumeYap((
    'mahkeme mahkemesi mahkemeye heyet heyeti hakim hâkim hakimi yargıç savcılık savcı taraf taraflar kurum kurumu idare idaresi ' +
    'şirket şirketi banka bankası bakanlık bakanlığı belediye belediyesi işveren işçi sgk hazine hazinesi maliye vergi dairesi ' +
    'davacı davalı davacılar davalılar sanık sanıklar müşteki şüpheli katılan mağdur tanık bilirkişi müdahil ' +
    'adres adresi konu konusu tarih tarihi dava davası esas karar no numara tc t.c vkn tckn iban tel telefon e-posta ' +
    'özet açıklamalar sonuç talep netice hukuki deliller ilgi sayı tebliğ tebligat dilekçe cevap ' +
    'türkiye türk devlet cumhuriyet cumhuriyeti ankara istanbul izmir ve ile veya ise de da ki bu şu o'
  ).split(/\s+/));

  var TETIKLEYICILER = [
    'adı soyadı', 'adı ve soyadı', 'ad soyad', 'ad-soyad', 'ana adı', 'anne adı', 'baba adı',
    'davacılar', 'davalılar', 'davacı', 'davalı', 'sanıklar', 'sanık', 'müştekiler', 'müşteki', 'şüpheliler', 'şüpheli',
    'katılanlar', 'katılan', 'mağdurlar', 'mağdur', 'tanıklar', 'tanık', 'bilirkişiler', 'bilirkişi', 'müdahil',
    'suçtan zarar gören', 'şikayetçi', 'şikâyetçi', 'ihbar eden', 'talep eden', 'karşı taraf', 'hasım',
    'müvekkilimiz', 'müvekkili', 'müvekkil', 'vekili', 'vekilleri', 'av.', 'avukat',
    'sayın', 'bay', 'bayan', 'sn.', 'hakim', 'hâkim', 'katip', 'kâtip', 'zabıt katibi', 'başkan', 'üye',
    'mirasçı', 'mirasçılar', 'muris', 'murisi', 'müteveffa', 'borçlu', 'alacaklı', 'kiracı', 'kiraya veren', 'kefil',
    'işçi', 'çalışan', 'personel', 'imza', 'adı', 'soyadı'
  ];
  var TEK_KELIMELIK = kumeYap(['ana adı', 'anne adı', 'baba adı', 'adı', 'soyadı']);

  var AYLAR = 'ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık';
  var TARIH = '(?:\\d{1,2}[.\\/-]\\d{1,2}[.\\/-](?:19|20)\\d{2}|\\d{1,2}\\s+(?:' + AYLAR + ')\\s+(?:19|20)\\d{2})';

  var EMSAL_BAGLAMI = /(yargıtay|danıştay|anayasa mahkemesi|uyuşmazlık mahkemesi|bölge adliye|bölge idare|\bbam\b|\bbim\b|hukuk dairesi|ceza dairesi|\bh\.?\s?d\.?|\bc\.?\s?d\.?|\bhgk\b|\bcgk\b|\bibk\b|\bihgk\b|\bikgk\b|emsal|içtihat|bkz\.?)/;

  var HUKUK_KISALTMALARI = kumeYap('HD CD HGK CGK BK TBK TMK TCK CMK HMK IIK İİK MK DK VUK KVK SK IK AYM AY TTK HUMK IYUK İYUK AİHM AIHM AİHS ESAS KARAR E K'.split(' '));

  /* ---------- Bulgu üretimi ---------- */

  function bulgu(kat, start, end, text, ekstra) {
    var b = { kat: kat, start: start, end: end, text: text.slice(start, end), secili: true, oncelik: KATEGORILER[kat].oncelik };
    if (ekstra) for (var k in ekstra) b[k] = ekstra[k];
    if (!b.anahtar) b.anahtar = kat + '|' + trKucuk(bosluksuz(b.text));
    return b;
  }

  function tara(re, s, fn) {
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(s)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      fn(m);
    }
  }

  /* ---------- Yapısal veriler ---------- */

  function yapisalBul(text, low, out) {
    // IBAN
    tara(/(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?(?![A-Za-z0-9])/g, text, function (m) {
      if (ibanGecerli(m[0])) out.push(bulgu('IBAN', m.index, m.index + m[0].length, text, { anahtar: 'IBAN|' + m[0].replace(/\s+/g, '') }));
    });
    // TCKN
    tara(/(?<![\d])[1-9]\d{10}(?!\d)/g, text, function (m) {
      if (tcknGecerli(m[0])) out.push(bulgu('TCKN', m.index, m.index + 11, text));
    });
    // E-posta
    tara(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, text, function (m) {
      out.push(bulgu('EPOSTA', m.index, m.index + m[0].length, text, { anahtar: 'EPOSTA|' + m[0].toLowerCase() }));
    });
    // VKN (yalnızca bağlam varsa: vergi kimlik / VKN / vergi no)
    tara(/(?<![\d])\d{10}(?!\d)/g, text, function (m) {
      if (!vknGecerli(m[0])) return;
      var once = low.slice(Math.max(0, m.index - 45), m.index);
      if (/(vergi\s*(kimlik)?\s*(no|numarası|numarasi)?|v\.?\s?k\.?\s?n\.?|vkn)\s*[:.\-]?\s*$/.test(once) || /vergi/.test(once)) {
        out.push(bulgu('VKN', m.index, m.index + 10, text, { oncelik: 3.5 }));
      }
    });
    // Telefon
    tara(/(?<![\d+])(?:\+?90[\s.-]?|0[\s.-]?)?\(?[2-58]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/g, text, function (m) {
      var r = sadeceRakam(m[0]);
      var cekirdek = r.slice(-10);
      if (cekirdek.length !== 10) return;
      out.push(bulgu('TELEFON', m.index, m.index + m[0].length, text, { anahtar: 'TELEFON|' + cekirdek }));
    });
    // Plaka
    tara(/(?<![\p{L}\d\/.])(0[1-9]|[1-7]\d|8[01])\s?([A-Z]{1,3})\s?(\d{2,4})(?![\p{L}\d\/.,]\d|[\p{L}\d\/])/gu, text, function (m) {
      var harf = m[2], rakam = m[3];
      if (HUKUK_KISALTMALARI[harf]) return;
      var gecerli = (harf.length === 1 && rakam.length === 4) ||
                    (harf.length === 2 && (rakam.length === 3 || rakam.length === 4)) ||
                    (harf.length === 3 && (rakam.length === 2 || rakam.length === 3));
      if (!gecerli) return;
      out.push(bulgu('PLAKA', m.index, m.index + m[0].length, text, { anahtar: 'PLAKA|' + m[0].replace(/\s+/g, '') }));
    });
    // Doğum tarihi (bağlamlı)
    var reDogum1 = new RegExp('(?<=(?:doğum\\s+tarihi|doğum\\s+yeri\\s*(?:ve|\\/|-)\\s*tarihi\\s*[:\\-]?\\s*[\\p{L} ]{0,25}?|d\\.\\s?t\\.|doğ\\.\\s?tar?\\.?)\\s*[:\\-]?\\s*)' + TARIH, 'gu');
    tara(reDogum1, low, function (m) {
      out.push(bulgu('DOGUM', m.index, m.index + m[0].length, text));
    });
    var reDogum2 = new RegExp('(?:' + TARIH + '|(?<!\\d)(?:19|20)\\d{2})(?=\\s*(?:doğumlu|d\\.\\s?lu|doğ\\.))', 'gu');
    tara(reDogum2, low, function (m) {
      out.push(bulgu('DOGUM', m.index, m.index + m[0].length, text));
    });
  }

  /* ---------- Dosya numaraları ---------- */

  function dosyaBul(text, low, out) {
    var isaret = '(?:esas|karar|e\\.|k\\.|dosya|soruşturma|sor\\.|talimat|d\\.\\s?iş|muhabere|takip|icra)';
    var re1 = new RegExp('(?<=' + isaret + '\\s*(?:no|numarası|numarasi|sayısı|sayisi|sayı)?\\s*[:.]?\\s*)(?:19|20)\\d{2}\\s*\\/\\s*\\d{1,7}(?!\\d)', 'gu');
    var re2 = new RegExp('(?<![\\d\\/])(?:19|20)\\d{2}\\s*\\/\\s*\\d{1,7}(?=\\s*(?:e\\.|k\\.|esas|karar|sor\\.|soruşturma|d\\.\\s?iş|talimat|hz\\.|tal\\.)(?![\\p{L}]))', 'gu');
    [re1, re2].forEach(function (re) {
      tara(re, low, function (m) {
        var once = low.slice(Math.max(0, m.index - 70), m.index);
        var emsal = EMSAL_BAGLAMI.test(once);
        out.push(bulgu('DOSYA', m.index, m.index + m[0].length, text, {
          secili: !emsal,
          not: emsal ? 'Emsal karar künyesi olabilir; varsayılan olarak seçilmedi.' : undefined,
          anahtar: 'DOSYA|' + m[0].replace(/\s+/g, '')
        }));
      });
    });
  }

  /* ---------- Adresler ---------- */

  var SOKAK_KELIMELERI = '(?:mahallesi|mahalle|mah\\.|mh\\.|caddesi|cadde|cad\\.|cd\\.|sokağı|sokak|sok\\.|sk\\.|bulvarı|bulvar|blv\\.|bulv\\.|köyü|meydanı|küme\\s+evler|sitesi|apartmanı|apt\\.|plaza|rezidans|blok|blk\\.)';

  var ADRES_DUR = kumeYap(('adres adresi adresinde adresli ikametgah ikametgahı ikamet mukim davacı davalı sanık müşteki şüpheli ' +
    'tanık vekili av avukat tebligat tebligata kayıtlı yerleşim yeri').split(/\s+/));

  function adresBul(text, low, out) {
    var parcalar = [];
    // Sokak tipi kelimeler + önceki büyük harfli kelimeler
    tara(new RegExp('(?<![\\p{L}])' + SOKAK_KELIMELERI + '(?![\\p{L}])', 'gu'), low, function (m) {
      var bas = m.index;
      // Geriye doğru en fazla 4 kelime (büyük harf veya rakamla başlayan)
      for (var k = 0; k < 4; k++) {
        var once = text.slice(0, bas);
        var mm = /([\p{L}\p{N}][\p{L}\p{N}.'’-]*)([ \t ]+)$/u.exec(once);
        if (!mm) break;
        var kelime = mm[1];
        if (!(buyukMu(kelime[0]) || /\d/.test(kelime[0]))) break;
        if (ADRES_DUR[trKucuk(kelime).replace(/[.:]$/, '')]) break;
        bas = bas - mm[0].length;
      }
      parcalar.push({ s: bas, e: m.index + m[0].length, sokak: true });
    });
    // Kapı/daire/kat numaraları
    tara(/(?<![\p{L}])(?:kapı\s+no|no|numara|daire|kat|d|k)\s*[:.]\s*\d+[a-zçğıöşü]?(?:\s*\/\s*\d+[a-zçğıöşü]?)?(?![\p{L}\d])|(?<![\p{L}])(?:no|numara|daire|kat)\s+\d+[a-zçğıöşü]?(?![\p{L}\d])/gu, low, function (m) {
      parcalar.push({ s: m.index, e: m.index + m[0].length });
    });
    // İlçe/İl
    tara(/(?<![\p{L}])[\p{Lu}][\p{L}]+\s*\/\s*[\p{Lu}][\p{L}]+(?![\p{L}])/gu, text, function (m) {
      parcalar.push({ s: m.index, e: m.index + m[0].length, ilce: true });
    });
    // Posta kodu
    tara(/(?<![\d])\d{5}(?![\d])/g, text, function (m) {
      parcalar.push({ s: m.index, e: m.index + 5, posta: true });
    });

    parcalar.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var kume = null, kumeler = [];
    parcalar.forEach(function (p) {
      if (kume && p.s <= kume.e + 4 && /^[\s,.;:\-–]*$/.test(text.slice(kume.e, Math.max(kume.e, p.s)))) {
        kume.e = Math.max(kume.e, p.e);
        kume.sokak = kume.sokak || p.sokak;
        kume.n++;
      } else {
        if (kume) kumeler.push(kume);
        kume = { s: p.s, e: p.e, sokak: !!p.sokak, n: 1 };
      }
    });
    if (kume) kumeler.push(kume);
    kumeler.forEach(function (k) {
      if (!k.sokak) return;
      var e = k.e;
      while (e > k.s && /[\s,.;:\-–]/.test(text[e - 1])) e--;
      // "Mah." gibi kısaltmaların noktası korunur
      if (/(mah|mh|cad|cd|sok|sk|blv|bulv|apt|blk)$/i.test(text.slice(k.s, e)) && text[e] === '.') e++;
      if (e - k.s < 6) return;
      out.push(bulgu('ADRES', k.s, e, text));
    });
  }

  /* ---------- Kişi adları ---------- */

  var KELIME_RE = /[\p{L}][\p{L}'’]*/gu;

  function kelimeler(text) {
    var liste = [];
    tara(KELIME_RE, text, function (m) {
      var w = m[0].replace(/['’].*$/, '');
      if (w) liste.push({ w: w, s: m.index, e: m.index + w.length, lw: trKucuk(w) });
    });
    return liste;
  }

  var DURDUR_KOKLERI = ['mahkeme', 'heyet', 'makam', 'yüce', 'kurum', 'idare', 'şirket', 'banka', 'bakanlı', 'belediye',
    'müdürlü', 'savcılı', 'başkanlı', 'cumhuriyet', 'türkiye', 'devlet', 'hazine', 'sgk', 'davacı', 'davalı',
    'hakim', 'hâkim', 'hakimli', 'yargı', 'daire', 'kalem', 'heyet', 'sayın', 'vekalet', 'müvekkil'];
  function durdurMu(lw) {
    if (DURDUR[lw] || KURUM_KELIMELERI[lw] || ROL_KELIMELERI[lw]) return true;
    for (var i = 0; i < DURDUR_KOKLERI.length; i++) if (lw.indexOf(DURDUR_KOKLERI[i]) === 0) return true;
    return false;
  }
  function adKelimesiMi(k) {
    return buyukMu(k.w[0]) && k.w.length >= 2 && !durdurMu(k.lw);
  }
  function sadeBoslukMu(text, a, b) { return /^[ \t ]+$/.test(text.slice(a, b)); }

  function kisiBul(text, low, out, ayarlar) {
    var K = kelimeler(text);
    var adaylar = [];

    function diziyiGenislet(i, enFazla) {
      var j = i;
      while (j + 1 < K.length && (j - i + 1) < enFazla && sadeBoslukMu(text, K[j].e, K[j + 1].s) && adKelimesiMi(K[j + 1])) j++;
      // Kurum adı kontrolü: dizinin hemen ardından kurum kelimesi geliyorsa (ör. "Mehmet Akif Ersoy Üniversitesi") kişi sayılmaz
      if (j + 1 < K.length && sadeBoslukMu(text, K[j].e, K[j + 1].s) && KURUM_KELIMELERI[K[j + 1].lw]) return -1;
      return j;
    }

    // A) Sözlük tabanlı: bilinen ad + en az bir büyük harfli kelime
    for (var i = 0; i < K.length; i++) {
      var k = K[i];
      if (!buyukMu(k.w[0]) || !ADLAR[k.lw] || BELIRSIZ[k.lw]) continue;
      if (i > 0 && sadeBoslukMu(text, K[i - 1].e, k.s) && adKelimesiMi(K[i - 1]) && !ADLAR[K[i - 1].lw]) {
        // Önceki kelime ad değil ama büyük harfli (ör. "Atatürk Ahmet") — yine de bu konumdan başlat
      }
      var j = diziyiGenislet(i, 4);
      if (j < 0) { continue; }
      if (j === i) continue; // tek kelime: bağlam yoksa işaretlenmez
      adaylar.push({ s: k.s, e: K[j].e, kaynak: 'sozluk' });
      i = j;
    }

    // B) Bağlam tabanlı: davacı, sanık, vekili Av. vb.
    var trigRe = new RegExp('(?<![\\p{L}])(' + TETIKLEYICILER.map(escRe).sort(function (a, b) { return b.length - a.length; }).join('|') + ')(?![\\p{L}])', 'gu');
    tara(trigRe, low, function (m) {
      var tek = !!TEK_KELIMELIK[m[1]];
      var p = m.index + m[0].length;
      // Sıra numarası, iki nokta, tire ve rol/unvan kelimelerini atla
      var ilk = -1;
      for (var guard = 0; guard < 8; guard++) {
        var bosluk = /^[\s:.\-–)(,]*(?:\d{1,2}[-.)]\s*)?/u.exec(text.slice(p))[0];
        p += bosluk.length;
        var idx = K.findIndex(function (x) { return x.s === p; });
        if (idx < 0) break;
        if (ROL_KELIMELERI[K[idx].lw] || ROL_KELIMELERI[K[idx].lw.replace(/\.$/, '')]) { p = K[idx].e; continue; }
        if (adKelimesiMi(K[idx])) ilk = idx;
        break;
      }
      if (ilk < 0) return;
      var son = diziyiGenislet(ilk, tek ? 2 : 4);
      if (son < 0) return;
      adaylar.push({ s: K[ilk].s, e: K[son].e, kaynak: 'baglam' });
    });

    // Çakışan adayları birleştir
    adaylar.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var birlesik = [];
    adaylar.forEach(function (a) {
      var son = birlesik[birlesik.length - 1];
      if (son && a.s < son.e) { son.e = Math.max(son.e, a.e); return; }
      birlesik.push({ s: a.s, e: a.e });
    });

    var kisiler = [];
    birlesik.forEach(function (a) {
      var b = bulgu('KISI', a.s, a.e, text);
      kisiler.push(b);
      out.push(b);
    });

    // C) Yayılım: tespit edilen tam adın ve soyadının diğer geçişleri
    var tamlar = Object.create(null), soyadlar = Object.create(null);
    kisiler.forEach(function (b) {
      var norm = trKucuk(bosluksuz(b.text));
      tamlar[norm] = b.anahtar;
      var parca = norm.split(' ');
      if (parca.length >= 2) {
        var sa = parca[parca.length - 1];
        if (sa.length >= 3 && !DURDUR[sa]) {
          if (soyadlar[sa] && soyadlar[sa] !== b.anahtar) soyadlar[sa] = null; // belirsiz: aynı soyadlı birden çok kişi
          else if (soyadlar[sa] !== null) soyadlar[sa] = b.anahtar;
        }
      }
    });
    (ayarlar.ekKisiler || []).forEach(function (k) {
      if (!tamlar[k.norm]) tamlar[k.norm] = k.anahtar;
      var parca = k.norm.split(' ');
      var sa = parca[parca.length - 1];
      if (parca.length >= 2 && sa.length >= 3 && !DURDUR[sa] && soyadlar[sa] === undefined) soyadlar[sa] = k.anahtar;
    });
    Object.keys(tamlar).forEach(function (norm) {
      var re = new RegExp('(?<![\\p{L}])' + escRe(norm).replace(/ /g, '\\s+') + '(?![\\p{L}])', 'gu');
      tara(re, low, function (m) {
        out.push(bulgu('KISI', m.index, m.index + m[0].length, text, { anahtar: tamlar[norm] }));
      });
    });
    if (ayarlar.soyadYayilimi !== false) {
      Object.keys(soyadlar).forEach(function (sa) {
        if (!soyadlar[sa]) return;
        var re = new RegExp('(?<![\\p{L}])' + escRe(sa) + '(?![\\p{L}])', 'gu');
        tara(re, low, function (m) {
          if (!buyukMu(text[m.index])) return;
          out.push(bulgu('KISI', m.index, m.index + m[0].length, text, { anahtar: soyadlar[sa], not: 'Soyadı tekrarı' }));
        });
      });
    }
  }

  /* ---------- Özel liste ---------- */

  function listeTemizle(liste) {
    return (liste || []).map(function (x) { return bosluksuz(String(x)); }).filter(function (x) { return x.length >= 2; });
  }

  function ozelBul(text, low, out, liste) {
    listeTemizle(liste).forEach(function (terim) {
      var t = trKucuk(terim);
      var re = new RegExp('(?<![\\p{L}\\p{N}])' + escRe(t).replace(/ /g, '\\s+') + '(?![\\p{L}\\p{N}])', 'gu');
      tara(re, low, function (m) {
        out.push(bulgu('OZEL', m.index, m.index + m[0].length, text, { anahtar: 'OZEL|' + t }));
      });
    });
  }

  /* ---------- Ana işlev ---------- */

  /**
   * @param {string} text
   * @param {object} ayarlar { kapsam: {yapisal, kisi, adres, ozel}, ozelListe: [], haricListe: [] }
   * @returns {Array} bulgular — {kat, start, end, text, anahtar, secili, not}
   */
  function tespitEt(text, ayarlar) {
    ayarlar = ayarlar || {};
    var kapsam = ayarlar.kapsam || { yapisal: true, kisi: true, adres: true, ozel: true };
    var low = trKucuk(text);
    var ham = [];
    if (kapsam.ozel !== false) ozelBul(text, low, ham, ayarlar.ozelListe);
    if (kapsam.yapisal !== false) yapisalBul(text, low, ham);
    if (kapsam.adres !== false) { dosyaBul(text, low, ham); adresBul(text, low, ham); }
    if (kapsam.kisi !== false) kisiBul(text, low, ham, ayarlar);

    // Hariç tutulacak ifadeler
    var haric = [];
    listeTemizle(ayarlar.haricListe).forEach(function (terim) {
      var re = new RegExp('(?<![\\p{L}\\p{N}])' + escRe(trKucuk(terim)).replace(/ /g, '\\s+') + '(?![\\p{L}\\p{N}])', 'gu');
      tara(re, low, function (m) { haric.push([m.index, m.index + m[0].length]); });
    });
    ham = ham.filter(function (b) {
      return !haric.some(function (h) { return b.start >= h[0] && b.end <= h[1]; });
    });

    // Çakışma çözümü: önce öncelik, sonra uzunluk
    ham.sort(function (a, b) { return a.oncelik - b.oncelik || (b.end - b.start) - (a.end - a.start) || a.start - b.start; });
    var kabul = [];
    ham.forEach(function (b) {
      for (var i = 0; i < kabul.length; i++) {
        if (b.start < kabul[i].end && kabul[i].start < b.end) return;
      }
      kabul.push(b);
    });
    kabul.sort(function (a, b) { return a.start - b.start; });
    return kabul;
  }

  /* ---------- Etiketleme ve uygulama ---------- */

  /** Bir bulgu listesinden, diğer belgelerde de aranacak tam kişi adlarını çıkarır. */
  function kisiListesi(bulgular) {
    var gorulen = Object.create(null), liste = [];
    bulgular.forEach(function (b) {
      if (b.kat !== 'KISI' || b.not) return;
      var norm = trKucuk(bosluksuz(b.text));
      if (norm.indexOf(' ') < 0 || gorulen[norm]) return;
      gorulen[norm] = true;
      liste.push({ norm: norm, anahtar: b.anahtar });
    });
    return liste;
  }

  /** Tüm dosyalardaki bulgulara tutarlı etiket atar: aynı kişi her yerde aynı etiketi alır. */
  function etiketAta(bulguListeleri) {
    var sayac = Object.create(null), harita = Object.create(null);
    bulguListeleri.forEach(function (liste) {
      liste.forEach(function (b) {
        if (!harita[b.anahtar]) {
          sayac[b.kat] = (sayac[b.kat] || 0) + 1;
          harita[b.anahtar] = '[' + KATEGORILER[b.kat].etiket + '-' + sayac[b.kat] + ']';
        }
        b.etiket = harita[b.anahtar];
      });
    });
    return harita;
  }

  function yerineKonacak(b, mod) { return mod === 'etiket' ? b.etiket : MASKE; }

  /** Düz metne seçili bulguları uygular. Değişiklik listesini (eski/yeni konum) de döndürür. */
  function metneUygula(text, bulgular, mod) {
    var secili = bulgular.filter(function (b) { return b.secili; }).sort(function (a, b) { return a.start - b.start; });
    var parca = [], degisiklik = [], son = 0;
    secili.forEach(function (b) {
      if (b.start < son) return;
      parca.push(text.slice(son, b.start));
      var yeni = yerineKonacak(b, mod);
      degisiklik.push({ start: b.start, end: b.end, yeni: yeni });
      parca.push(yeni);
      son = b.end;
    });
    parca.push(text.slice(son));
    return { metin: parca.join(''), degisiklik: degisiklik };
  }

  /** Eski metindeki bir konumu, değişiklikler sonrası yeni metindeki konuma eşler. */
  function konumEsle(degisiklik) {
    return function (pos, sonMu) {
      var kayma = 0;
      for (var i = 0; i < degisiklik.length; i++) {
        var d = degisiklik[i];
        if (pos <= d.start) break;
        if (pos >= d.end) { kayma += d.yeni.length - (d.end - d.start); continue; }
        // Değişikliğin içine düşen konum: yeni metnin sonuna eşlenir; böylece değiştirilen metin,
        // değişikliğin başladığı öğeye ait kalır ve öğeler çakışmaz.
        return d.start + kayma + d.yeni.length;
      }
      return pos + kayma;
    };
  }

  var api = {
    KATEGORILER: KATEGORILER, MASKE: MASKE,
    tespitEt: tespitEt, kisiListesi: kisiListesi, etiketAta: etiketAta, metneUygula: metneUygula, konumEsle: konumEsle,
    yerineKonacak: yerineKonacak, trKucuk: trKucuk,
    _dogrula: { tcknGecerli: tcknGecerli, vknGecerli: vknGecerli, ibanGecerli: ibanGecerli }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Suzgec = root.Suzgec || {}; root.Suzgec.core = api; }
})(typeof self !== 'undefined' ? self : this);
