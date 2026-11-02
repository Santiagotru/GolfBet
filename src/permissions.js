export const normalizedEmails=values=>[...new Set((values||[]).map(v=>String(v).trim().toLowerCase()).filter(Boolean))];
export function canEditMatch(match,user){
  if(!user?.uid)return false;
  return !match?.ownerId || match.ownerId===user.uid || Boolean(match.visibility==='shared' && user.emailVerified && (match.editorEmails||[]).includes(String(user.email||'').toLowerCase()));
}
export function normalizeMatchAccess(match){
  match.visibility ||= 'public';
  match.sharedEmails=match.visibility==='shared'?normalizedEmails(match.sharedEmails):[];
  match.editorEmails=match.visibility==='shared'?normalizedEmails(match.editorEmails):[];
  if(match.visibility==='shared' && (!match.sharedEmails.length || match.sharedEmails.length>50 || match.sharedEmails.some(e=>! /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(e))))throw new Error('Ingresá entre 1 y 50 correos válidos para compartir.');
  if(match.editorEmails.some(e=>!match.sharedEmails.includes(e)))throw new Error('Cada editor debe estar incluido en los correos autorizados.');
}
