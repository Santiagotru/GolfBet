export const CURRENCIES=['ARS','USD','UYU'];
export function formatMoney(cents,code='ARS'){
  return new Intl.NumberFormat('es-AR',{style:'currency',currency:code,currencyDisplay:'code',maximumFractionDigits:2}).format(cents/100);
}
