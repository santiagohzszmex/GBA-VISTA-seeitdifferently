# Siguiente actualización de GBA Workspace — Base organizacional de GIMG

**Estado:** propuesta funcional lista para planificación técnica  
**Versión prevista:** actualización de base organizacional  
**Fecha:** 8 de octubre de 2026  
**Dependencias:** auditoría técnica y matriz RBAC definitiva

## 1. Objetivo

Convertir el Workspace general existente en un espacio donde GIMG pueda incorporar al equipo seleccionado, organizar productos editoriales y operar con permisos seguros, sin reconstruir las capacidades actuales de documentos, versiones y calendario.

Esta actualización debe establecer primero identidad segura, unidades, membresías, proyectos, tareas, revisiones y permisos. La aplicación de escritorio y el almacenamiento de archivos pesados se desarrollarán después.

## 2. Nombre funcional de la actualización

**GBA Workspace — Base organizacional de GIMG**

## 3. Alcance obligatorio

### 3.1 Seguridad de GBA ID — bloqueante

Antes de incorporar colaboradores se deberá:

- almacenar la frase de recuperación como hash no reversible;
- incorporar al repositorio la migración utilizada para recuperar o cambiar el PIN;
- limitar intentos de acceso por cuenta, dispositivo y origen;
- aplicar espera progresiva y bloqueo temporal;
- permitir revocar sesiones;
- registrar intentos y recuperaciones relevantes;
- impedir que PIN o secreto aparezcan en respuestas, tablas accesibles o registros.

Hasta resolver este bloque no deberá afirmarse que la recuperación es completamente segura ni habilitarse el acceso general al nuevo equipo.

### 3.2 Unidad GIMG

Workspace deberá dejar de depender de un único espacio global y admitir unidades de trabajo.

```text
GBA Workspace
└── Unidad GIMG
    ├── Miembros
    ├── Proyectos
    ├── Áreas
    ├── Documentos
    ├── Tareas
    └── Calendario
```

Elementos mínimos:

- tabla de unidades;
- membresías por unidad;
- GIMG como primera unidad;
- separación de datos por `unit_id`;
- estructura extensible a futuras unidades de GBA.

### 3.3 Matriz RBAC definitiva

Se implementará la especificación `03-matriz-rbac-definitiva.md`.

Roles iniciales:

- Administración técnica de GBA.
- Dirección de GIMG.
- Responsable de Producción.
- Coordinación de Producción y Workspace.
- Dirección delegada de producto.
- Responsable de área.
- Colaborador.
- Gestión de archivos y QA.
- Consulta.

Los permisos deberán restringirse por unidad, proyecto, área, entregable y periodo. Las comprobaciones deben ejecutarse en servidor mediante RLS o funciones seguras; ocultar botones no constituye control de acceso.

### 3.4 Miembros y cargos

El panel de miembros mostrará:

- nombre público;
- estado de membresía;
- área y cargo;
- proyectos asignados;
- fecha de incorporación;
- vigencia del acceso;
- delegaciones temporales.

Estados mínimos:

- Aceptado.
- Activo.
- Continuidad solicitada.
- Continuidad confirmada.
- Inactivo.
- Baja.
- Suspendido.

Las personas en lista de reserva permanecen en VISTA y no reciben acceso operativo por defecto.

### 3.5 Proyectos y áreas

El modelo deberá permitir representar:

- edición de Día de Muertos;
- edición de Halloween;
- colección de Leyendas;
- cada microedición como producto independiente.

Cada proyecto contendrá:

- Dirección asignada;
- Producción;
- áreas participantes;
- integrantes;
- fecha de inicio y cierre;
- estado;
- brief principal;
- calendario;
- entregables.

No es necesario activar todos los productos en la primera migración, pero el modelo debe soportarlos.

### 3.6 Tareas y entregables

Cada tarea o entregable incluirá:

- título y descripción;
- proyecto y área;
- responsable y colaboradores;
- prioridad;
- fecha de entrega;
- dependencias;
- estado;
- bloqueo y motivo;
- relación con documentos o activos;
- historial.

Estados:

```text
Pendiente
Asignado
En progreso
En revisión
Cambios solicitados
Aprobado de área
En QA
QA aprobado
Publicado
Archivado
Bloqueado
```

Producción podrá asignar y administrar fechas. Los responsables de área revisarán su especialidad. Dirección conservará la aprobación final.

### 3.7 Revisión y comentarios

Sobre el editor y las versiones existentes se añadirá:

