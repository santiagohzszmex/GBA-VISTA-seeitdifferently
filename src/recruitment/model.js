export const CYCLE = "gimg-otono-2026";
export const TERMS_VERSION = "2026-10-08";
export const COMMUNITY =
  "Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx";
export const OPEN_AT = "2026-10-08T06:00:00Z";
export const CLOSE_AT = "2026-10-19T06:00:00Z";
export const AREAS = [
  ["production", "Producción y organización", 2],
  ["research", "Investigación y reportería", 3],
  ["writing", "Redacción y edición", 2],
  ["design", "Diseño editorial y maquetación", 3],
  ["illustration", "Ilustración digital", 3],
  ["photography", "Fotografía y documentación", 1],
  ["qa", "Gestión de archivos y control de calidad", 1],
];
export const QUESTIONS = {
  community: [
    "¿Perteneces a la comunidad del Plantel Nezahualcóyotl?",
    [
      ["yes", "Sí"],
      ["no", "No"],
    ],
  ],
  coordination: [
    "¿Te interesa coordinar dentro de tu área?",
    [
      ["yes", "Sí"],
      ["maybe", "Tal vez"],
      ["no", "No"],
    ],
  ],
  hours: [
    "¿Cuánto tiempo podrías dedicar por semana?",
    [
      ["under2", "Menos de 2 horas"],
      ["2to4", "2–4 horas"],
      ["5to7", "5–7 horas"],
      ["8plus", "8 horas o más"],
    ],
  ],
  schedule: [
    "¿En qué momentos podrías trabajar?",
    [
      ["morning", "Mañanas"],
      ["afternoon", "Tardes"],
      ["night", "Noches"],
      ["weekend", "Fines de semana"],
      ["variable", "Horario variable"],
    ],
  ],
  delay: [
    "Si una entrega se retrasa, ¿qué harías primero?",
    [
      ["notify", "Avisar y explicar el problema"],
      ["wait", "Esperar a terminar"],
      ["reschedule", "Cambiar la fecha por mi cuenta"],
      ["abandon", "Abandonar la tarea"],
    ],
  ],
  changes: [
    "¿Aceptarías una ronda de cambios y entregar los archivos editables?",
    [
      ["yes", "Sí"],
      ["guided", "Sí, con orientación"],
      ["no", "No"],
    ],
  ],
  workspace: [
    "¿Utilizarías GBA Workspace como registro oficial del trabajo?",
    [
      ["yes", "Sí"],
      ["learn", "Sí, necesito aprender"],
      ["no", "No"],
    ],
  ],
  style: [
    "¿Cómo sueles trabajar mejor?",
    [
      ["instructions", "Con instrucciones claras"],
      ["solutions", "Proponiendo soluciones"],
      ["organizing", "Organizando a otras personas"],
      ["details", "Revisando detalles"],
      ["combination", "Una combinación"],
    ],
  ],
  device: [
    "¿Qué dispositivo tienes disponible?",
    [
      ["windows", "Windows"],
      ["mac", "Mac"],
      ["both", "Ambos"],
      ["tablet", "Tableta"],
      ["shared", "Computadora compartida"],
      ["phone", "Solo teléfono"],
    ],
  ],
  connection: [
    "¿Cómo es tu conexión para subir y descargar archivos?",
    [
      ["stable", "Estable"],
      ["limited", "A veces inestable"],
      ["support", "Necesito acordar horarios o apoyo"],
    ],
  ],
  experience: [
    "¿Qué experiencia tienes en tu área?",
    [
      ["learn", "Quiero aprender"],
      ["practice", "Práctica escolar o personal"],
      ["projects", "Participé en proyectos"],
      ["lead", "Puedo coordinar o enseñar"],
    ],
  ],
  affinity: [
    "¿Puedes instalar y utilizar Affinity en Windows o Mac?",
    [
      ["use", "Ya lo utilizo"],
      ["learn", "Puedo aprender"],
      ["unable", "No puedo instalarlo"],
    ],
  ],
  design_role: [
    "¿Qué función prefieres?",
    [
      ["lead", "Responsable de maquetación"],
      ["pages", "Diseño de páginas"],
      ["any", "Cualquiera"],
    ],
  ],
  digital: [
    "¿Puedes crear y entregar ilustraciones digitales?",
    [
      ["yes", "Sí"],
      ["guided", "Sí, con orientación técnica"],
      ["no", "No"],
    ],
  ],
  illustration_role: [
    "¿Qué función prefieres?",
    [
      ["lead", "Continuidad de ilustración"],
      ["pieces", "Creación de piezas"],
      ["any", "Cualquiera"],
    ],
  ],
  production_role: [
    "¿Qué función prefieres?",
    [
      ["lead", "Responsable de Producción"],
      ["workspace", "Coordinación de Producción y Workspace"],
      ["any", "Cualquiera"],
    ],
  ],
};
export const SCENARIOS = {
  production: [
    "Organizas fechas, entregas, responsables y avances. Dirección conserva las decisiones del proyecto.",
    "Una persona no entregó su archivo y otra necesita ese archivo para comenzar. ¿Qué harías primero, qué registrarías en Workspace y cuándo avisarías a Dirección?",
    "Orden, comunicación, seguimiento y límites del cargo.",
  ],
  research: [
    "Buscas información, preparas entrevistas y distingues hechos confirmados, opiniones y rumores.",
    "Encuentras una noticia en una publicación sin autor y una persona te la confirma por mensaje. ¿Qué revisarías antes de presentarla como un hecho y cómo guardarías tus fuentes?",
    "Verificación, prudencia y registro de fuentes.",
  ],
  writing: [
    "Conviertes información en textos claros y revisas estructura, atribuciones y datos pendientes.",
    "Recibes un texto bien escrito, pero contiene una fecha que no puede confirmarse y repite la misma idea tres veces. ¿Cómo lo prepararías para publicación?",
    "Claridad, intención original y verificación.",
  ],
  design: [
    "Organizas títulos, textos e imágenes con un sistema visual coherente. El trabajo se realizará digitalmente con Affinity en Windows o Mac.",
    "Debes acomodar un titular, un párrafo y una imagen en una página. Explica qué elemento harías más visible, cómo ordenarías los demás y qué regla mantendrías igual en todas las páginas.",
    "Jerarquía, legibilidad, continuidad y decisiones.",
  ],
  illustration: [
    "Creas imágenes a partir de instrucciones, presentas bocetos y entregas archivos digitales editables cuando sea posible. Puedes usar cualquier programa de dibujo digital.",
    "Recibes una indicación que dice “debe sentirse inquietante, pero no sangrienta”. ¿Qué propondrías en el boceto y qué preguntarías antes de comenzar el arte final?",
    "Interpretación, propuesta visual, comunicación y etapas.",
  ],
  photography: [
    "Realizas o seleccionas fotografías y conservas originales, fecha, lugar, autoría y permisos.",
    "Tienes una fotografía atractiva, pero no sabes quién la tomó ni si puede publicarse. ¿Qué harías antes de entregarla al equipo?",
    "Autoría, permisos, organización y criterio documental.",
  ],
  qa: [
    "Compruebas nombres, versiones, formatos, créditos y exportaciones antes de publicar.",
    "Recibes tres archivos llamados “final”, “final2” y “ahora sí final”. ¿Cómo identificarías la versión correcta y cómo evitarías que vuelva a ocurrir?",
    "Trazabilidad, método, comunicación y prevención.",
  ],
};
export const LABELS = {
  draft: "Borrador",
  submitted: "Recibida",
  preselected: "Preselección",
  reserve: "Lista de reserva",
  interview: "Entrevista breve",
  accepted: "Seleccionada",
  not_selected: "No seleccionada",
};
export const wordCount = (value) =>
  (
    String(value || "")
      .trim()
      .match(/\S+/gu) || []
  ).length;
