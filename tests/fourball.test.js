import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../src/engine.js';
import {whatsappText} from '../src/share.js';
import {formatMoney} from '../src/money.js';
const fixture=(scores=[68,70,72])=>({currency:'USD',name:'Fourball',date:'2026-10-16',players:scores.flatMap((_,i)=>[{id:`p${i}a`,name:`Jugador ${i}A`,fourballTeam:`t${i}`},{id:`p${i}b`,name:`Jugador ${i}B`,fourballTeam:`t${i}`}]),games:{fourball:{enabled:true,mode:'step',step:1000,amount:1000,tieMode:'average',teams:scores.map((score,i)=>({id:`t${i}`,name:`Pareja ${i}`,score})),policies:[{mode:'prize',percent:100}]}}});
const total=(r,id)=>r.results.find(p=>p.id===id).total;
function balanced(r){assert.equal(r.results.reduce((s,p)=>s+p.total,0)+r.tableTotal,0);for(const p of r.results)assert.equal(r.transfers.filter(t=>t.to===p.id).reduce((s,t)=>s+t.amount,0)-r.transfers.filter(t=>t.from===p.id).reduce((s,t)=>s+t.amount,0),p.total);}
test('Fourball cobra por jugador y reparte premios a los dos integrantes',()=>{const r=calculate(fixture());assert.equal(total(r,'p0a'),300000);assert.equal(total(r,'p0b'),300000);assert.equal(total(r,'p1a'),-100000);assert.equal(total(r,'p2b'),-200000);balanced(r);});
test('Fourball empatado promedia escalones por pareja y por jugador',()=>{const r=calculate(fixture([68,70,70]));assert.equal(total(r,'p1a'),-150000);assert.equal(total(r,'p2b'),-150000);balanced(r);});
test('Premios porcentuales: el primer equipo que paga empieza en 1000',()=>{const m=fixture([68,69,70,71]);m.games.fourball.policies=[{mode:'prize',percent:60},{mode:'prize',percent:30},{mode:'prize',percent:10}];const r=calculate(m);assert.equal(total(r,'p3a'),-100000);assert.equal(total(r,'p0a'),60000);assert.equal(total(r,'p1a'),30000);balanced(r);});
test('NPT de pareja queda último, penalidad por integrante va a la mesa',()=>{const m=fixture();m.games.fourball.teams[2].npt=true;m.games.fourball.teams[2].score='';m.games.fourball.nptPenalty=500;const r=calculate(m);assert.equal(total(r,'p2a'),-250000);assert.equal(r.tableTotal,100000);balanced(r);});
test('Fourball valida parejas de dos y scores completos',()=>{const m=fixture();m.players.pop();assert.throws(()=>calculate(m),/exactamente dos/);const n=fixture();n.games.fourball.teams[1].score='';assert.throws(()=>calculate(n),/score neto/);});
test('Fourball no exige mismas parejas que equipos laguneada',()=>{const m=fixture();m.players.forEach(p=>p.team='otro');balanced(calculate(m));});
test('WhatsApp muestra moneda, scores e integrantes de Fourball',()=>{const text=whatsappText(fixture());assert.match(text,/USD/);assert.match(text,/Fourball · score neto por pareja/);assert.match(text,/1° Pareja 0 · 68/);assert.match(text,/Jugador 0A, Jugador 0B/);assert.doesNotMatch(text,/Transferencias sugeridas/);});
test('Monedas ARS/USD/UYU mantienen los importes sin conversión',()=>{for(const code of ['ARS','USD','UYU']){const m=fixture();m.currency=code;assert.equal(total(calculate(m),'p0a'),300000);assert.match(formatMoney(123456,code),new RegExp(code));}assert.throws(()=>calculate({...fixture(),currency:'XXX'}),/moneda válida/);});

test('Fourball usa monto inicial independiente por jugador',()=>{const m=fixture();m.games.fourball.startAmount=2000;const r=calculate(m);assert.equal(total(r,'p1a'),-200000);assert.equal(total(r,'p2b'),-300000);assert.equal(total(r,'p0a'),500000);balanced(r);});
