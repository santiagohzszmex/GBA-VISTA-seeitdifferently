export const LEGACY_TERMS = [
  [
    "La convocatoria",
    "GIMG, la división editorial de GBA, organiza este ciclo dirigido a la comunidad del Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx. Las postulaciones se reciben del 8 al 18 de octubre de 2026; el cierre es a las 23:59, hora de Ciudad de México. Esta iniciativa de GBA no promete una constancia o certificación de la institución.",
  ],
  [
    "Participación y selección",
    "La participación es colaborativa y no constituye una relación laboral. Se busca un equipo de 15 colaboradores y hasta 5 personas en reserva. La revisión considera disponibilidad, motivación, criterio del área y cobertura del equipo. No contar con experiencia profesional, software de pago o portafolio no elimina por sí mismo la postulación. La puntuación orienta la revisión: Dirección decide la integración final y puede solicitar una entrevista breve.",
  ],
  [
    "El ciclo editorial",
    "El equipo trabajará en dos ediciones principales, Día de Muertos y Halloween, y tres microediciones de leyendas. El calendario de entregables se comunicará al confirmar cada puesto. GBA Workspace conservará tareas, archivos, versiones, decisiones y aprobaciones. Los avisos rápidos podrán coordinarse por WhatsApp después de la selección.",
  ],
  [
    "Compromisos de colaboración",
    "Las respuestas y muestras deben ser propias y veraces. Se respetarán autoría, privacidad y permisos. El uso de IA deberá declararse en las pruebas donde se permita. Los entregables incluyen una ronda ordinaria de cambios y los archivos fuente cuando corresponda. Los archivos del proyecto deberán conservarse en el repositorio indicado; una copia personal no podrá ser la única copia. Al renunciar se avisará y entregarán avances, archivos y estado del trabajo.",
  ],
  [
    "Créditos y acceso",
    "El crédito se asignará a las contribuciones efectivamente utilizadas y se conservará aunque la persona deje después el equipo. El acceso a herramientas será temporal para el ciclo asignado y se revisará al terminar. Cualquier constancia o certificado dependerá de una confirmación independiente de la instancia emisora; esta convocatoria no lo garantiza.",
  ],
  [
    "Tu GBA ID",
    "GBA ID es una cuenta desarrollada por GBA para identificar tu postulación, guardar las respuestas y permitirte consultar su estado. Tu identificador y nombre de presentación se obtienen de la sesión. Crear una cuenta no equivale a ser seleccionado ni da acceso inmediato a Workspace. Conserva tu PIN y tu código de recuperación; no los compartas con el equipo evaluador.",
  ],
  [
    "Datos y privacidad",
    "GBA guarda tu identificador de cuenta, respuestas, muestra opcional, constancia de aceptación de esta versión de las condiciones y fechas del proceso. El correo o número de teléfono que elijas para contacto se conserva por separado y se utilizará para coordinación si resultas seleccionado. Las respuestas y los archivos no son públicos: los consultan la persona postulante y el equipo de selección autorizado, incluido el contacto de postulaciones enviadas; las notas internas de revisión son privadas del equipo. El alojamiento y la autenticación se apoyan en Supabase y Vercel, que procesan datos técnicos para prestar el servicio. No se añaden herramientas de seguimiento publicitario.",
  ],
  [
    "Revisión de tus datos",
    "Puedes revisar y corregir el borrador hasta enviarlo. Después del envío, consulta el estado desde tu GBA ID. Los datos se utilizan para este proceso y su coordinación; una participación en otros ciclos requerirá una decisión posterior. Para solicitar corrección, retiro de la postulación, información sobre conservación o eliminación de tus datos, escribe a contacto@gba.software indicando tu GBA ID, sin enviar tu PIN ni código de recuperación. Las muestras no se publicarán por el solo hecho de postularte; cualquier uso editorial se acordará posteriormente.",
  ],
];

// Keep the original consent text available with the original application.
export const TERMS = LEGACY_TERMS.map(([title,text],index)=>[title,({
 0:"GIMG, la división editorial de GBA, abre un nuevo periodo de incorporación para la comunidad del Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx. Recibe postulaciones del 1 al 15 de noviembre de 2026, hasta las 23:59 de Ciudad de México. La convocatoria anterior y sus resultados se conservan por separado.",
 1:"La colaboración es voluntaria. Se prevé una incorporación en edición de video, una en animación 2D, una en animación 3D, una en ilustración y una en maquetación. Las demás áreas reciben registros de interés sujetos a necesidades posteriores. Postularte no garantiza selección. Dirección revisa disponibilidad, motivación, criterio y cobertura del equipo; no se exige experiencia profesional, portafolio ni software de pago para postularte.",
 2:"El equipo actual continúa y conserva su organigrama. Las nuevas personas se incorporarán a los proyectos y calendarios que GIMG confirme, sin prometer aquí una temática o edición aún no anunciada. Workspace registra asignaciones, documentos, referencias y revisiones. Los avances audiovisuales o tridimensionales podrán entregarse por los medios y enlaces acordados; la convocatoria no promete un editor de video o 3D dentro de Workspace. Los avisos rápidos podrán coordinarse por WhatsApp después de la selección.",
 4:"Los créditos y constancias de GIMG se basan en contribuciones efectivamente realizadas y verificadas. Los créditos se conservan aunque la persona termine su colaboración. La convocatoria no garantiza reconocimientos escolares ni certificación de otra institución. El acceso a herramientas requiere incorporación y asignación explícitas; la continuidad del equipo actual se gestiona por separado y no exige volver a postularse."
})[index] || text]);
