import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Share, Alert } from 'react-native';
import { useNav } from '../nav';
import { useProfiles } from '../hooks';
import { s, C, Avatar, Segment } from '../ui';
import FollowButton from '../components/FollowButton';
import { friendlyError } from '../errors';
import { watchFollowing, watchFollowers } from '../services/follows';
import { discoverProfiles } from '../services/profiles';
import { startDirectChat } from '../services/chats';

// Friends = people who follow you back. Also: who you follow, your followers, and people to discover.
export default function Friends() {
  const { me, openUser, openChat } = useNav();
  const [seg, setSeg] = useState('friends');
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [discover, setDiscover] = useState([]);

  useEffect(() => watchFollowing(me.uid, 200, setFollowing), [me.uid]);
  useEffect(() => watchFollowers(me.uid, 200, setFollowers), [me.uid]);

  // "Discover": the most followed people, then the newest members (so it is never empty)
  useEffect(() => {
    discoverProfiles().then(setDiscover).catch((e) => console.warn('discover', e.message));
  }, []);

  const friends = following.filter((u) => followers.includes(u));
  const uids = seg === 'friends' ? friends : seg === 'following' ? following : seg === 'followers' ? followers : [];
  const profiles = useProfiles(uids);
  const rows = seg === 'discover'
    ? discover.filter((p) => p.uid !== me.uid && !following.includes(p.uid))
    : uids.map((u) => ({ uid: u, ...(profiles[u] || {}) }));

  const message = async (p) => {
    try { openChat(await startDirectChat(me, p.uid, p.username || 'user')); } catch (e) { Alert.alert('Could not open chat', friendlyError(e)); }
  };
  const invite = () => Share.share({ message: `Join me on Bubbly! My username is @${me.username}. Invite code: ${me.uid.slice(0, 6).toUpperCase()}` });

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
      <Segment
        options={[
          { id: 'friends', label: `Friends ${friends.length}` }, { id: 'following', label: 'Following' },
          { id: 'followers', label: 'Followers' }, { id: 'discover', label: 'Discover' },
        ]}
        value={seg} onChange={setSeg}
      />
      <FlatList
        data={rows} keyExtractor={(p) => p.uid}
        ListEmptyComponent={<Text style={s.mist}>
          {seg === 'friends' ? 'Friends are people you follow who follow you back. Find people with the search bar or Discover.'
            : seg === 'discover' ? 'No suggestions yet.' : 'Nobody here yet.'}
        </Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => openUser(item.uid)}>
            <Avatar name={item.username} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={s.user}>@{item.username || '…'}</Text>
              <Text style={{ color: C.mist, fontSize: 12 }}>{item.followerCount || 0} followers</Text>
            </View>
            <TouchableOpacity style={[s.chip, { backgroundColor: C.line }]} onPress={() => message(item)}><Text style={s.pillTx}>Message</Text></TouchableOpacity>
            <FollowButton uid={item.uid} />
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={s.btn} onPress={invite}><Text style={s.btnTx}>Invite friends to Bubbly</Text></TouchableOpacity>
    </View>
  );
}
