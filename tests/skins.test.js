import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../src/engine.js';
import {whatsappText} from '../src/share.js';
const fixture=()=>({name:'Skins',date:'2026-10-15',players:[{id:'a',name:'Ana'},{id:'b',name:'Luis'},{id:'c',name:'Pablo'}],games:{skins:{enabled:true,amount:1000,range:'front',carry:true,holes:Array.from({length:18},(_,i)=>({hole:i+1,winner:'tie'}))}}});
const row=(r,id)=>r.results.find(p=>p.id===id);
function balanced(r){assert.equal(r.results.reduce((s,p)=>s+p.total,0)+r.tableTotal,0);for(const p of r.results)assert.equal(r.transfers.filter(t=>t.to===p.id).reduce((s,t)=>s+t.amount,0)-r.transfers.filter(t=>t.from===p.id).reduce((s,t)=>s+t.amount,0),p.total);}
test('Ganador recibe pozo acumulado, empate final se devuelve',()=>{const m=fixture();m.games.skins.holes[2].winner='a';const r=calculate(m);assert.equal(r.skins.holes[2].skins,3);assert.equal(r.skins.holes[2].pot,900000);assert.equal(row(r,'a').total,600000);assert.equal(row(r,'b').total,-300000);assert.equal(r.skins.refundPerPlayer,600000);balanced(r);});
test('Sin acumulación se devuelven los aportes de empates',()=>{const m=fixture();m.games.skins.carry=false;m.games.skins.holes[2].winner='a';const r=calculate(m);assert.equal(row(r,'a').total,200000);assert.equal(row(r,'b').total,-100000);assert.equal(r.skins.refundPerPlayer,800000);balanced(r);});
test('Todos empatan: nadie paga ni gana',()=>{const r=calculate(fixture());assert.ok(r.results.every(p=>p.total===0));assert.equal(r.skins.pending,9);balanced(r);});
test('Vuelta usa hoyos 10 al 18 sin arrastrar Ida',()=>{const m=fixture();m.games.skins.range='back';m.games.skins.holes[0].winner='a';m.games.skins.holes[9].winner='b';const r=calculate(m);assert.equal(r.skins.holes[0].hole,10);assert.equal(row(r,'b').total,200000);balanced(r);});
test('18 hoyos conserva centavos',()=>{const m=fixture();m.games.skins.range='full';m.games.skins.amount=.01;m.games.skins.holes.forEach((h,i)=>h.winner=i%2?'a':'b');const r=calculate(m);assert.equal(r.skins.holes.length,18);assert.equal(row(r,'c').total,-18);balanced(r);});
test('Rechaza pendientes, ganadores inexistentes y hoyos duplicados',()=>{const m=fixture();m.games.skins.holes[0].winner='';assert.throws(()=>calculate(m),/hoyo 1/);m.games.skins.holes[0].winner='otro';assert.throws(()=>calculate(m),/hoyo 1/);m.games.skins.holes[0].hole=2;assert.throws(()=>calculate(m),/todos los hoyos/);});
test('Skins entra en WhatsApp sin transferencias sugeridas',()=>{const m=fixture();m.games.skins.holes[0].winner='a';const text=whatsappText(m);assert.match(text,/Skins Game/);assert.match(text,/Hoyo 1: Ana/);assert.match(text,/Devuelto por jugador/);assert.doesNotMatch(text,/Transferencias sugeridas/);});
