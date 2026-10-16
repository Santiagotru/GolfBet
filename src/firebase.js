import {listRankingsFromStore,saveRankingToStore,rankingDetailsFromStore,rankingRosterFromStore,updateRankingPlayerFromStore,resolveMatchProfiles} from './rankings-store.js';
import {saveMatchToStore} from './persistence.js';
import {initializeApp} from 'firebase/app';
import {getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged} from 'firebase/auth';
import {getFirestore,collection,doc,getDoc,getDocs,query,where,limit} from 'firebase/firestore';
const e=import.meta.env;
export const configured=Boolean(e.VITE_FIREBASE_API_KEY && e.VITE_FIREBASE_AUTH_DOMAIN && e.VITE_FIREBASE_PROJECT_ID && e.VITE_FIREBASE_APP_ID);
let auth,db;
if(configured){
  const app=initializeApp({apiKey:e.VITE_FIREBASE_API_KEY,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,projectId:e.VITE_FIREBASE_PROJECT_ID,appId:e.VITE_FIREBASE_APP_ID});
  auth=getAuth(app);db=getFirestore(app);
}
export const watchAuth=fn=>configured?onAuthStateChanged(auth,fn):(fn(null),()=>{});
export const login=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth);
export const saveMatch=(match,user)=>saveMatchToStore(db,match,user);
export async function listMatches(){
  const user=auth.currentUser;
  if(!user)return [];
  const queries=[query(collection(db,'matches'),where('ownerId','==',user.uid),limit(100)),query(collection(db,'matches'),where('visibility','==','public'),limit(100))];
  if(user.email && user.emailVerified)queries.push(query(collection(db,'matches'),where('sharedEmails','array-contains',user.email.toLowerCase()),limit(100)));
  const snapshots=await Promise.all(queries.map(q=>getDocs(q)));
  const unique=new Map();snapshots.forEach(s=>s.docs.forEach(d=>unique.set(d.id,{...d.data(),id:d.id})));
  return [...unique.values()].sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0));
}
export async function loadMatch(id){
  const snapshot=await getDoc(doc(db,'matches',id));
  if(!snapshot.exists())throw new Error('La partida no existe.');
  return resolveMatchProfiles(db,{...snapshot.data(),id:snapshot.id});
}

export const listRankings=()=>listRankingsFromStore(db,auth.currentUser);
export const saveRanking=(ranking,user)=>saveRankingToStore(db,ranking,user);
export const rankingDetails=id=>rankingDetailsFromStore(db,id);
export const rankingRoster=ids=>rankingRosterFromStore(db,ids);

export const updateRankingPlayer=(rankId,playerId,email,user)=>updateRankingPlayerFromStore(db,rankId,playerId,email,user);
