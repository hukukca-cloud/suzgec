/*
 * Süzgeç — Düz metin işleyici
 * Yapıştırılan metinler ve .txt dosyaları için. Metin olduğu gibi okunur; temizlenmiş hâli
 * UTF-8 (BOM'lu) düz metin olarak yazılır.
 */
(function (root) {
  'use strict';

  function coz(arrayBuffer) {
    var bayt = new Uint8Array(arrayBuffer);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bayt); }
    catch (e) {
      // UTF-8 değilse Türkçe Windows kodlamasıyla dene
      try { return new TextDecoder('windows-1254').decode(bayt); } catch (e2) { return new TextDecoder('utf-8').decode(bayt); }
    }
  }

  async function oku(arrayBuffer) {
    var metin = coz(arrayBuffer).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var uyarilar = [];
    if (!metin.trim()) uyarilar.push('Metin boş görünüyor.');
    return { metin: metin, uyarilar: uyarilar };
  }

  function temizMetinUret(metin, bulgular, mod) {
    var C = root.Suzgec.core, parca = [], konum = 0;
    bulgular.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (b) {
      if (!b.secili || b.start < konum) return;
      parca.push(metin.slice(konum, b.start), C.yerineKonacak(b, mod));
      konum = b.end;
    });
    parca.push(metin.slice(konum));
    return parca.join('');
  }

  async function yaz(belge, bulgular, mod) {
    return new TextEncoder().encode('﻿' + temizMetinUret(belge.metin, bulgular, mod));
  }

  root.Suzgec = root.Suzgec || {};
  root.Suzgec.metin = { oku: oku, yaz: yaz, temizMetinUret: temizMetinUret, uzanti: 'txt', mime: 'text/plain;charset=utf-8' };
})(typeof self !== 'undefined' ? self : this);
