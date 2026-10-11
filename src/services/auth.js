import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail, sendEmailVerification,
} from 'firebase/auth';
import { auth } from '../../firebase';

export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
export const signIn = (email, pass) => signInWithEmailAndPassword(auth, email.trim(), pass);
export async function signUp(email, pass) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  sendEmailVerification(cred.user).catch(() => {}); // best effort; the account works either way
  return cred;
}
export const signOutUser = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());
export const emailVerified = () => !!(auth.currentUser && auth.currentUser.emailVerified);
export const currentEmail = () => (auth.currentUser && auth.currentUser.email) || '';
export const resendVerification = () => sendEmailVerification(auth.currentUser);
export const idToken = () => auth.currentUser.getIdToken();
