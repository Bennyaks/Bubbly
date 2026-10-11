import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNav } from '../nav';
import { s, C, HEADER_H } from '../ui';
import { VideoList } from '../components/VideoPost';
import { watchForYou, watchFollowingFeed } from '../services/posts';
import { watchFollowing } from '../services/follows';

const PAGE = 20;
const MAX = 100; // never load more than this many in one feed (keeps reads, and the bill, predictable)

// Home feed: "For You" (ranked by the server) or "Following" (people you follow, newest first).
export default function Feed({ height }) {
  const { me } = useNav();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('forYou');
  const [posts, setPosts] = useState([]);
  const [follows, setFollows] = useState(null);
  const [count, setCount] = useState(PAGE);
  const [auto, setAuto] = useState(false);

  useEffect(() => watchFollowing(me.uid, 30, setFollows, (e) => console.warn('follows', e.message)), [me.uid]);

  const followKey = follows ? follows.join(',') : null;
  useEffect(() => {
    if (mode === 'forYou') return watchForYou(count, setPosts);
    if (!follows || !follows.length) { setPosts([]); return undefined; }
    return watchFollowingFeed(follows, count, setPosts);
  }, [mode, followKey, count]);

  const pill = (id, label) => (
    <TouchableOpacity style={[s.pill, mode === id && { backgroundColor: C.vio }]} onPress={() => { setMode(id); setCount(PAGE); }}>
      <Text style={s.pillTx}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <VideoList
        key={mode} posts={posts} height={height} auto={auto}
        onEnd={() => setCount((c) => (posts.length >= c ? Math.min(c + PAGE, MAX) : c))}
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
