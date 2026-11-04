# Anexos de acceso · revisión 2

Contrato principal: [SEPIA_ACCESO.md](../../SEPIA_ACCESO.md).
Los archivos `.d.ts` y las muestras sintéticas describen el acuerdo propuesto.
No son un cliente de red, una API ni un verificador de firmas o licencias.
No incluyen claves, tokens ni códigos utilizables.

Desde la raíz del repo:

```sh
npm run pruebas -- docs/contratos/sepia-01/acceso.test.ts
node node_modules/typescript/bin/tsc -p docs/contratos/sepia-01/tsconfig.json
npm run lint
```

Las pruebas verifican decisiones de producto, separación de perfiles, plazos de las muestras,
enlaces y estado no publicado. El compilador también comprueba cuatro casos negativos con
`@ts-expect-error`. La matriz funcional del contrato requiere implementaciones reales.
El proyecto raíz no incluye los anexos en su tsconfig: se compilan explícitamente con el comando anterior.

Santiago pide acceso dentro de la app. La revisión 2 sustituye el emparejamiento web por
`session.create` tras Auth nativo; `revision: 2` es obligatorio. El contrato real del adaptador
de Auth (campos/endpoints/MFA/renovación) debe devolverlo GBA, sin inventarlo aquí.
Encargo completo: [PARA_EL_CHAT_DE_GBA.md](PARA_EL_CHAT_DE_GBA.md).
