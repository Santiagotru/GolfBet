import {doc,setDoc,updateDoc,serverTimestamp} from 'firebase/firestore';

export async function saveMatchToStore(db,match,user){
  if(!user?.uid)throw new Error('Iniciá sesión para guardar la partida.');
  if(match.ownerId && match.ownerId!==user.uid)throw new Error('Solo el creador puede editar esta partida.');
  const ref=doc(db,'matches',match.id);
  // La lectura previa de una partida inexistente es rechazada por las reglas privadas.
  // Crear directamente; Firestore verifica autor y permisos de forma atómica.
  const {createdAt,updatedAt,...fields}=match;
  const data={...fields,ownerId:user.uid,ownerName:user.displayName||'Jugador',updatedAt:serverTimestamp()};
  if(match.ownerId)await updateDoc(ref,data);
  else await setDoc(ref,{...data,createdAt:serverTimestamp()});
}
