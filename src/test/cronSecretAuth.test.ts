import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

/**
 * Regressione: incidente del 2026-07-22.
 *
 * Il commit "Fixed security issues" ha aggiunto alle edge function cron un
 * controllo di questo tipo:
 *
 *   const cronSecret = Deno.env.get("CRON_SECRET");
 *   if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) -> 401
 *
 * La env var CRON_SECRET non e' mai stata configurata su Supabase, mentre i job
 * pg_cron e il trigger notify_on_new_alert inviano il segreto preso dal Vault
 * (vault.decrypted_secrets, name = 'cron_secret'). Risultato: 401 su ogni
 * chiamata, prezzi sottostanti/opzioni fermi, alert e notifiche bloccati.
 *
 * Questi test bloccano il ritorno del pattern "solo env var": la validazione
 * deve sempre poter ricadere sulla RPC verify_cron_secret, che legge il Vault
 * (unica fonte di verita', condivisa con i chiamanti).
 */

const FUNCTIONS_DIR = path.resolve(__dirname, '../../supabase/functions');

const CRON_AUTHENTICATED_FUNCTIONS = [
  'check-alerts',
  'send-notification',
  'update-erp-cron',
  'update-option-prices-cron',
  'update-underlying-prices-cron',
];

function readFunctionSource(name: string): string {
  const file = path.join(FUNCTIONS_DIR, name, 'index.ts');
  expect(existsSync(file), `edge function mancante: ${name}`).toBe(true);
  return readFileSync(file, 'utf8');
}

/** Pattern esatto del bug: guardia che dipende solo dalla env var. */
export function hasEnvOnlyCronGuard(source: string): boolean {
  return /if\s*\(\s*!cronSecret\s*\|\|\s*req\.headers\.get\(\s*['"]x-cron-secret['"]\s*\)\s*!==\s*cronSecret\s*\)/.test(
    source,
  );
}

/** La validazione deve passare (anche) dalla RPC che legge il Vault. */
export function usesVaultBackedVerification(source: string): boolean {
  return source.includes('verify_cron_secret');
}

describe('autenticazione cron delle edge function', () => {
  it('prova del bug: la vecchia guardia env-only viene riconosciuta', () => {
    const buggy = `
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
    `;
    expect(hasEnvOnlyCronGuard(buggy)).toBe(true);
    expect(usesVaultBackedVerification(buggy)).toBe(false);
  });

  it.each(CRON_AUTHENTICATED_FUNCTIONS)(
    '%s non usa una guardia basata solo su CRON_SECRET',
    (name) => {
      expect(hasEnvOnlyCronGuard(readFunctionSource(name))).toBe(false);
    },
  );

  it.each(CRON_AUTHENTICATED_FUNCTIONS)(
    '%s valida il segreto tramite la RPC verify_cron_secret (Vault)',
    (name) => {
      expect(usesVaultBackedVerification(readFunctionSource(name))).toBe(true);
    },
  );

  it.each(CRON_AUTHENTICATED_FUNCTIONS)(
    '%s rifiuta comunque le richieste senza header x-cron-secret',
    (name) => {
      const source = readFunctionSource(name);
      expect(source).toContain('req.headers.get("x-cron-secret")');
      expect(source).toContain('if (!provided) return false;');
    },
  );

  it('nessuna altra edge function reintroduce la guardia env-only', () => {
    const offenders = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => existsSync(path.join(FUNCTIONS_DIR, name, 'index.ts')))
      .filter((name) => hasEnvOnlyCronGuard(readFunctionSource(name)));

    expect(offenders).toEqual([]);
  });

  it('la migrazione della RPC verify_cron_secret e la sua GRANT sono versionate', () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const sql = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n');

    expect(sql).toContain('FUNCTION public.verify_cron_secret');
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_cron_secret\(text\) TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.verify_cron_secret\(text\) FROM PUBLIC, anon, authenticated/);
  });
});
