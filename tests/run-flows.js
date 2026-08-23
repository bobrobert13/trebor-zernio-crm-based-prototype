'use strict';
/**
 * tests/run-flows.js — Runner de las suites del módulo Flujos (sin navegador).
 * Ejecuta cada suite en un proceso Node aislado (los IIFE del repo mutan
 * globals) y agrega el resultado. Exit 0 = todo verde.
 *
 * Uso: node tests/run-flows.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  { file: 'flows-unit.test.js', label: 'Unit (lógica pura)' },
  { file: 'flows-e2e-mock.test.js', label: 'E2E (mensaje → agente mock → guardrail)' },
];

let failed = 0;
for (const s of SUITES) {
  const res = spawnSync(process.execPath, [path.join(__dirname, s.file)], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  const ok = res.status === 0;
  console.log(`\n==== ${s.label} → ${ok ? 'PASÓ' : 'FALLÓ'} (exit ${res.status}) ====\n`);
  if (!ok) failed += 1;
}

console.log(failed === 0 ? 'Todas las suites pasaron ✓' : `${failed} suite(s) con fallos ✗`);
process.exit(failed === 0 ? 0 : 1);