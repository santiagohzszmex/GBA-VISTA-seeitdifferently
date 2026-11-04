# Arnés independiente de acceso Sepia

Este directorio se entrega con sus fuentes y migraciones sintéticas necesarias. Requiere Node.js 22 o posterior, acceso al registro npm para instalar y permiso de escucha loopback.

```
npm ci
npm test
```

No usa producción. SDK Supabase y PGlite fijados con lockfile. Sus licencias se incluyen. Auth local es una fixture firmada, no GoTrue; los resultados remotos se entregan por separado. Las claves de prueba se generan sólo en memoria.
