import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

// Calls a Cloud Function and returns its data. Gives up after 20 seconds instead of hanging on a bad connection.
export async function call(name, data = {}) {
  const r = await httpsCallable(functions, name, { timeout: 20000 })(data);
  return r.data;
}
