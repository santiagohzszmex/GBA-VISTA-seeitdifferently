import type { Politica, AutorizadoSepia, AutorizadoWorkspaceHistorico, RequiereLicencia, PermisoOffline, Peticion } from './acceso';
/** Datos sintéticos, sin cuentas, licencias ni autorizaciones reales. */
export const politica = {
 contrato:'gba.sepia.acceso/1.0',revision:2,modoInicio:'nativo',abreNavegadorParaIniciarSesion:false,edicion:'01',aplicaciones:['workspace','ultramar'],legacyHabilitaUltramar:false,
 offlineMaximoSegundos:604800,scopes:['license.read','license.activate','session.revoke'],marcaSuiteEnCliente:['bienvenida'],
 inicio:{ancho:560,alto:440},editorSoloConAutorizacion:true,guardarRecuperacionSiempre:true,
} as const satisfies Politica;
const base = {
 contrato:'gba.sepia.acceso/1.0',revision:2,servidorUtc:'2026-11-02T18:00:00Z',
 cuenta:{id:'00000000-0000-4000-8000-000000000001',nombreVisible:'Persona de ejemplo'},
 conexion:{id:'00000000-0000-4000-8000-000000000002',venceEn:'2026-11-09T18:00:00Z'},
} as const;
export const licenciaSepia = {...base,estado:'autorizado',aplicacion:'ultramar',acceso:{producto:'sepia',edicion:'01',aplicaciones:['workspace','ultramar'],licenciaId:'00000000-0000-4000-8000-000000000003',venceEn:'2026-12-01T18:00:00Z'}} as const satisfies AutorizadoSepia;
export const licenciaHistoricaWorkspace = {...base,estado:'autorizado',aplicacion:'workspace',acceso:{producto:'workspace_legacy',aplicaciones:['workspace'],licenciaId:'00000000-0000-4000-8000-000000000004',venceEn:'2026-12-01T18:00:00Z'}} as const satisfies AutorizadoWorkspaceHistorico;
export const sinLicencia = {...base,estado:'requiere_licencia',aplicacion:'ultramar',motivo:'ausente'} as const satisfies RequiereLicencia;
const iat = Date.parse(base.servidorUtc)/1000;
export const semana = {
 iss:'https://gba.software',aud:'ultramar-desktop',sub:base.cuenta.id,jti:'00000000-0000-4000-8000-000000000005',conexionId:base.conexion.id,
 dispositivoId:'00000000-0000-4000-8000-000000000006',producto:'sepia',edicion:'01',licenciaId:licenciaSepia.acceso.licenciaId,aplicacion:'ultramar',
 iat,nbf:iat,exp:iat+604800,licencia_exp:Date.parse(licenciaSepia.acceso.venceEn)/1000,
} as const satisfies PermisoOffline;
export const venceAntes = {...semana,jti:'00000000-0000-4000-8000-000000000007',licencia_exp:iat+86400,exp:iat+86400} as const satisfies PermisoOffline;
export const publicacion = {servicioImplementado:false,migracionAplicada:false,listoParaPublicar:false} as const;
// Control de tipos: una licencia histórica nunca se puede representar como acceso a Ultramar.
// @ts-expect-error La aplicación de este perfil sólo puede ser Workspace.
const mezclaInvalida:AutorizadoWorkspaceHistorico={...licenciaHistoricaWorkspace,aplicacion:'ultramar'};
void mezclaInvalida;
// @ts-expect-error El perfil de producto no permite ampliar el plazo sin cambiar el contrato.
const plazoInvalido:Politica={...politica,offlineMaximoSegundos:1209600};
void plazoInvalido;

/** Encabezado Authorization omitido: no se incluyen credenciales ni tokens de muestra. */
export const solicitudSesion = {
 contrato:'gba.sepia.acceso/1.0',revision:2,op:'session.create',
 datos:{aplicacion:'ultramar',versionApp:'0.1.0',nombreDispositivo:'Equipo de ejemplo',dispositivoId:'00000000-0000-4000-8000-000000000006'},
} as const satisfies Peticion;
// @ts-expect-error El flujo web anterior ya no forma parte del contrato vigente.
const flujoAnterior:Peticion={...solicitudSesion,op:'pairing.start'};
void flujoAnterior;
// @ts-expect-error La revisión del borrador anterior no es compatible con el acceso nativo.
const revisionAnterior:Peticion={...solicitudSesion,revision:1};
void revisionAnterior;
