export const CURRENCIES=['ARS','USD','UYU'];
// Los cálculos siguen usando centavos internamente; la unidad liquidable es 100 ARS o 1 USD/UYU.
export const moneyUnit=(code='ARS')=>code==='ARS'?10000:100;
export function roundMoney(cents,code='ARS'){
  const unit=moneyUnit(code);
  return Math.sign(cents)*Math.round(Math.abs(cents)/unit)*unit || 0;
}
export function formatMoney(cents,code='ARS'){
  return new Intl.NumberFormat('es-AR',{style:'currency',currency:code,currencyDisplay:'code',minimumFractionDigits:0,maximumFractionDigits:0}).format(roundMoney(cents,code)/100);
}
