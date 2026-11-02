import {canEditMatch,normalizeMatchAccess} from './permissions.js';
import {persistMatchWithRankings} from './rankings-store.js';
import {doc,setDoc,updateDoc,serverTimestamp,getDoc} from 'firebase/firestore';

export async function saveMatchToStore(db,match,user){
  if(!user?.uid)throw new Error('Iniciá sesión para guardar la partida.');
  const ref=doc(db,'matches',match.id);
  const previous=match.ownerId?(await getDoc(ref)).data():null;
  if(!canEditMatch(previous||match,user))throw new Error('No tenés permiso para editar esta partida.');
  normalizeMatchAccess(match);
  if(match.rankingIds?.length || previous?.rankingIds?.length)return persistMatchWithRankings(db,match,user,previous);
  // La lectura previa de una partida inexistente es rechazada por las reglas privadas.
  // Crear directamente; Firestore verifica autor y permisos de forma atómica.
  const {createdAt,updatedAt,...fields}=match;
  const data={...fields,ownerId:previous?.ownerId||user.uid,ownerName:previous?.ownerName||user.displayName||'Jugador',updatedAt:serverTimestamp()};
  if(match.ownerId)await updateDoc(ref,data);
  else await setDoc(ref,{...data,createdAt:serverTimestamp()});
}
