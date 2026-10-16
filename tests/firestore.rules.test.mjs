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
