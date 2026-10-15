export class ValidationError extends Error {}
const fail = message => { throw new ValidationError(message); };
const money = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) fail('Los montos deben ser números positivos y menores a mil millones.');
  return Math.round(n * 100);
};
function split(total, ids) {
  if (!ids.length) fail('Faltan ganadores para repartir el pozo.');
  const base = Math.floor(total / ids.length), rest = total % ids.length;
  return new Map(ids.map((id, i) => [id, base + (i < rest ? 1 : 0)]));
}
function groups(items, score) {
  return [...items].sort((a,b) => score(a)-score(b) || a.id.localeCompare(b.id))
    .reduce((out, item) => {
      const last = out.at(-1);
      if (last && score(last[0]) === score(item)) last.push(item); else out.push([item]);
      return out;
    }, []);
}
export function parseScore(value) {
  if(value==null || String(value).trim()==='')return NaN;
  return Number(String(value).trim().replace('−','-').replace(',','.'));
}
export const medalGroups = players => groups(players,p=>p.npt?Infinity:parseScore(p.net));
export function calculate(match) {
  const players = match.players || [];
  if (players.length < 2) fail('Agregá al menos dos jugadores.');
  const ids = players.map(p => p.id);
  if (new Set(ids).size !== ids.length || players.some(p => !p.id || !p.name?.trim())) fail('Los jugadores deben tener nombre e identificador único.');
  const rows = new Map(players.map(p => [p.id, {id:p.id, name:p.name, entries:[], total:0}]));
  const pots = [];
  function record(label, charges, prizes) {
    const pot = [...charges.values()].reduce((a,b)=>a+b,0);
    if (pot !== [...prizes.values()].reduce((a,b)=>a+b,0)) fail(`El reparto de ${label} no suma el pozo completo.`);
    for (const p of players) {
      const paid = charges.get(p.id) || 0, won = prizes.get(p.id) || 0;
      rows.get(p.id).entries.push({label, paid, won, net:won-paid});
      rows.get(p.id).total += won-paid;
    }
    pots.push({label, total:pot});
  }
  function fixed(label, amount, winners) {
    if (!Array.isArray(winners) || !winners.length || new Set(winners).size !== winners.length || winners.some(id=>!rows.has(id))) fail(`Elegí los ganadores de ${label}.`);
    const charges = new Map(ids.map(id=>[id,money(amount)]));
    record(label,charges,split(money(amount)*players.length,[...winners].sort()));
  }
  const games = match.games || {};
  for (const key of ['ida','vuelta']) if (games[key]?.enabled) fixed(key==='ida'?'Ida · 9 hoyos':'Vuelta · 9 hoyos',games[key].amount,games[key].winners);
  if (games.medal?.enabled) {
    const c=games.medal;
    if (players.every(p=>p.npt)) fail('Medal necesita al menos una tarjeta presentada para repartir premios.');
    if (players.some(p=>!p.npt && !Number.isFinite(parseScore(p.net)))) fail('Completá el score neto de todos los jugadores para Medal.');
    const ranked=medalGroups(players);
    const policies = c.policies || [{mode:'prize',percent:100}];
    const charges=new Map(), weights=new Map();
    let position=0, payingPosition=0;
    for (const tied of ranked) {
      const slots = tied.map((p,i)=>p.npt?{mode:'pay'}:policies[position+i] || {mode:'pay'});
      const prizePercent=slots.reduce((sum,s)=>sum+(s.mode==='prize'?Number(s.percent):0),0);
      if (slots.some(s=>!['pay','exempt','prize'].includes(s.mode) || (s.mode==='prize' && (!Number.isFinite(Number(s.percent)) || Number(s.percent)<0 || Number(s.percent)>100))) || !Number.isFinite(prizePercent)) fail('Revisá las reglas de puestos de Medal.');
      let charge=0;
      // Todos los empatados de un puesto premiado comparten su premio y están exentos.
      if (!prizePercent) {
        const slotCharges=slots.map(s=>{
          if(s.mode!=='pay')return 0;
          payingPosition++;
          return c.mode==='fixed'?money(c.amount):money(c.step)*payingPosition;
        });
        charge = c.tieMode==='same' ? slotCharges[0] : slotCharges.reduce((a,b)=>a+b,0)/tied.length;
      }
      // Redondeo compartido a centavos: la suma conserva el aporte del grupo.
      const shared=split(Math.round(charge*tied.length),tied.map(p=>p.id));
      tied.forEach(p=>{charges.set(p.id,shared.get(p.id)); weights.set(p.id,prizePercent/tied.length);});
      position+=tied.length;
    }
    const totalWeight=[...weights.values()].reduce((a,b)=>a+b,0);
    if (Math.abs(totalWeight-100)>0.000001) fail('Los porcentajes de los puestos presentes en Medal deben sumar 100%.');
    function award(label, charges){
      const pot=[...charges.values()].reduce((a,b)=>a+b,0);
      const recipients=players.filter(p=>weights.get(p.id)>0).map(p=>({id:p.id,raw:pot*weights.get(p.id)/100}));
      const prizes=new Map(recipients.map(p=>[p.id,Math.floor(p.raw)]));
      const cents=pot-[...prizes.values()].reduce((a,b)=>a+b,0);
      recipients.sort((a,b)=>(b.raw-Math.floor(b.raw))-(a.raw-Math.floor(a.raw)) || a.id.localeCompare(b.id));
      for(let i=0;i<cents;i++) prizes.set(recipients[i].id,prizes.get(recipients[i].id)+1);
      record(label,charges,prizes);
    }
    award('Medal · neto',charges);
    const penalty=money(c.nptPenalty ?? 0);
    if(penalty && players.some(p=>p.npt))award('Medal · penalidad NPT',new Map(players.map(p=>[p.id,p.npt?penalty:0])));

  }
  if (games.laguneada?.enabled) {
    const c=games.laguneada, teams=match.teams || [];
    if (teams.length<2 || new Set(teams.map(t=>t.id)).size!==teams.length) fail('Laguneada necesita al menos dos equipos distintos.');
    if (players.some(p=>!teams.some(t=>t.id===p.team)) || teams.some(t=>!players.some(p=>p.team===t.id))) fail('Asigná cada jugador a un equipo y evitá equipos vacíos.');
    if (teams.some(t=>!Number.isFinite(parseScore(t.score)))) fail('Completá los scores de todos los equipos.');
    const ranked=groups(teams,t=>parseScore(t.score)), charges=new Map();
    let position=0;
    ranked.forEach((tied,index)=>{
      const multiplier=c.tieMode==='same'?position:position+(tied.length-1)/2;
      const amount=c.mode==='fixed'?money(c.amount):(index===0?0:Math.round(money(c.step)*multiplier));
      players.filter(p=>tied.some(t=>t.id===p.team)).forEach(p=>charges.set(p.id,amount));
      position+=tied.length;
    });
    const winnerIds=players.filter(p=>ranked[0].some(t=>t.id===p.team)).map(p=>p.id).sort();
    // Equipos empatados comparten el pozo por equipo, luego entre sus integrantes.
    const pot=[...charges.values()].reduce((a,b)=>a+b,0), prizes=new Map();
    const teamPrizes=split(pot,ranked[0].map(t=>t.id));
    ranked[0].forEach(t=>split(teamPrizes.get(t.id),winnerIds.filter(id=>players.find(p=>p.id===id).team===t.id)).forEach((n,id)=>prizes.set(id,n)));
    record('Laguneada · por jugador',charges,prizes);
  }
  const holes=new Set();
  for (const a of games.approaches || []) if(a.enabled) {
    const hole=Number(a.hole);
    if(!Number.isInteger(hole)||hole<1||hole>18||holes.has(hole)) fail('Los hoyos de Approach deben ser distintos y estar entre 1 y 18.');
    holes.add(hole); fixed(`Approach · hoyo ${hole}`,a.amount,a.winners);
  }
  if (!pots.length) fail('Activá al menos una apuesta.');
  const results=[...rows.values()].sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
  const debtors=results.filter(r=>r.total<0).map(r=>({id:r.id,left:-r.total}));
  const creditors=results.filter(r=>r.total>0).map(r=>({id:r.id,left:r.total}));
  const transfers=[]; let i=0,j=0;
  while(i<debtors.length && j<creditors.length) {
    const n=Math.min(debtors[i].left,creditors[j].left);
    transfers.push({from:debtors[i].id,to:creditors[j].id,amount:n});
    debtors[i].left-=n;creditors[j].left-=n;
    if(!debtors[i].left)i++;if(!creditors[j].left)j++;
  }
  return {results,pots,transfers};
}
