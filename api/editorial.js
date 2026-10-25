// Public community profiles and updates were retired with VISTA's GIMG transformation.
export default function handler(request,response){
 response.setHeader('Content-Type','text/html; charset=utf-8');
 response.setHeader('Cache-Control','no-store');
 response.status(410).send('<!doctype html><html lang="es"><meta charset="utf-8"><title>VISTA · GIMG</title><body><main><h1>Este espacio ya no está disponible.</h1><p>VISTA reúne ahora las publicaciones de GIMG.</p><a href="https://vista.gba.software/">Ir a VISTA</a></main></body></html>');
}
