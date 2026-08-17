/**
 * @file ui-services.js — Servicios de UI: mappers/formateadores de
 * presentación puros, sin estado y sin dependencias de dominio. Se cargan
 * tras helpers/domain y ANTES de shared.js/componentes. 1:1 con el
 * comportamiento previo.
 */
(function () {
  'use strict';

  /** tonalidad de `seqStatusTone` (badge de estado de secuencia). */
  function seqStatusTone(status) {
    return status === 'active' ? 'success' : status === 'paused' ? 'warn' : 'neutral';
  }

  /** Texto legible de un paso de secuencia (mensaje directo o plantilla). */
  function seqStepText(st) {
    return (st && ((st.message && st.message.text) || (st.template && st.template.name))) || 'Mensaje';
  }

  /** Retraso de un paso en formato corto ('Inmediato', '30 min', '24 h', '3 d'). */
  function formatSeqDelay(minutes) {
    const m = Number(minutes) || 0;
    if (m === 0) return 'Inmediato';
    if (m < 60) return `${m} min`;
    if (m < 1440) return `${Math.round(m / 60)} h`;
    return `${Math.round(m / 1440)} d`;
  }

  /** Duración total de la secuencia en minutos. */
  function seqTotalMinutes(seq) {
    return (seq && seq.steps || []).reduce((acc, s) => acc + (Number(s.delayMinutes) || 0), 0);
  }

  /** Minutos acumulados hasta el inicio de un paso (desde el primer mensaje). */
  function seqCumulative(seq, index) {
    return (seq && seq.steps || []).slice(0, index).reduce((acc, s) => acc + (Number(s.delayMinutes) || 0), 0);
  }

  /** Duración total en formato largo ('3 d 4 h'). */
  function formatSeqTotal(minutes) {
    const m = Number(minutes) || 0;
    if (m === 0) return '0 min';
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const mm = m % 60;
    const parts = [];
    if (d) parts.push(`${d} d`);
    if (h) parts.push(`${h} h`);
    if (mm) parts.push(`${mm} min`);
    return parts.join(' ');
  }

  /** Pantallas de un flow (JSON Meta 6.0 a nivel raíz o dentro de data). */
  function flowScreens(flow) {
    return (flow && (flow.screens || (flow.data && flow.data.screens) || [])) || [];
  }

  /** Campos del formulario de una pantalla. */
  function flowFields(screen) {
    const form = screen && screen.data && screen.data.form;
    return (form && form.fields) || [];
  }

  /** Footer del formulario de una pantalla (o vacío). */
  function flowFooter(screen) {
    const form = screen && screen.data && screen.data.form;
    return (form && form.footer) || '';
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    seqStatusTone, seqStepText, formatSeqDelay,
    seqTotalMinutes, seqCumulative, formatSeqTotal,
    flowScreens, flowFields, flowFooter,
  });
})();