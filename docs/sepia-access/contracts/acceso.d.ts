/** Acuerdo propuesto; no implementación ni autorización de producción. */
export type Contrato = 'gba.sepia.acceso/1.0';
export type Aplicacion = 'workspace' | 'ultramar';
export type FechaISO = string;
export type Id = string;
/** Sólo en memoria nativa/almacén seguro; nunca DTO de interfaz, registros o documento. */
export type SecretoNativo = string;
export interface Politica {
 readonly contrato: Contrato;
 readonly revision: 2;
 readonly modoInicio: 'nativo';
 readonly abreNavegadorParaIniciarSesion: false;
 readonly edicion: '01';
 readonly aplicaciones: readonly ['workspace','ultramar'];
 readonly legacyHabilitaUltramar: false;
 readonly offlineMaximoSegundos: 604800;
 readonly scopes: readonly ['license.read','license.activate','session.revoke'];
 readonly marcaSuiteEnCliente: readonly ['bienvenida'];
 readonly inicio: {readonly ancho:560;readonly alto:440};
 readonly editorSoloConAutorizacion: true;
 readonly guardarRecuperacionSiempre: true;
}
export interface CuentaPublica {readonly id:Id;readonly nombreVisible:string}
export interface BaseEstado {
 readonly contrato:Contrato;
 readonly revision:2;
 readonly servidorUtc:FechaISO;
 readonly cuenta:CuentaPublica;
 readonly conexion:{readonly id:Id;readonly venceEn:FechaISO};
}
export interface LicenciaSepia {
 readonly producto:'sepia';readonly edicion:'01';
 readonly aplicaciones:readonly ['workspace','ultramar'];
 readonly licenciaId:Id;readonly venceEn:FechaISO;
}
export interface AutorizadoSepia extends BaseEstado {
 readonly estado:'autorizado';readonly aplicacion:Aplicacion;readonly acceso:LicenciaSepia;
}
/** Compatibilidad de Workspace; no es licencia de paquete ni autoriza Ultramar. */
export interface AutorizadoWorkspaceHistorico extends BaseEstado {
 readonly estado:'autorizado';readonly aplicacion:'workspace';
 readonly acceso:{readonly producto:'workspace_legacy';readonly aplicaciones:readonly ['workspace'];readonly licenciaId:Id;readonly venceEn:FechaISO};
}
/** Sólo conserva la excepción ya existente de Workspace; no hay excepción nueva en Ultramar. */
export interface AutorizadoWorkspaceDueno extends BaseEstado {
 readonly estado:'autorizado';readonly aplicacion:'workspace';
 readonly acceso:{readonly producto:'workspace_owner';readonly aplicaciones:readonly ['workspace']};
}
export interface RequiereLicencia extends BaseEstado {
 readonly estado:'requiere_licencia';readonly aplicacion:Aplicacion;
 readonly motivo:'ausente'|'vencida'|'revocada';
}
export interface Bloqueado extends BaseEstado {
 readonly estado:'bloqueado';readonly aplicacion:Aplicacion;readonly motivo:'cuenta_suspendida';
}
export type EstadoPublico = AutorizadoSepia | AutorizadoWorkspaceHistorico | AutorizadoWorkspaceDueno | RequiereLicencia | Bloqueado;
/** Sólo al backend nativo tras validar Auth y MFA; nunca se entrega el token a React. */
export interface SesionCreada {
 readonly tokenAplicacion:SecretoNativo;
 readonly estadoPublico:EstadoPublico;
}
/** session.create usa Bearer de Auth nativo; las otras operaciones usan Bearer de app. */
export type Peticion = {readonly contrato:Contrato;readonly revision:2} & (
 | {readonly op:'session.create';readonly datos:{readonly aplicacion:Aplicacion;readonly versionApp:string;readonly nombreDispositivo:string;readonly dispositivoId:Id}}
 | {readonly op:'session.status'|'session.logout';readonly datos:Record<string,never>}
 | {readonly op:'license.activate';readonly datos:{readonly codigo:SecretoNativo}}
);
/** Payload de un JWS firmado, no un permiso que se acepte como JSON sin firma. */
export interface CabeceraOffline {readonly alg:'Ed25519';readonly typ:'gba-sepia-offline+jwt';readonly kid:string}
export type PermisoOffline = {
 readonly iss:'https://gba.software';
 readonly sub:Id;readonly jti:Id;readonly conexionId:Id;readonly dispositivoId:Id;
 readonly producto:'sepia';readonly edicion:'01';readonly licenciaId:Id;
 /** Segundos enteros Unix UTC; exp=min(iat+604800,licencia_exp). */
 readonly iat:number;readonly nbf:number;readonly exp:number;readonly licencia_exp:number;
} & (
 | {readonly aplicacion:'ultramar';readonly aud:'ultramar-desktop'}
 | {readonly aplicacion:'workspace';readonly aud:'workspace-desktop'}
);
/** Sobre de transporte nativo: la interfaz recibe únicamente estadoPublico. */
export interface EstadoNativo {
 readonly estadoPublico:EstadoPublico;
 readonly permisoOfflineJws?:SecretoNativo;
}
export interface ErrorApi {
 readonly error:{readonly code:'invalid_request'|'contract_unsupported'|'session_invalid'|'access_denied'|'account_suspended'|'license_invalid_or_used'|'license_required'|'rate_limited'|'service_unavailable';readonly message:string;readonly retryable:boolean;readonly requestId:Id};
}
