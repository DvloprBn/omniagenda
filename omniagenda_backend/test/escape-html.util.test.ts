import { escapeHtml } from '../src/common/utils/escape-html.util';

describe('escapeHtml (defensa XSS en correos) — portado de OmniUser', () => {
  it('escapa los 5 caracteres peligrosos', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('neutraliza un payload de XSS completo', () => {
    const r = escapeHtml('<img src=x onerror=alert(1)>');
    expect(r).not.toContain('<img');
    expect(r).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('deja intacto el texto sin caracteres especiales', () => {
    expect(escapeHtml('Ana López')).toBe('Ana López');
  });

  it('escapa el ampersand ANTES que los demas (evita doble-escape)', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});