export const normalizePhone = (value = "") => {
  const input = String(value).trim();
  if (!/^[+0-9() .-]+$/.test(input)) return "";
  const stripped = input.replace(/[() .-]/g, "");
  const phone = stripped.startsWith("+")
    ? stripped
    : /^\d{10}$/.test(stripped)
      ? `+52${stripped}`
      : /^52\d{10}$/.test(stripped)
        ? `+${stripped}`
        : "";
  return /^\+[1-9][0-9]{7,14}$/.test(phone) ? phone : "";
};
export const validEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")) &&
  String(value).length <= 254;
export const areaName = (value) =>
  AREAS.find(([key]) => key === value)?.[1] || "Sin área";
export const label = (key, value) =>
  QUESTIONS[key]?.[1].find(([k]) => k === value)?.[1] ||
  value ||
  "Sin respuesta";
export const sectionsFor = (a) => [
  ["profile", ["community", "area", "secondary", "coordination"]],
  [
    "availability",
    ["hours", "schedule", "delay", "changes", "workspace", "style"],
  ],
  [
    "technical",
    [
      "device",
      "connection",
      "experience",
      ...(a.area === "design"
        ? ["affinity", "design_role"]
        : a.area === "illustration"
          ? ["digital", "illustration_role"]
          : a.area === "production"
            ? ["production_role"]
            : []),
    ],
  ],
  ["voice", ["motivation", "scenario"]],
  [
    "sample",
    [
      "sample",
      ...(a.contact_method === "phone" ? ["contact_phone"] : ["contact_email"]),
    ],
  ],
  ["review", []],
];
export function cleanAnswers(input = {}) {
  const allowed = new Set([
    "area",
    "secondary",
    "motivation",
    "scenario",
    "sample",
    "sample_url",
    "sample_path",
    "sample_name",
    "contact_email",
    "contact_phone",
    "contact_method",
    ...Object.keys(QUESTIONS),
  ]);
  const result = Object.fromEntries(
    Object.entries(input).filter(([key]) => allowed.has(key)),
  );
  for (const key of [
    "affinity",
    "design_role",
    "digital",
    "illustration_role",
    "production_role",
  ]) {
    if (!sectionsFor(result)[2][1].includes(key)) delete result[key];
  }
  if (result.secondary === result.area) delete result.secondary;
  if (result.contact_method === "phone") delete result.contact_email;
  else {
    result.contact_method = "email";
    delete result.contact_phone;
  }
  if (result.sample !== "link") delete result.sample_url;
  if (result.sample !== "file") {
    delete result.sample_path;
    delete result.sample_name;
  }
  return result;
}
export function validateSection(section, input) {
  const a = cleanAnswers(input),
    fields = sectionsFor(a).find(([key]) => key === section)?.[1] || [];
  for (const key of fields) {
    if (key === "secondary") continue;
    if (key === "area" && !AREAS.some(([k]) => k === a.area))
      return "Elige tu área principal.";
    if (QUESTIONS[key]) {
      const options = QUESTIONS[key][1].map(([k]) => k),
        values = key === "schedule" ? a[key] : [a[key]];
      if (
        !Array.isArray(values) ||
        !values.length ||
        new Set(values).size !== values.length ||
        values.some((v) => !options.includes(v))
      )
        return `Completa: ${QUESTIONS[key][0]}`;
    }
    if (
      key === "motivation" &&
      (wordCount(a[key]) < 40 || wordCount(a[key]) > 80)
    )
      return "Tu motivación debe tener de 40 a 80 palabras.";
    if (
      key === "scenario" &&
      (wordCount(a[key]) < 1 || wordCount(a[key]) > 100)
    )
      return "Responde la mini-situación en un máximo de 100 palabras.";
    if (key === "contact_email" && !validEmail(a[key]))
      return "Escribe un correo de contacto válido.";
    if (key === "contact_phone" && !normalizePhone(a[key]))
      return "Escribe un teléfono válido: 10 dígitos para México, o incluye + y el código de otro país.";
    if (key === "sample") {
      if (!["none", "link", "file"].includes(a.sample))
        return "Elige cómo presentar tu muestra o continúa sin una.";
      if (a.sample === "link") {
        try {
          const u = new URL(a.sample_url);
          if (u.protocol !== "https:") throw 0;
        } catch {
          return "La muestra debe ser un enlace HTTPS válido.";
        }
      }
      if (a.sample === "file" && !a.sample_path)
        return "Espera a que termine la carga del archivo.";
    }
  }
  return "";
}
export function validateAnswers(a) {
  for (const [section] of sectionsFor(a)) {
    const error = validateSection(section, a);
    if (error) return { section, error };
  }
  return null;
}
export function warnings(a) {
  return [
    a.community === "no" &&
      "La convocatoria está dirigida a la comunidad del Plantel Nezahualcóyotl.",
    a.workspace === "no" && "El ciclo requiere utilizar GBA Workspace.",
    a.changes === "no" &&
      "El ciclo requiere revisar cambios y entregar archivos editables.",
    a.area === "design" &&
      a.affinity === "unable" &&
      "Diseño editorial requiere poder trabajar con Affinity en Windows o Mac.",
    a.area === "illustration" &&
      a.digital === "no" &&
      "Ilustración requiere entrega digital.",
  ].filter(Boolean);
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function decisionMessage(status, handle, role = "") {
  const body = {
    accepted: `Tu postulación ha sido seleccionada para el ciclo editorial de GIMG${role ? ` en ${role}` : ""}. Confirma tu puesto desde tu GBA ID. Después coordinaremos tu acceso a GBA Workspace.`,
    reserve:
      "Tu postulación está en la lista de reserva. Si se libera una plaza, la coordinación te contactará.",
    interview:
      "Queremos conocerte mejor mediante una entrevista breve. Consulta las indicaciones de coordinación en tu GBA ID.",
    preselected:
      "Tu postulación pasó a la siguiente etapa de revisión. La decisión definitiva todavía está pendiente.",
    not_selected:
      "Gracias por participar. En este ciclo no hemos seleccionado tu postulación. Valoramos el tiempo y el interés que compartiste con GIMG.",
  };
  return `Hola, ${handle}.\n\n${body[status] || "Tu postulación sigue en revisión."}\n\nConsulta el estado en https://gba.software/convocatoria/gimg/\n\nCoordinación GIMG · GBA`;
}
