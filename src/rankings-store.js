import {collection,doc,getDoc,getDocs,query,where,limit,setDoc,updateDoc,serverTimestamp,writeBatch} from 'firebase/firestore';
import {normalizeEmail,validateRanking,canContributeRanking,validateRankingMatch,rankingEntry} from './rankings.js';
export async function listRankingsFromStore(db,user){
  const queries=[query(collection(db,'rankings'),where('ownerId','==',user.uid),limit(100)),query(collection(db,'rankings'),where('visibility','==','public'),limit(100))];
  const email=user.emailVerified?normalizeEmail(user.email):'';
  if(email)queries.push(query(collection(db,'rankings'),where('contributorEmails','array-contains',email),limit(100)));
  const snapshots=await Promise.all(queries.map(q=>getDocs(q))),map=new Map();
  snapshots.forEach(s=>s.docs.forEach(d=>map.set(d.id,{...d.data(),id:d.id})));
  const participating=new Set();
  if(email){const memberships=await getDocs(query(collection(db,'rankingAccess',email,'rankings'),limit(100)));for(const membership of memberships.docs){participating.add(membership.id);if(!map.has(membership.id)){try{const snap=await getDoc(doc(db,'rankings',membership.id));if(snap.exists())map.set(snap.id,{...snap.data(),id:snap.id});}catch(e){if(e.code!=='permission-denied'&&e.code!=='not-found')throw e;}}}}
  return [...map.values()].map(r=>({...r,participating:participating.has(r.id),canContribute:canContributeRanking(r,user)})).sort((a,b)=>a.name.localeCompare(b.name));
}
export async function saveRankingToStore(db,r,user){
  const data={id:r.id,name:r.name.trim(),startDate:r.startDate,endDate:r.endDate,currency:r.currency,visibility:r.visibility,contributorEmails:[...new Set((r.contributorEmails||[]).map(normalizeEmail).filter(Boolean))],ownerId:user.uid,ownerName:user.displayName||'Jugador',updatedAt:serverTimestamp()};
  validateRanking(data);
  if(r.ownerId){if(r.ownerId!==user.uid)throw new Error('Solo el creador puede modificar el ranking.');await updateDoc(doc(db,'rankings',r.id),data);}
  else await setDoc(doc(db,'rankings',r.id),{...data,createdAt:serverTimestamp()});
}
export async function loadRankingFromStore(db,id){const s=await getDoc(doc(db,'rankings',id));if(!s.exists())throw new Error('El ranking no existe.');return {...s.data(),id:s.id};}
export async function rankingDetailsFromStore(db,id){
  const [ranking,entries,profiles]=await Promise.all([loadRankingFromStore(db,id),getDocs(collection(db,'rankings',id,'entries')),getDocs(collection(db,'rankings',id,'players'))]);
  return {ranking,entries:entries.docs.map(d=>({...d.data(),id:d.id})),profiles:profiles.docs.map(d=>d.data())};
}
export async function rankingRosterFromStore(db,ids){
  const snapshots=await Promise.all(ids.map(id=>getDocs(collection(db,'rankings',id,'players'))));const people=new Map();snapshots.forEach(s=>s.docs.forEach(d=>people.set(d.id,d.data())));return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export async function persistMatchWithRankings(db,match,user,previous){
  const ids=[...new Set(match.rankingIds||[])],ranks=await Promise.all(ids.map(id=>loadRankingFromStore(db,id)));
  validateRankingMatch({...match,rankingIds:ids},ranks);
  if(ranks.some(r=>!canContributeRanking(r,user)))throw new Error('No tenés permiso para agregar partidas a uno de los rankings seleccionados. Quitá esa asociación o pedí acceso al creador.');
  const {createdAt,updatedAt,...fields}=match;
  const data={...fields,rankingIds:ids,ownerId:user.uid,ownerName:user.displayName||'Jugador',updatedAt:serverTimestamp()};
  const batch=writeBatch(db),ref=doc(db,'matches',match.id);
  if(match.ownerId)batch.update(ref,data);else batch.set(ref,{...data,createdAt:serverTimestamp()});
  for(const id of ids)batch.set(doc(db,'rankings',id,'entries',match.id),{...rankingEntry(data,user),updatedAt:serverTimestamp()});
  for(const id of previous?.rankingIds||[])if(!ids.includes(id))batch.delete(doc(db,'rankings',id,'entries',match.id));
  await batch.commit();
  // Registrar participantes en lotes pequeños para respetar el límite de lecturas de reglas.
  try{for(const id of ids)for(let i=0;i<match.players.length;i+=6){const registration=writeBatch(db);for(const player of match.players.slice(i,i+6)){const email=normalizeEmail(player.email);registration.set(doc(db,'rankings',id,'players',email),{name:player.name,email});registration.set(doc(db,'rankingAccess',email,'rankings',id),{rankingId:id,email});}await registration.commit();}}
  catch{return {warning:'La partida se guardó, pero faltó registrar participantes del ranking. Volvé a guardar para completar el registro.'};}
  return {};
}
