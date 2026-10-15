import {calculate,medalGroups,parseScore} from './engine.js';
export function whatsappText(match){
  const r=calculate(match),currency=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);
  const name=s=>String(s).replace(/[\r\n*_~`]/g,' ').trim();
  const names=Object.fromEntries(match.players.map(p=>[p.id,name(p.name)]));
  const lines=[`⛳ *${name(match.name)}*`,match.date.split('-').reverse().join('/'),'','*Liquidación*'];
  r.results.forEach(p=>lines.push(`${name(p.name)}: ${p.total>0?'gana':p.total<0?'pierde':'saldado'} ${currency(Math.abs(p.total))}`));
  const g=match.games;
  if(g.medal?.enabled){
    lines.push('','*Medal · score neto*');let rank=1;
    for(const tied of medalGroups(match.players)){tied.forEach(p=>lines.push(`${rank}° ${name(p.name)} · ${p.npt?'NPT':parseScore(p.net)}${tied.length>1?' (empate)':''}`));rank+=tied.length;}
    if(g.medal.nptPenalty>0)lines.push(`Penalidad adicional NPT: ${currency(Math.round(g.medal.nptPenalty*100))} por jugador · para la mesa, no se reparte.`);
  }
  if(g.laguneada?.enabled){
    lines.push('','*Laguneada · score de equipo*');let lastScore,rank;
    [...match.teams].sort((a,b)=>parseScore(a.score)-parseScore(b.score)||a.id.localeCompare(b.id)).forEach((t,i)=>{
      const score=parseScore(t.score);if(score!==lastScore)rank=i+1;lastScore=score;
      const members=match.players.filter(p=>p.team===t.id).map(p=>name(p.name)).join(', ');
      lines.push(`${rank}° ${name(t.name)} · ${score}`,`Integrantes: ${members}`);
    });
  }
  for(const key of ['ida','vuelta'])if(g[key]?.enabled)lines.push('',`*${key==='ida'?'Ida':'Vuelta'}*`,`Ganadores: ${g[key].winners.map(id=>names[id]).join(', ')}`);
  for(const a of g.approaches||[])if(a.enabled)lines.push('',`*Approach · hoyo ${a.hole}*`,`Ganadores: ${a.winners.map(id=>names[id]).join(', ')}`);
  if(r.skins){
    lines.push('','*Skins Game*');
    r.skins.holes.forEach(h=>lines.push(`Hoyo ${h.hole}: ${h.winner?`${names[h.winner]} · ${h.skins} skin(s) · ${currency(h.pot)}`:h.status==='carry'?'empate · acumula':'empate · aporte devuelto'} · valor por jugador ${currency(h.amount)}`));
    if(r.skins.refundPerPlayer)lines.push(`Devuelto por jugador: ${currency(r.skins.refundPerPlayer)} (incluido en el saldo).`);
  }
  if(r.tableTotal)lines.push('',`*Para la mesa: ${currency(r.tableTotal)}*`);
  lines.push('','GolfBet · Montos en pesos argentinos');
  return lines.join('\n');
}
