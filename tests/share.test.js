import {test} from 'node:test';
import assert from 'node:assert/strict';
import {whatsappText} from '../src/share.js';
test('Texto WhatsApp incluye fecha, saldos, ganadores y transferencias sin enlace privado',()=>{
 const m={name:'Medal interno',date:'2026-10-12',visibility:'private',players:[{id:'a',name:'Ana'},{id:'b',name:'Luis'}],games:{ida:{enabled:true,amount:2000,winners:['a']}}};
 const text=whatsappText(m);assert.match(text,/12\/10\/2026/);assert.match(text,/Ana: gana/);assert.match(text,/Luis: pierde/);assert.match(text,/\*Ida\*/);assert.match(text,/Ganadores: Ana/);assert.match(text,/Luis → Ana/);assert.doesNotMatch(text,/https:/);
});

test('WhatsApp ordena Medal/NPT, equipos con integrantes y todos los ganadores',()=>{
 const m={name:'Partida',date:'2026-10-15',players:[{id:'a',name:'Ana',net:2,team:'x'},{id:'b',name:'Luis',net:-3,team:'y'},{id:'c',name:'Pablo',net:'',npt:true,team:'x'}],teams:[{id:'x',name:'X',score:2},{id:'y',name:'Y',score:-1}],games:{medal:{enabled:true,mode:'step',step:1000,nptPenalty:500,policies:[{mode:'prize',percent:100}]},laguneada:{enabled:true,mode:'fixed',amount:1000},ida:{enabled:true,amount:1000,winners:['a']},vuelta:{enabled:true,amount:1000,winners:['b','c']},approaches:[{enabled:true,hole:14,amount:1000,winners:['c']}]}};
 const text=whatsappText(m);assert.ok(text.indexOf('1° Luis · -3')<text.indexOf('2° Ana · 2'));assert.match(text,/3° Pablo · NPT/);assert.ok(text.indexOf('1° Y · -1')<text.indexOf('2° X · 2'));assert.match(text,/Integrantes: Ana, Pablo/);assert.match(text,/Ganadores: Luis, Pablo/);assert.match(text,/Approach · hoyo 14/);assert.match(text,/Penalidad adicional NPT/);
});
