import assert from 'node:assert/strict';
import {saveMatchToStore} from '../src/persistence.js';
import {test,before,after,beforeEach} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,collection,getDocs,query,where} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-golfbet',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});
const data=()=>({id:'match1',name:'Medal interno',date:'2026-10-12',holes:18,players:[{id:'a',name:'Ana'},{id:'b',name:'Luis'}],teams:[],games:{},ownerId:'owner',ownerName:'Ana',visibility:'public',sharedEmails:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
async function create(){const db=env.authenticatedContext('owner').firestore();await setDoc(doc(db,'matches','match1'),data());return db;}
test('Creador puede crear y editar; otro usuario puede leer y listar',async()=>{const db=await create();await assertSucceeds(updateDoc(doc(db,'matches','match1'),{name:'Nueva fecha',updatedAt:serverTimestamp()}));const viewer=env.authenticatedContext('viewer').firestore();await assertSucceeds(getDoc(doc(viewer,'matches','match1')));await assertSucceeds(getDocs(query(collection(viewer,'matches'),where('visibility','==','public'))));});
test('Sin registro no se puede leer ni crear',async()=>{await create();const db=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,'matches','match1')));await assertFails(setDoc(doc(db,'matches','match2'),{...data(),id:'match2'}));});
test('Otro usuario no puede editar, borrar ni apropiarse de una partida',async()=>{await create();const db=env.authenticatedContext('viewer').firestore();await assertFails(updateDoc(doc(db,'matches','match1'),{name:'Modificado',updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db,'matches','match1'),{ownerId:'viewer',updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db,'matches','match1')));});
test('No se puede suplantar al creador ni cambiar createdAt',async()=>{const db=await create();await assertFails(updateDoc(doc(db,'matches','match1'),{ownerId:'another',updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db,'matches','match1'),{createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));const viewer=env.authenticatedContext('viewer').firestore();await assertFails(setDoc(doc(viewer,'matches','match2'),{...data(),id:'match2'}));});
test('Documento inválido se rechaza, creador puede borrar',async()=>{const db=await create();await assertFails(updateDoc(doc(db,'matches','match1'),{name:'',updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db,'matches','match1'),{extra:'unexpected',updatedAt:serverTimestamp()}));await assertSucceeds(deleteDoc(doc(db,'matches','match1')));});

test('Privada: solo creador puede leer, incluso con enlace',async()=>{const owner=await create();await updateDoc(doc(owner,'matches','match1'),{visibility:'private',updatedAt:serverTimestamp()});await assertSucceeds(getDoc(doc(owner,'matches','match1')));const other=env.authenticatedContext('other',{email:'otro@gmail.com',email_verified:true}).firestore();await assertFails(getDoc(doc(other,'matches','match1')));await assertSucceeds(getDocs(query(collection(owner,'matches'),where('ownerId','==','owner'))));});
test('Compartida: correo verificado autorizado puede leer/listar, no editar; revocar funciona',async()=>{const owner=await create();await updateDoc(doc(owner,'matches','match1'),{visibility:'shared',sharedEmails:['amigo@gmail.com'],updatedAt:serverTimestamp()});const friend=env.authenticatedContext('friend',{email:'amigo@gmail.com',email_verified:true}).firestore();await assertSucceeds(getDoc(doc(friend,'matches','match1')));await assertSucceeds(getDocs(query(collection(friend,'matches'),where('sharedEmails','array-contains','amigo@gmail.com'))));await assertFails(updateDoc(doc(friend,'matches','match1'),{name:'No permitido',updatedAt:serverTimestamp()}));const other=env.authenticatedContext('other',{email:'otro@gmail.com',email_verified:true}).firestore();await assertFails(getDoc(doc(other,'matches','match1')));const unverified=env.authenticatedContext('unverified',{email:'amigo@gmail.com',email_verified:false}).firestore();await assertFails(getDoc(doc(unverified,'matches','match1')));await updateDoc(doc(owner,'matches','match1'),{visibility:'private',sharedEmails:[],updatedAt:serverTimestamp()});await assertFails(getDoc(doc(friend,'matches','match1')));});
test('No se puede mantener lista de acceso en partida privada',async()=>{const owner=await create();await assertFails(updateDoc(doc(owner,'matches','match1'),{visibility:'private',sharedEmails:['amigo@gmail.com'],updatedAt:serverTimestamp()}));});

test('Guardado real crea sin lectura previa y permite guardar otra vez antes de recargar',async()=>{
 const user={uid:'owner',displayName:'Ana'},db=env.authenticatedContext('owner').firestore();
 for(const visibility of ['private','public','shared']){
  const m={...data(),id:'new-'+visibility,visibility,sharedEmails:visibility==='shared'?['amigo@gmail.com']:[]};
  delete m.ownerId;delete m.ownerName;delete m.createdAt;delete m.updatedAt;
  // Reproduce el error original: una sesión válida no puede leer un documento inexistente.
  await assertFails(getDoc(doc(db,'matches',m.id)));
  await assertSucceeds(saveMatchToStore(db,m,user));
  const first=await getDoc(doc(db,'matches',m.id));
  const created=first.data().createdAt;
  m.ownerId=user.uid;m.name='Resultados actualizados';
  await assertSucceeds(saveMatchToStore(db,m,user));
  const second=await getDoc(doc(db,'matches',m.id));
  if(second.data().name!==m.name || !second.data().createdAt.isEqual(created))throw new Error('Se perdió la actualización o fecha de creación.');
 }
});
test('Guardar no permite sobrescribir una partida privada ajena',async()=>{
 const owner=env.authenticatedContext('owner').firestore();const m={...data(),visibility:'private'};delete m.ownerId;
 await saveMatchToStore(owner,m,{uid:'owner',displayName:'Ana'});
 const other=env.authenticatedContext('other').firestore();
 const attack={...data(),visibility:'private'};delete attack.ownerId;
 await assertFails(saveMatchToStore(other,attack,{uid:'other',displayName:'Otro'}));
});

test('Permite guardar las tres monedas y documentos anteriores sin moneda',async()=>{const db=await create();for(const currency of ['ARS','USD','UYU'])await assertSucceeds(updateDoc(doc(db,'matches','match1'),{currency,updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db,'matches','match1'),{currency:'EUR',updatedAt:serverTimestamp()}));});

test('Rankings privados: invitado agrega su partida, participante la encuentra al entrar y otro usuario no puede leer',async()=>{
 const {saveRankingToStore,rankingDetailsFromStore,listRankingsFromStore}=await import('../src/rankings-store.js');
 const owner={uid:'owner',displayName:'Creador',email:'owner@gmail.com',emailVerified:true};const db=env.authenticatedContext(owner.uid,{email:owner.email,email_verified:true}).firestore();
 const rank={id:'rank1',name:'Temporada',startDate:'2026-01-01',endDate:'2026-12-31',currency:'ARS',visibility:'private',contributorEmails:['invited@gmail.com']};await saveRankingToStore(db,rank,owner);
 const invited={uid:'invited',displayName:'Invitado',email:'invited@gmail.com',emailVerified:true};const invitedDb=env.authenticatedContext(invited.uid,{email:invited.email,email_verified:true}).firestore();
 const m={id:'linked1',name:'Partida invitada',date:'2026-06-01',currency:'ARS',holes:18,visibility:'private',sharedEmails:[],rankingIds:['rank1'],players:[{id:'a',name:'Ana',email:'ana@gmail.com',net:69},{id:'b',name:'Luis',email:'luis@gmail.com',net:72}],teams:[],games:{medal:{enabled:true,mode:'step',step:1000,policies:[{mode:'prize',percent:100}]}}};
 const outcome=await saveMatchToStore(invitedDb,m,invited);if(outcome?.warning)throw new Error(outcome.warning);
 const participant={uid:'ana',email:'ana@gmail.com',emailVerified:true},participantDb=env.authenticatedContext(participant.uid,{email:participant.email,email_verified:true}).firestore();
 const found=await listRankingsFromStore(participantDb,participant);if(!found.some(r=>r.id==='rank1'&&r.participating&&!r.canContribute))throw new Error('No se descubrió el ranking del participante.');
 await assert.rejects(saveMatchToStore(participantDb,{...m,id:'blocked'},participant),/permiso/);
 const detail=await rankingDetailsFromStore(participantDb,'rank1');if(detail.entries.length!==1||detail.profiles.length!==2)throw new Error('Faltan partida o participantes.');
 const other=env.authenticatedContext('other',{email:'other@gmail.com',email_verified:true}).firestore();await assertFails(getDoc(doc(other,'rankings','rank1')));await assertFails(getDoc(doc(other,'rankings','rank1','entries','linked1')));
 await assert.rejects(saveRankingToStore(invitedDb,{...rank,ownerId:'owner',name:'No permitido'},invited),/creador/);await assertFails(updateDoc(doc(invitedDb,'rankings','rank1'),{name:'No permitido',updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(invitedDb,'matches','linked1'),{name:'Sin sincronizar',updatedAt:serverTimestamp()}));
 m.ownerId=invited.uid;m.players[0].net=80;await saveMatchToStore(invitedDb,m,invited);const changed=await getDoc(doc(db,'rankings','rank1','entries','linked1'));if(changed.data().players[0].net!==80)throw new Error('No se sincronizó edición.');
 m.rankingIds=[];await saveMatchToStore(invitedDb,m,invited);if((await getDoc(doc(db,'rankings','rank1','entries','linked1'))).exists())throw new Error('No se quitó la asociación.');
});
test('Ranking público admite partidas propias de terceros y rechaza moneda/fecha incorrectas',async()=>{
 const {saveRankingToStore,listRankingsFromStore}=await import('../src/rankings-store.js');const owner={uid:'owner',displayName:'Owner'};const db=env.authenticatedContext('owner').firestore();
 await saveRankingToStore(db,{id:'public1',name:'Abierto',startDate:'2026-01-01',endDate:'2026-12-31',currency:'ARS',visibility:'public',contributorEmails:[]},owner);
 const outsider={uid:'outside',displayName:'Outside'},other=env.authenticatedContext('outside').firestore();if((await listRankingsFromStore(other,outsider)).length!==1)throw new Error('No se listó ranking público.');
 const m={...data(),id:'publicmatch',rankingIds:['public1'],currency:'ARS',players:[{id:'a',name:'Ana',email:'ana@gmail.com'},{id:'b',name:'Luis',email:'luis@gmail.com'}]};delete m.ownerId;delete m.createdAt;delete m.updatedAt;
 const outcome=await saveMatchToStore(other,m,outsider);if(outcome?.warning)throw new Error(outcome.warning);
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'rankings','public1')));
 await assert.rejects(saveMatchToStore(other,{...m,id:'foreign',currency:'USD'},outsider),/moneda/);await assert.rejects(saveMatchToStore(other,{...m,id:'old',date:'2025-01-01'},outsider),/período/);
});
test('Una partida se sincroniza con cinco rankings sin duplicados',async()=>{
 const {saveRankingToStore}=await import('../src/rankings-store.js');const user={uid:'owner',displayName:'Owner'},db=env.authenticatedContext('owner').firestore();const ids=Array.from({length:5},(_,i)=>'r'+i);
 for(const id of ids)await saveRankingToStore(db,{id,name:id,startDate:'2026-01-01',endDate:'2026-12-31',currency:'ARS',visibility:'public',contributorEmails:[]},user);
 const m={...data(),id:'multi',currency:'ARS',rankingIds:ids,players:[{id:'a',name:'Ana',email:'ana@gmail.com'},{id:'b',name:'Luis',email:'luis@gmail.com'}]};delete m.ownerId;delete m.createdAt;delete m.updatedAt;
 const outcome=await saveMatchToStore(db,m,user);if(outcome?.warning)throw new Error(outcome.warning);m.ownerId=user.uid;await saveMatchToStore(db,m,user);
 for(const id of ids)if((await getDocs(collection(db,'rankings',id,'entries'))).size!==1)throw new Error('La partida se duplicó.');
});

test('Backend rechaza snapshot de ranking adulterado y alta fuera del período',async()=>{
 const {saveRankingToStore}=await import('../src/rankings-store.js');const {writeBatch}=await import('firebase/firestore');const {rankingEntry}=await import('../src/rankings.js');const user={uid:'owner',displayName:'Owner'},db=env.authenticatedContext('owner').firestore();
 await saveRankingToStore(db,{id:'r',name:'R',startDate:'2026-01-01',endDate:'2026-12-31',currency:'ARS',visibility:'public',contributorEmails:[]},user);
 for(const variant of ['date','snapshot']){const m={...data(),id:'bad-'+variant,ownerName:'Owner',currency:'ARS',rankingIds:['r'],date:variant==='date'?'2025-01-01':'2026-06-01'};const e={...rankingEntry(m,user),updatedAt:serverTimestamp()};if(variant==='snapshot')e.name='Adulterado';const batch=writeBatch(db);batch.set(doc(db,'matches',m.id),m);batch.set(doc(db,'rankings','r','entries',m.id),e);await assertFails(batch.commit());}
});
