# Carta fundacional de ANIMA

**Estado:** Definición inicial
**Fecha:** 31 de julio de 2026
**Propietario:** GBA
**Ingeniería:** GBA Forge

## Propósito

ANIMA investiga cómo entrenar y adaptar modelos de inteligencia artificial en
equipos que normalmente quedarían excluidos por límites de RAM, CPU, energía o
presupuesto.

Su objetivo no es afirmar que las restricciones físicas desaparecen. Busca
reducir el conjunto de memoria activo, mover datos entre niveles de
almacenamiento de manera inteligente y dedicar cómputo solo al trabajo que
produce una mejora medible.

## Tesis

El desarrollo de IA no debería depender exclusivamente de comprar más memoria o
aceleradores cada vez mayores. Los algoritmos y sistemas pueden intercambiar
tiempo, precisión, almacenamiento y energía para hacer viables entrenamientos
que antes no cabían en el equipo disponible.

ANIMA tendrá éxito cuando demuestre ese intercambio de forma reproducible.

## Líneas de investigación

### Memoria por niveles

- Mantener en RAM solo el conjunto de trabajo inmediato.
- Mover parámetros, estados del optimizador y activaciones entre RAM y SSD.
- Utilizar archivos mapeados, paginación predecible y lectura anticipada.
- Crear checkpoints incrementales que no dupliquen el modelo completo.

### Entrenamiento eficiente

- Ajuste de parámetros mediante técnicas de bajo rango.
- Cuantización de pesos, gradientes y estados cuando la calidad lo permita.
- Recomputation selectiva de activaciones.
- Optimizadores con estados comprimidos o distribuidos.

### Cómputo adaptativo

- Cambiar secuencia, lote y acumulación según la memoria disponible.
- Priorizar ejemplos, capas o intervalos con mayor aprendizaje marginal.
- Reducir trabajo cuando el costo adicional deje de mejorar el modelo.
- Explorar arquitecturas recurrentes o de memoria lineal cuando correspondan.

### Ejecución centrada en CPU

- Diseñar rutas conscientes de caché y ancho de banda.
- Medir el paralelismo real en lugar de asumir que más hilos siempre ayudan.
- Usar instrucciones vectoriales y formatos compatibles con cada procesador.
- Minimizar conversiones, copias y movimientos de datos innecesarios.

### Orquestación distribuida

- Dividir tareas entre equipos heterogéneos sin exigir que todos contengan el
  modelo completo.
- Separar preparación de datos, entrenamiento, evaluación y almacenamiento.
- Recuperar trabajos interrumpidos sin reiniciar todo el experimento.

## Productos posibles

### ANIMA Research

Publica experimentos, benchmarks, resultados negativos y métodos reproducibles.
Es la fuente de evidencia para cualquier producto posterior.

### ANIMA Runtime

Motor que analiza el equipo y selecciona estrategias de cuantización, offload,
checkpointing, secuencia y paralelismo.

### ANIMA Services

Servicios administrados de ajuste, optimización y evaluación para organizaciones
que necesitan modelos especializados sin infraestructura de gran escala.

Estos nombres describen direcciones; no anuncian servicios que aún no existen.

## Papel dentro de GBA

- Forge desarrolla el runtime y las herramientas experimentales.
- Mothership registra equipos, ejecuciones, costos, resultados y versiones.
- Los GBA Nodes almacenan datasets, checkpoints, colas y telemetría.
- Una futura Mac Studio ejecutará referencias, pero no sustituirá la investigación
  de eficiencia.
- VISTA y GIMG pueden ser los primeros usuarios internos de avances demostrados.

## Métricas obligatorias

Todo avance debe compararse contra una línea base y registrar:

- RAM máxima utilizada.
- Datos transferidos entre RAM y almacenamiento.
- Tiempo por token o ejemplo.
- Consumo energético cuando sea medible.
- Calidad final bajo el mismo dataset y presupuesto.
- Costo monetario estimado por ejecución.
- Capacidad de reanudar un entrenamiento interrumpido.

Reducir memoria multiplicando excesivamente el tiempo o destruyendo la calidad
no se considera automáticamente una mejora.

## Hoja de ruta inicial

### Fase 0: línea base reproducible

Seleccionar un modelo y dataset pequeños, ejecutar entrenamiento convencional y
registrar memoria, tiempo, calidad y energía.

### Fase 1: presupuesto adaptativo

Construir un planificador que ajuste lote, acumulación, secuencia y checkpoints
para respetar un límite estricto de memoria.

### Fase 2: offload y estados comprimidos

Mover estados inactivos a SSD, reducir su precisión y medir el costo real de
transferencia frente al ahorro de RAM.

### Fase 3: entrenamiento selectivo

Investigar qué parámetros, capas o ejemplos pueden omitirse temporalmente sin
perder la mejora objetivo.

### Fase 4: runtime utilizable

Unificar los métodos que demuestren ventajas en una herramienta repetible,
documentada y observable desde Mothership.

### Fase 5: servicio piloto

Probar ANIMA Services con un problema interno o un colaborador limitado antes de
prometer disponibilidad pública.

## Reglas de inversión

- No comprar hardware para compensar un experimento sin línea base ni hipótesis.
- Cada compra debe desbloquear una prueba identificada.
- Los 550 dólares considerados para desarrollo requieren presupuesto,
  responsables, entregables y criterio de cancelación.
- La futura Mac Studio es un instrumento de investigación y producción, no una
  prueba de que ANIMA funciona.
- Los fondos personales y los fondos de GBA se registran por separado.

## Declaración breve

> ANIMA busca que el progreso en inteligencia artificial dependa menos del
> tamaño del equipo y más de la inteligencia con la que utilizamos cada byte y
> cada ciclo de cómputo.
