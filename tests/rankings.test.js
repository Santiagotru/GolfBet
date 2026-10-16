import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRanking,validateRanking,validateRankingMatch} from '../src/rankings.js';
const rank={id:'r',name:'Temporada',startDate:'2026-01-01',endDate:'2026-12-31',currency:'ARS',visibility:'private',contributorEmails:[]};
const entry=(id='a',date='2026-03-01')=>({id,name:'Medal',date,currency:'ARS',rankingIds:['r'],players:[{id:'p1',name:'Ana',email:'ANA@gmail.com',net:69},{id:'p2',name:'Luis',email:'luis@gmail.com',net:72}],teams:[],games:{medal:{enabled:true,mode:'step',step:1000,policies:[{mode:'prize',percent:100}]}}});
test('Acumula netos por correo estable y no duplica una partida',()=>{const a=entry(),b=entry('b');b.players[0].name='Anita';b.players[0].email='ana@gmail.com';const result=aggregateRanking(rank,[a,a,b]);assert.equal(result.counted,2);assert.equal(result.rows.length,2);assert.equal(result.rows[0].email,'ana@gmail.com');assert.equal(result.rows[0].name,'Anita');assert.equal(result.rows[0].total,200000);assert.equal(result.rows[0].played,2);});
test('Incluye NPT para mesa en saldo neto sin repartirlo',()=>{const a=entry();a.players[1].npt=true;a.players[1].net='';a.games.medal.nptPenalty=500;const r=aggregateRanking(rank,[a]);assert.equal(r.rows[0].total,100000);assert.equal(r.rows[1].total,-150000);});
test('Período inclusivo, monedas incompatibles y partidas incompletas no suman',()=>{const a=entry('a','2026-01-01'),b=entry('b','2026-12-31'),old=entry('old','2025-12-31'),foreign=entry('foreign');foreign.currency='USD';const pending=entry('pending');pending.players[0].net='';const r=aggregateRanking(rank,[a,b,old,foreign,pending]);assert.equal(r.counted,2);assert.equal(r.pending,3);assert.equal(r.rows[0].total,200000);});
test('Jugador homónimo con otro correo mantiene identidad separada',()=>{const a=entry();a.players[1].name='Ana';assert.equal(aggregateRanking(rank,[a]).rows.length,2);});
test('Valida fechas reales, período, moneda y correos de participantes',()=>{assert.throws(()=>validateRanking({...rank,startDate:'2026-02-30'}),/período/);assert.throws(()=>validateRankingMatch({...entry(),currency:'USD'},[rank]),/moneda/);const a=entry();a.players[0].email='';assert.doesNotThrow(()=>validateRankingMatch(a,[rank]));a.players[0].email='incorrecto';assert.throws(()=>validateRankingMatch(a,[rank]),/correo/);assert.throws(()=>validateRankingMatch({...entry(),date:'2027-01-01'},[rank]),/período/);});

test('Sin correo conserva identidad, homónimos separados y correo posterior no cambia saldo',()=>{
 const a=entry(),b=entry('b');
 for(const m of [a,b])for(const p of m.players){p.participantId=p.id;delete p.email;p.name='Homónimo';}
 const r=aggregateRanking(rank,[a,b],[{participantId:'p1',name:'Homónimo',email:'nuevo@example.com'},{participantId:'p2',name:'Homónimo',email:''}]);
 assert.equal(r.counted,2);assert.equal(r.rows.length,2);assert.equal(r.rows[0].email,'nuevo@example.com');assert.equal(r.rows[0].total,200000);assert.equal(r.rows[0].played,2);
});
