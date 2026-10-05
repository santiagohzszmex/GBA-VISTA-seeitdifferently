// October edition, with a two-day grace period. Uses the visitor's local calendar.
export function isHalloweenSeason(date = new Date()) {
  return date.getMonth() === 9 || (date.getMonth() === 10 && date.getDate() <= 2);
}
export const halloweenIcon = name => `/halloween/detailed-${name}.svg`;
