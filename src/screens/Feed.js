import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../firebase';
import { useNav } from '../nav';
import { s, C, HEADER_H } from '../ui';
import { VideoList } from '../components/VideoPost';

// Home feed: "For You" (ranked by the server) or "Following" (people you follow, newest first).
export default function Feed({ height }) {
  const { me } = useNav();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('forYou');
  const [posts, setPosts] = useState([]);
  const [follows, setFollows] = useState(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => onSnapshot(
    query(collection(db, 'follows'), where('follower', '==', me.uid), limit(30)),
    (sn) => setFollows(sn.docs.map((d) => d.data().followee)),
    (e) => console.warn('follows', e.message),
  ), [me.uid]);

  const followKey = follows ? follows.join(',') : null;
  useEffect(() => {
    if (mode === 'forYou') {
      return onSnapshot(
        query(collection(db, 'posts'), where('status', '==', 'ready'), orderBy('score', 'desc'), limit(50)),
        (sn) => setPosts(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => console.warn('feed', e.message),
      );
    }
    if (!follows || !follows.length) { setPosts([]); return undefined; }
    return onSnapshot(
      query(collection(db, 'posts'), where('uid', 'in', follows), where('status', '==', 'ready'), orderBy('createdAt', 'desc'), limit(50)),
      (sn) => setPosts(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.warn('following feed', e.message),
    );
  }, [mode, followKey]);

  const pill = (id, label) => (
    <TouchableOpacity style={[s.pill, mode === id && { backgroundColor: C.vio }]} onPress={() => setMode(id)}>
      <Text style={s.pillTx}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <VideoList
        key={mode} posts={posts} height={height} auto={auto}
        empty={mode === 'following' ? 'Follow people to see their videos here.' : 'No videos yet. Tap + to post the first one.'}
      />
      <View style={{ position: 'absolute', left: 12, right: 12, top: insets.top + HEADER_H + 14, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {pill('forYou', 'For You')}{pill('following', 'Following')}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.pill, auto && { backgroundColor: C.vio }]} onPress={() => setAuto(!auto)}>
          <Text style={s.pillTx}>{auto ? 'Auto ▶' : 'Auto ⏸'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
