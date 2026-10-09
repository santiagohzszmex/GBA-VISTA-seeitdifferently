// Keep the same technical address and PIN mapping used by existing GBA ID accounts.
export const displayName = (value) => value.trim().replace(/\s+/g, " ");
export const authName = (value) =>
  displayName(value)
    .toLowerCase()
    .replace(
      /[áéíóúüñ]/g,
      (letter) =>
        ({ á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n" })[letter],
    )
    .replace(/\s+/g, "");
export const validName = (value) =>
  /^[a-z0-9áéíóúüñ ._-]{3,64}$/i.test(displayName(value)) &&
  /^[a-z0-9]+([._-][a-z0-9]+)*$/i.test(authName(value));
export const normalizePin = (value) => value.replace(/\D/g, "").slice(0, 4);
export const validPin = (value) => /^\d{4}$/.test(value);
export const securePin = (value) => `GBA-${value}-SecureVault`;
