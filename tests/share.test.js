import {test} from 'node:test';
import assert from 'node:assert/strict';
import {whatsappText} from '../src/share.js';
test('Texto WhatsApp incluye fecha, saldos, desglose y transferencias sin enlace privado',()=>{
 const m={name:'Medal interno',date:'2026-10-12',visibility:'private',players:[{id:'a',name:'Ana'},{id:'b',name:'Luis'}],games:{ida:{enabled:true,amount:2000,winners:['a']}}};
 const text=whatsappText(m);assert.match(text,/12\/10\/2026/);assert.match(text,/Ana: cobra/);assert.match(text,/Luis: paga/);assert.match(text,/Desglose por jugador/);assert.match(text,/aporta/);assert.match(text,/Luis → Ana/);assert.doesNotMatch(text,/https:/);
});
