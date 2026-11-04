import { expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { politica, licenciaSepia, licenciaHistoricaWorkspace, sinLicencia, semana, venceAntes, publicacion } from './ejemplos';
const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
it('fija las dos decisiones de Santiago sin convertir licencias históricas', () => {
  expect(politica.legacyHabilitaUltramar).toBe(false);expect(politica.offlineMaximoSegundos).toBe(604800);
  expect(politica.edicion).toBe('01');expect(politica.aplicaciones).toEqual(['workspace','ultramar']);
});
it('una licencia nueva autoriza las dos aplicaciones; una histórica sólo Workspace',()=>{
  expect(licenciaSepia.acceso.producto).toBe('sepia');expect(licenciaSepia.acceso.aplicaciones).toEqual(['workspace','ultramar']);
  expect(licenciaHistoricaWorkspace.aplicacion).toBe('workspace');expect(licenciaHistoricaWorkspace.acceso.aplicaciones).toEqual(['workspace']);
  expect(sinLicencia.aplicacion).toBe('ultramar');expect(sinLicencia.estado).toBe('requiere_licencia');expect('acceso' in sinLicencia).toBe(false);
});
it.each([semana,venceAntes])('el permiso offline termina en el menor plazo: siete días o licencia', lease=>{
  expect(lease.exp).toBe(Math.min(lease.iat+604800,lease.licencia_exp));expect(lease.exp).toBeGreaterThan(lease.iat);
  expect(lease.iss).toBe('https://gba.software');expect(lease.aud).toBe('ultramar-desktop');expect(lease.edicion).toBe('01');
});
it('el perfil de escritorio no hereda la capacidad editorial de 1.7.5',()=>{
  expect(politica.contrato).toBe('gba.sepia.acceso/1.0');expect(politica.scopes).toEqual(['license.read','license.activate','session.revoke']);
  expect(politica.scopes.join(' ')).not.toMatch(/content\.|asset\.|review|publish/);
});
it('la bienvenida es el único lugar de identidad de suite en el cliente Ultramar',()=>{
  expect(politica.marcaSuiteEnCliente).toEqual(['bienvenida']);expect(politica.inicio).toEqual({ancho:560,alto:440});
  expect(politica.editorSoloConAutorizacion).toBe(true);expect(politica.guardarRecuperacionSiempre).toBe(true);
});
it('el contrato no presenta como publicados sus endpoints ni autoriza distribuir la app',()=>{
  expect(publicacion.servicioImplementado).toBe(false);expect(publicacion.migracionAplicada).toBe(false);expect(publicacion.listoParaPublicar).toBe(false);
  const texto=leer('../../SEPIA_ACCESO.md');expect(texto).toContain('NO VERIFICADO');expect(texto).toContain('workspace_license_status');expect(texto).toContain('7 días');
});
it('los enlaces locales del contrato existen y las muestras no guardan credenciales',()=>{
  const texto=leer('../../SEPIA_ACCESO.md');for(const match of texto.matchAll(/\]\(([^)]+)\)/g)){const ruta=match[1]!;if(!ruta.startsWith('https://'))expect(existsSync(new URL('../../'+ruta,import.meta.url)),ruta).toBe(true);}
  const muestras=leer('./ejemplos.ts');expect(muestras).not.toMatch(/service_role|wsc_|sb_secret_|SUPABASE_SERVICE/);
});

it('exige acceso nativo sin apertura del navegador en la revisión vigente',()=>{
  expect(politica).toMatchObject({revision:2,modoInicio:'nativo',abreNavegadorParaIniciarSesion:false});
  const texto=leer('../../SEPIA_ACCESO.md');expect(texto).toContain('revisión 2');expect(texto).toContain('inicio de sesión nativo');
});
it('sustituye la autorización por código web por session.create con Auth nativo',()=>{
  const tipos=leer('./acceso.d.ts');expect(tipos).toContain("op:'session.create'");
  expect(tipos).not.toMatch(/InicioEmparejamiento|Sondeo|pairing\.start|pairing\.poll|verification_uri/);
  const encargo=leer('./PARA_EL_CHAT_DE_GBA.md');expect(encargo).toContain('revisión 2');expect(encargo).toContain('MFA');
});
