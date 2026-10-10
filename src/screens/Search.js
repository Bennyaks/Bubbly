import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { collection, doc, getDocs, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useNav } from '../nav';
import { s, C, Avatar, Overlay } from '../ui';
import FollowButton from '../components/FollowButton';
import VideoGrid from '../components/VideoGrid';

// Search people by username, or videos by #hashtag. Shows trending hashtags until you type.
export default function Search() {
  const { pop, openUser, openViewer } = useNav();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [trending, setTrending] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'meta', 'trending'), (d) => setTrending((d.data() || {}).tags || []), () => {}), []);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setUsers([]); setVideos([]); return undefined; }
    let alive = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        if (text.startsWith('#')) {
          const tag = text.slice(1).toLowerCase();
          const sn = await getDocs(query(collection(db, 'posts'), where('hashtags', 'array-contains', tag), where('status', '==', 'ready'), orderBy('score', 'desc'), limit(30)));
          if (alive) { setVideos(sn.docs.map((d) => ({ id: d.id, ...d.data() }))); setUsers([]); }
        } else {
          const r = await httpsCallable(functions, 'searchUsers')({ q: text });
          if (alive) { setUsers(r.data.users || []); setVideos([]); }
        }
      } catch (e) { console.warn('search', e.message); }
      if (alive) setBusy(false);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const isTag = q.trim().startsWith('#');
  return (
    <Overlay title="Search" onBack={pop}>
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <TextInput
          style={s.input} placeholder="Search people, or #hashtags" placeholderTextColor={C.mist}
          autoFocus autoCapitalize="none" autoCorrect={false} value={q} onChangeText={setQ}
        />
        {!q.trim() ? (
          <View>
            <Text style={s.h2}>Trending now</Text>
            {trending.length ? (
              <View style={s.chipRow}>
                {trending.slice(0, 12).map((t) => (
                  <TouchableOpacity key={t.tag} style={s.chipSm} onPress={() => setQ(`#${t.tag}`)}><Text style={s.pillTx}>#{t.tag}</Text></TouchableOpacity>
                ))}
              </View>
            ) : <Text style={s.mist}>Trending hashtags appear here once people post with #tags.</Text>}
          </View>
        ) : isTag ? (
          <VideoGrid posts={videos} onOpen={(i) => openViewer(videos, i)} empty={busy ? 'Searching…' : `No videos with ${q.trim()} yet.`} />
        ) : (
          <FlatList
            data={users} keyExtractor={(u) => u.uid} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.mist}>{busy ? 'Searching…' : 'No people found. Try the start of their username.'}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.row} onPress={() => openUser(item.uid)}>
                <Avatar name={item.username} size={44} />
                <Text style={[s.user, { flex: 1 }]}>@{item.username}</Text>
                <FollowButton uid={item.uid} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Overlay>
  );
}
