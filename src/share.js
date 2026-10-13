import {calculate} from './engine.js';
export function whatsappText(match){
  const r=calculate(match),currency=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);
  const name=s=>String(s).replace(/[\r\n*_~`]/g,' ').trim();
  const names=Object.fromEntries(match.players.map(p=>[p.id,name(p.name)]));
  const lines=[`⛳ *${name(match.name)}*`,match.date.split('-').reverse().join('/'),'','*Liquidación*'];
  r.results.forEach(p=>lines.push(`${name(p.name)}: ${p.total>0?'cobra':p.total<0?'paga':'saldado'} ${currency(Math.abs(p.total))}`));
  lines.push('','*Desglose por jugador*');
  r.results.forEach(p=>{lines.push(`\n*${name(p.name)}*`);p.entries.forEach(e=>lines.push(`${e.label}: aporta ${currency(e.paid)} · premio ${currency(e.won)} · saldo ${currency(e.net)}`));});
  lines.push('','*Transferencias sugeridas*');
  if(!r.transfers.length)lines.push('Todos saldados.');
  r.transfers.forEach(t=>lines.push(`${names[t.from]} → ${names[t.to]}: ${currency(t.amount)}`));
  lines.push('','GolfBet · Montos en pesos argentinos');
  return lines.join('\n');
}
