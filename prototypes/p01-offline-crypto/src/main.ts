import './style.css';
import { runSmokeCheck, type SmokeReport } from './smoke-check';

// Rendering uses textContent only: no HTML is ever built from strings.

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

function renderReport(report: SmokeReport, container: HTMLElement): void {
  const table = element('table');
  const head = table.createTHead().insertRow();
  for (const title of ['API', 'Presenza', 'Dettaglio']) head.append(element('th', title));
  const body = table.createTBody();
  for (const check of report.checks) {
    const row = body.insertRow();
    row.append(
      element('td', check.label),
      element('td', check.status === 'ok' ? 'Esposta' : 'Non esposta', `status status-${check.status}`),
      element('td', check.detail),
    );
  }

  const summary = element(
    'p',
    report.allApisExposed
      ? 'Tutte le API controllate risultano esposte (solo presenza).'
      : 'Una o più API controllate non risultano esposte.',
    report.allApisExposed ? 'summary summary-ok' : 'summary summary-fail',
  );
  const scope = element(
    'p',
    'Evidenza ambientale ENV-00: il supporto effettivo degli algoritmi non è verificato e nessuna prova ' +
      'crittografica è stata eseguita. Questo report non vale come evidenza per i test P01-xx.',
    'scope-note',
  );

  const json = element('pre', JSON.stringify(report, null, 2));
  container.replaceChildren(summary, scope, table, element('h2', 'Report ENV-00 per la riproducibilità'), json);
}

const container = document.querySelector<HTMLElement>('#smoke-report');
if (container === null) throw new Error('Missing #smoke-report container');

renderReport(
  runSmokeCheck({
    isSecureContext: globalThis.isSecureContext,
    crypto: globalThis.crypto,
    indexedDB: globalThis.indexedDB,
    navigator: globalThis.navigator,
    location: globalThis.location,
  }),
  container,
);
