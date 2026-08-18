/**
 * @file helpers.js — Composables/helpers generales e infrastructurales
 * reutilizables entre módulos. Se cargan tras constants/store/SDK y ANTES
 * de shared.js y componentes. Cero dependencias de dominio: solo Vue + window.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * Temporizador con limpieza en onUnmounted.
   * @returns {{timers:number[], later:(fn:Function, ms:number)=>number}}
   */
  function makeTimers() {
    /** Temporizadores activos (limpieza en onUnmounted). */
    const timers = [];
    function later(fn, ms) {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    }
    Vue.onUnmounted(() => timers.forEach(clearTimeout));
    return { timers, later };
  }

  /**
   * fetch con timeout via AbortController. El timer se limpia en finally.
   * Rechaza con AbortError si excede `ms`.
   * @param {string} url
   * @param {RequestInit} [init]
   * @param {number} [ms] timeout en ms.
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, init = {}, ms = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await window.fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Hash determinista (31 → u32) para series pseudo-aleatorias estables.
   * Coerce a string para tolerar ids numéricos.
   * @param {*} str
   * @returns {number}
   */
  function hashSeed(str) {
    return [...String(str)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  }

  /** Descarga un texto generando un Blob temporal (revocado tras 1 s). */
  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Parser CSV a filas de columnas (respeta comillas dobles con '').
   * @param {string} text
   * @returns {string[][]}
   */
  function parseCsv(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const cols = [];
        let cur = '';
        let inQ = false;
        for (const ch of line) {
          if (ch === '"') inQ = !inQ;
          else if (ch === ',' && !inQ) {
            cols.push(cur.trim());
            cur = '';
          } else cur += ch;
        }
        cols.push(cur.trim());
        return cols;
      });
  }

  /**
   * Intercambia dos posiciones adyacentes de un array por índice.
   * Muta `arr` en su lugar. Devuelve false si `dir` sale de rango.
   * @param {Array} arr
   * @param {number} i
   * @param {-1|1} dir
   * @returns {boolean}
   */
  function swapInPlace(arr, i, dir) {
    const next = i + dir;
    if (next < 0 || next >= arr.length) return false;
    [arr[i], arr[next]] = [arr[next], arr[i]];
    return true;
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeTimers, fetchWithTimeout, hashSeed, downloadText, parseCsv, swapInPlace,
  });
})();