import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Loads public profiles ({username, followerCount, ...}) for a list of uids, caching what it has already fetched.
export function useProfiles(uids) {
  const [map, setMap] = useState({});
  const key = uids.join(',');
  useEffect(() => {
    let alive = true;
    const need = uids.filter((u) => !map[u]).slice(0, 100);
    if (!need.length) return undefined;
    Promise.all(need.map((u) => getDoc(doc(db, 'profiles', u)).then((d) => [u, d.exists() ? d.data() : { username: 'user' }])))
      .then((pairs) => { if (alive) setMap((m) => ({ ...m, ...Object.fromEntries(pairs) })); })
      .catch((e) => console.warn('profiles', e.message));
    return () => { alive = false; };
  }, [key]);
  return map;
}
