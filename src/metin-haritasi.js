/*
 * Süzgeç — XML metin düğümü haritası
 * Birden çok XML öğesine bölünmüş metni (ör. Word'deki "run"lar) tek bir metin gibi
 * taramaya ve bulunan değişiklikleri yeniden ilgili öğelere dağıtmaya yarar.
 */
(function (root) {
  'use strict';

  function MetinHaritasi() {
    this.parcalar = [];   // metin taşıyan öğeler
    this.harita = [];     // her karakter için {p: parçaNo, o: ofset} veya null (ayırıcı)
    this.metin = '';
    this._buf = [];
  }

  MetinHaritasi.prototype.ekle = function (el) {
    var t = el.textContent || '';
    var p = this.parcalar.length;
    this.parcalar.push(el);
    for (var i = 0; i < t.length; i++) this.harita.push({ p: p, o: i });
    this._buf.push(t);
  };

  MetinHaritasi.prototype.ayirici = function (s) {
    for (var i = 0; i < s.length; i++) this.harita.push(null);
    this._buf.push(s);
  };

  MetinHaritasi.prototype.bitir = function () {
    this.metin = this._buf.join('');
    this._buf = null;
    return this.metin;
  };

  /**
   * Seçili bulguları uygular. Yerine konacak metin, bulgunun başladığı öğeye yazılır;
   * bulgunun diğer öğelere taşan kısmı o öğelerden silinir.
   * @param {Array} bulgular
   * @param {function} yeniMetin bulgu -> string
   * @param {function} [degistiginde] (öğe) -> void  (ör. xml:space="preserve" eklemek için) ya da
   *        (öğe, bölütler) -> boolean  — bölütleri kendisi yazarsa true döndürür (ör. değişen kısmı vurgulamak için)
   */
  MetinHaritasi.prototype.uygula = function (bulgular, yeniMetin, degistiginde) {
    var duzenlemeler = {}; // parçaNo -> [{a, b, yeni}]
    var self = this;
    bulgular.forEach(function (bf) {
      if (!bf.secili) return;
      var ilk = true, aktif = null;
      for (var i = bf.start; i < bf.end; i++) {
        var h = self.harita[i];
        if (!h) continue;
        if (!aktif || aktif.p !== h.p) {
          aktif = { p: h.p, a: h.o, b: h.o + 1, yeni: ilk ? yeniMetin(bf) : '' };
          ilk = false;
          (duzenlemeler[h.p] = duzenlemeler[h.p] || []).push(aktif);
        } else {
          aktif.b = h.o + 1;
        }
      }
    });
    Object.keys(duzenlemeler).forEach(function (p) {
      var el = self.parcalar[p];
      var eski = el.textContent || '';
      var liste = duzenlemeler[p].sort(function (x, y) { return x.a - y.a; });
      // Metni, değişmeyen ve değiştirilen parçalardan oluşan bölütlere ayır
      var bolutler = [], konum = 0;
      liste.forEach(function (d) {
        if (d.a > konum) bolutler.push({ metin: eski.slice(konum, d.a), degisti: false });
        if (d.yeni) bolutler.push({ metin: d.yeni, degisti: true });
        konum = d.b;
      });
      if (konum < eski.length) bolutler.push({ metin: eski.slice(konum), degisti: false });
      if (typeof degistiginde === 'function' && degistiginde.length >= 2 && degistiginde(el, bolutler)) return;
      el.textContent = bolutler.map(function (b) { return b.metin; }).join('');
      if (degistiginde) degistiginde(el);
    });
  };

  root.Suzgec = root.Suzgec || {};
  root.Suzgec.MetinHaritasi = MetinHaritasi;
})(typeof self !== 'undefined' ? self : this);
