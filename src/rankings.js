import {calculate} from './engine.js';
import {CURRENCIES} from './money.js';
export const normalizeEmail=value=>String(value??'').trim().toLowerCase();
export const validEmail=email=>/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email);
export function validDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}
export function validateRanking(r){
  if(!r.name?.trim()||r.name.trim().length>100)throw new Error('Poné un nombre de hasta 100 caracteres al ranking.');
  if(!validDate(r.startDate)||!validDate(r.endDate)||r.endDate<r.startDate)throw new Error('Elegí un período válido para el ranking.');
  if(!CURRENCIES.includes(r.currency))throw new Error('Elegí la moneda del ranking.');
  if(!['public','private'].includes(r.visibility))throw new Error('Elegí la privacidad del ranking.');
  if(!Array.isArray(r.contributorEmails)||r.contributorEmails.length>50||r.contributorEmails.some(e=>!validEmail(e)))throw new Error('Revisá los correos invitados al ranking (máximo 50).');
}
export function canContributeRanking(r,user){return r.ownerId===user?.uid||r.visibility==='public'||Boolean(user?.emailVerified&&(r.contributorEmails||[]).includes(normalizeEmail(user.email)));}
export function validateRankingMatch(match,rankings){
  const rankIds=match.rankingIds||[];
  if(rankIds.length>5||new Set(rankIds).size!==rankIds.length)throw new Error('Una partida puede asociarse a hasta cinco rankings distintos.');
  if(!rankIds.length)return;
  for(const id of rankIds){const r=rankings.find(r=>r.id===id);if(!r)throw new Error('Hay un ranking no disponible. Quitá esa asociación para guardar.');if((match.currency??'ARS')!==r.currency)throw new Error(`La moneda de la partida debe ser ${r.currency} para el ranking ${r.name}.`);if(match.date<r.startDate||match.date>r.endDate)throw new Error(`La fecha de la partida está fuera del período de ${r.name}.`);}
  const emails=match.players.map(p=>normalizeEmail(p.email));
  if(emails.some(e=>!validEmail(e)))throw new Error('Para participar en un ranking, completá el correo de cada jugador.');
  if(new Set(emails).size!==emails.length)throw new Error('Dos jugadores de una partida no pueden tener el mismo correo.');
}
export function rankingEntry(match,user){
  return {id:match.id,ownerId:user.uid,ownerName:user.displayName||'Jugador',name:match.name,date:match.date,currency:match.currency??'ARS',players:match.players,teams:match.teams,games:match.games};
}
export function aggregateRanking(ranking,entries,profiles=[]){
  const people=new Map(profiles.map(p=>[normalizeEmail(p.email),{email:normalizeEmail(p.email),name:p.name,total:0,played:0,history:[]}]));
  const seen=new Set(),matches=[];
  for(const entry of [...entries].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){
    if(seen.has(entry.id))continue;seen.add(entry.id);
    let problem='';
    if(entry.date<ranking.startDate||entry.date>ranking.endDate)problem='Fuera del período';
    else if((entry.currency??'ARS')!==ranking.currency)problem='Moneda incompatible';
    const emails=entry.players.map(p=>normalizeEmail(p.email));
    if(!problem&&(emails.some(e=>!validEmail(e))||new Set(emails).size!==emails.length))problem='Revisar correos de jugadores';
    let result;
    if(!problem){try{result=calculate(entry);}catch(e){problem=e.message;}}
    matches.push({...entry,counted:!problem,problem});
    if(problem)continue;
    for(const row of result.results){const p=entry.players.find(p=>p.id===row.id),email=normalizeEmail(p.email);let person=people.get(email);if(!person){person={email,name:p.name,total:0,played:0,history:[]};people.set(email,person);}person.name=p.name;person.total+=row.total;person.played++;person.history.push({matchId:entry.id,name:entry.name,date:entry.date,total:row.total});}
  }
  const rows=[...people.values()].sort((a,b)=>(a.played?0:1)-(b.played?0:1)||b.total-a.total||a.name.localeCompare(b.name)||a.email.localeCompare(b.email));let last,position=0;
  rows.forEach((r,i)=>{if(!r.played){r.position=null;return;}if(r.total!==last)position=i+1;r.position=position;last=r.total;});
  return {rows,matches,counted:matches.filter(m=>m.counted).length,pending:matches.filter(m=>!m.counted).length};
}
