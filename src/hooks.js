import { useEffect, useState } from 'react';
import { loadProfiles } from './services/profiles';

// Loads public profiles ({username, followerCount, ...}) for a list of uids, caching what it has already fetched.
export function useProfiles(uids) {
  const [map, setMap] = useState({});
  const key = uids.join(',');
  useEffect(() => {
    let alive = true;
    const need = uids.filter((u) => !map[u]).slice(0, 100);
    if (!need.length) return undefined;
    loadProfiles(need)
      .then((got) => { if (alive) setMap((m) => ({ ...m, ...got })); })
      .catch((e) => console.warn('profiles', e.message));
    return () => { alive = false; };
  }, [key]);
  return map;
}
