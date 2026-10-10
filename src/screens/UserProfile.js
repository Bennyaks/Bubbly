import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { collection, doc, onSnapshot, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useNav } from '../nav';
import { s, C, Avatar, Overlay } from '../ui';
import FollowButton from '../components/FollowButton';
import VideoGrid from '../components/VideoGrid';
import { startDirectChat } from './Chats';

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));

// Anyone's profile, including your own (with Edit profile and Settings).
export default function UserProfile({ uid }) {
  const { me, pop, push, openViewer, openChat } = useNav();
  const mine = uid === me.uid;
  const [profile, setProfile] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => onSnapshot(doc(db, 'profiles', uid), (d) => setProfile(d.exists() ? d.data() : null)), [uid]);
  useEffect(() => onSnapshot(
    query(collection(db, 'posts'), where('uid', '==', uid), where('status', '==', 'ready'), orderBy('createdAt', 'desc'), limit(60)),
    (sn) => setPosts(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.warn('profile videos', e.message),
  ), [uid]);

  if (profile === undefined) return <Overlay title="Profile" onBack={pop}><Text style={[s.mist, { padding: 16 }]}>Loading…</Text></Overlay>;
  if (profile === null) return <Overlay title="Profile" onBack={pop}><Text style={[s.mist, { padding: 16 }]}>This person no longer exists.</Text></Overlay>;

  const likes = posts.reduce((n, p) => n + (p.likeCount || 0), 0);
  const startEdit = () => { setName(profile.displayName || ''); setBio(profile.bio || ''); setEditing(true); };
  const saveEdit = async () => {
    try { await updateDoc(doc(db, 'profiles', me.uid), { displayName: name.trim(), bio: bio.trim() }); setEditing(false); }
    catch (e) { Alert.alert('Could not save', e.message); }
  };
  const message = async () => {
    try { openChat(await startDirectChat(me, uid, profile.username)); } catch (e) { Alert.alert('Could not open chat', e.message); }
  };
  const report = () => Alert.alert('Report this person?', 'Our team reviews reports. Videos with several reports are hidden automatically.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Report', style: 'destructive', onPress: () => httpsCallable(functions, 'reportContent')({ type: 'user', id: uid, reason: 'reported from profile' })
      .then(() => Alert.alert('Thanks', 'We received your report.')).catch((e) => Alert.alert('Could not report', e.message)) },
  ]);

  const stat = (n, label) => (
    <View style={{ alignItems: 'center', flex: 1 }}><Text style={s.user}>{fmt(n)}</Text><Text style={{ color: C.mist, fontSize: 12 }}>{label}</Text></View>
  );
  const header = (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <Avatar name={profile.username} size={84} />
      <Text style={[s.h1, { marginTop: 10, marginBottom: 0 }]}>{profile.displayName || `@${profile.username}`}</Text>
      {profile.displayName ? <Text style={s.mist}>@{profile.username}</Text> : null}
      {profile.bio ? <Text style={[s.cap, { textAlign: 'center', paddingHorizontal: 24, marginTop: 6 }]}>{profile.bio}</Text> : null}
      <View style={{ flexDirection: 'row', width: '100%', marginVertical: 14 }}>
        {stat(posts.length, 'Videos')}{stat(profile.followerCount, 'Followers')}{stat(profile.followingCount, 'Following')}{stat(likes, 'Likes')}
      </View>
      {mine ? (
        editing ? (
          <View style={{ width: '100%', paddingHorizontal: 16 }}>
            <TextInput style={s.input} placeholder="Display name" placeholderTextColor={C.mist} value={name} onChangeText={setName} maxLength={40} />
            <TextInput style={[s.input, { height: 80 }]} multiline placeholder="Bio" placeholderTextColor={C.mist} value={bio} onChangeText={setBio} maxLength={150} />
            <TouchableOpacity style={s.btn} onPress={saveEdit}><Text style={s.btnTx}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)}><Text style={s.link}>Cancel</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={s.chip} onPress={startEdit}><Text style={s.pillTx}>Edit profile</Text></TouchableOpacity>
            <TouchableOpacity style={[s.chip, { backgroundColor: C.line }]} onPress={() => push('settings', {})}><Text style={s.pillTx}>Settings</Text></TouchableOpacity>
          </View>
        )
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <FollowButton uid={uid} />
          <TouchableOpacity style={[s.chip, { backgroundColor: C.line }]} onPress={message}><Text style={s.pillTx}>Message</Text></TouchableOpacity>
          <TouchableOpacity style={[s.chip, { backgroundColor: C.line }]} onPress={report}><Text style={s.pillTx}>Report</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <Overlay title={`@${profile.username}`} onBack={pop}>
      <VideoGrid posts={posts} header={header} onOpen={(i) => openViewer(posts, i)} empty={mine ? 'You have not posted yet. Tap + to upload your first video.' : 'No videos yet.'} />
    </Overlay>
  );
}
