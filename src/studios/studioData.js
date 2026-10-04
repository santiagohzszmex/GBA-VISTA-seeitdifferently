export const STUDIO_ROLES = {
  owner: "Propietario",
  admin: "Administrador",
  editor: "Editor del perfil",
  member: "Colaborador",
};
export const DEFAULT_RANKS = [
  "Dirección",
  "Desarrollo",
  "Diseño",
  "Colaboración",
];
export const EMPTY_STUDIO = {
  nombre: "",
  descripcion: "",
  logo_url: "",
  portada_url: "",
  website_url: "",
  discord_url: "",
  support_url: "",
  ranks: DEFAULT_RANKS,
  portfolio: [],
};
export const studioLink = (slug) => `/?studio=${encodeURIComponent(slug)}`;
export const profileLink = (handle) =>
  `/?profile=${encodeURIComponent(handle)}`;
export const serverLink = (slug) =>
  `/?network=1&server=${encodeURIComponent(slug)}`;
export function studioPayload(studio) {
  return Object.fromEntries(
    Object.keys(EMPTY_STUDIO).map((key) => [
      key,
      studio[key] ?? EMPTY_STUDIO[key],
    ]),
  );
}
export function validateStudio(draft) {
  if (draft.nombre.trim().length < 2 || draft.descripcion.trim().length < 20)
    throw new Error(
      "Escribe un nombre y una descripción de al menos 20 caracteres.",
    );
  if (
    !draft.ranks.length ||
    draft.ranks.length > 30 ||
    draft.ranks.some((r) => !r.trim() || r.trim().length > 60)
  )
    throw new Error("Añade entre 1 y 30 cargos de hasta 60 caracteres.");
  if (
    new Set(draft.ranks.map((r) => r.trim().toLocaleLowerCase())).size !==
    draft.ranks.length
  )
    throw new Error("No repitas cargos.");
  return { ...draft, ranks: draft.ranks.map((r) => r.trim()) };
}