- comentarios vinculados a documento o entregable;
- solicitud consolidada de cambios;
- responsable de atenderla;
- una ronda ordinaria;
- verificación de cambios;
- autorización de ronda adicional;
- registro de quién aprobó y cuándo;
- prevención de autoaprobación final.

Modificar un documento aprobado deberá crear una versión nueva y devolverlo al estado de revisión correspondiente.

### 3.8 Panel inicial de GIMG

La pantalla de cada integrante deberá responder:

- qué debe hacer;
- qué vence próximamente;
- qué está bloqueado;
- qué espera su revisión;
- qué cambió desde su última entrada.

Dirección y Producción también verán:

- progreso por proyecto;
- entregas retrasadas;
- carga por persona;
- bloqueos;
- revisiones pendientes;
- próximos hitos.

### 3.9 Calendario conectado

El calendario existente deberá relacionarse con proyectos, tareas, entregables, revisiones y fechas editoriales.

Un cambio de fecha realizado por Producción deberá actualizar el objeto relacionado y generar un registro de auditoría.

### 3.10 Auditoría visible

La interfaz deberá mostrar actividad sobre:

- altas, bajas y suspensiones;
- cambios de rol;
- asignaciones;
- cambios de fecha o estado;
- nuevas versiones;
- solicitudes y aprobaciones;
- bloqueos de QA;
- descargas sensibles;
- delegaciones y vencimientos.

Cada registro incluirá actor, acción, objeto, fecha y contexto.

## 4. Reutilización de la implementación existente

Se conservarán y ampliarán:

- navegación principal de Workspace;
- editor Markdown;
- historial de versiones;
- estados documentales aprovechables;
- calendario;
- directorio de GBA ID;
- suspensión sin borrado inmediato;
- patrón actual de RLS y funciones de Supabase.

La actualización debe evolucionar el sistema existente, no crear un Workspace paralelo.

## 5. Fuera de alcance de esta actualización

Se aplazan:

- aplicación Tauri para macOS y Windows;
- Cloudflare R2 y carga de originales pesados;
- sincronización automática con WhatsApp;
- trabajo sin conexión;
- automatización de certificados;
- previsualización de archivos Affinity;
- distribución y firma de aplicaciones de escritorio.

Durante esta etapa, los archivos visuales pesados podrán permanecer en un repositorio externo controlado. Workspace registrará responsable, enlace, versión, autoría, estado y aprobación.

## 6. Recorrido mínimo completo

La actualización deberá permitir comprobar:

```text
Dirección crea un proyecto
→ Producción asigna una tarea
→ Colaborador entrega una versión
→ Responsable de área solicita cambios
→ Colaborador entrega una versión nueva
→ Responsable de área aprueba su especialidad
→ QA revisa y aprueba
→ Dirección aprueba la publicación
→ el sistema conserva el historial completo
```

## 7. Criterios de aceptación

La actualización se considerará funcional cuando:

1. un integrante no pueda consultar otro proyecto sin asignación;
2. Producción pueda organizar pero no aprobar contenido editorial;
3. un responsable pueda revisar su área, pero no aprobar la publicación final;
4. QA pueda bloquear una salida defectuosa, pero no publicarla por sí solo;
5. la administración técnica de GBA no obtenga autoridad editorial automáticamente;
6. una delegación vencida deje de funcionar sin eliminar el historial;
7. una persona suspendida pierda acceso inmediatamente;
8. ninguna persona pueda aprobar finalmente su propio entregable;
9. las acciones sensibles se registren en auditoría;
10. las restricciones funcionen mediante API directa, no únicamente desde la interfaz.

## 8. Orden recomendado de implementación

1. Corregir seguridad y recuperación de GBA ID.
2. Crear unidades y membresías.
3. Implementar roles, alcances, asignaciones y delegaciones.
4. Aplicar RLS y pruebas de autorización.
5. Crear proyectos y áreas.
6. Crear tareas, entregables y dependencias.
7. Añadir comentarios, revisiones y rondas.
8. Conectar calendario.
9. Crear paneles por rol.
10. Exponer auditoría y ejecutar pruebas integrales.

## 9. Documentos relacionados

- `01-auditoria-gba-vista.md` — estado real del Workspace existente.
- `02-arquitectura-archivos-y-clientes.md` — arquitectura posterior de archivos y aplicaciones.
- `03-matriz-rbac-definitiva.md` — permisos obligatorios de la actualización.
- `../gimg/01-arquitectura-organizacional.md` — estructura de GIMG.
- `../gimg/02-catalogo-de-puestos.md` — cargos y responsabilidades.
- `../gimg/04-gobernanza-raci.md` — autoridad y aprobaciones editoriales.

