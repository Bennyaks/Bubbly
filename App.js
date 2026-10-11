import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StatusBar, BackHandler,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkBackend } from './firebase';
import { NavContext } from './src/nav';
import { s, C, Logo, Avatar } from './src/ui';
import ClaimUsername from './src/screens/ClaimUsername';
import Feed from './src/screens/Feed';
import Friends from './src/screens/Friends';
import Inbox, { RoomScreen } from './src/screens/Chats';
import Channels from './src/screens/Channels';
import LiveHub, { LiveRoom } from './src/screens/Live';
import Search from './src/screens/Search';
import UserProfile from './src/screens/UserProfile';
import Settings from './src/screens/Settings';
import Viewer from './src/screens/Viewer';
import Upload from './src/screens/Upload';
import OfflineBanner from './src/components/OfflineBanner';
import { friendlyError } from './src/errors';
import { emailProblem } from './src/validation';
import { watchAuth, signIn, signUp, resetPassword } from './src/services/auth';
import { watchProfile } from './src/services/profiles';
import { watchMyPosts, deleteByRef } from './src/services/posts';
import { watchChats } from './src/services/chats';
import { watchUnreadActivity } from './src/services/notifications';

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mode, setMode] = useState('in');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const bad = emailProblem(email);
    if (bad) { Alert.alert('Check your email', bad); setBusy(false); return; }
    try {
      if (mode === 'in') await signIn(email, pass);
      else await signUp(email, pass);
    } catch (e) { Alert.alert('Could not continue', friendlyError(e)); }
    setBusy(false);
  };
  const forgot = async () => {
    const bad = emailProblem(email);
    if (bad) return Alert.alert('Enter your email first', 'Type your email address above, then tap "Forgot password?" again.');
    try {
      await resetPassword(email);
      // the same message whether or not the account exists, so nobody can use this to look people up
      Alert.alert('Check your email', 'If an account exists for that address, we sent a link to reset the password.');
    } catch (e) { Alert.alert('Could not send', friendlyError(e)); }
  };
  return (
    <View style={s.center}>
      <Logo size={88} /><Text style={s.brand}>Bubbly</Text>
      <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.mist} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password (6+ characters)" placeholderTextColor={C.mist} secureTextEntry value={pass} onChangeText={setPass} />
      <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTx}>{mode === 'in' ? 'Log in' : 'Create account'}</Text>}
      </TouchableOpacity>
      {mode === 'in' ? <TouchableOpacity onPress={forgot}><Text style={s.link}>Forgot password?</Text></TouchableOpacity> : null}
      <TouchableOpacity onPress={() => setMode(mode === 'in' ? 'up' : 'in')}>
        <Text style={s.link}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Top bar: logo, search, and your profile at the top right. Floats over the video on Home.
function Header({ username, transparent, onSearch, onProfile }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 6 }, transparent && { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, backgroundColor: 'transparent' }]}>
      <Logo size={34} />
      <TouchableOpacity style={s.searchBar} onPress={onSearch}><Text style={s.searchTx}>🔍  Search people and #hashtags</Text></TouchableOpacity>
      <TouchableOpacity onPress={onProfile}><Avatar name={username} size={36} /></TouchableOpacity>
    </View>
  );
}

function Main({ user }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [h, setH] = useState(0);
  const [up, setUp] = useState(false);
  const [profile, setProfile] = useState(undefined);
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadActs, setUnreadActs] = useState(0);

  useEffect(() => watchProfile(user.uid, setProfile, () => setProfile(null)), [user.uid]);

  // Tell the user when their video finished processing or failed (and clear failed ones).
  useEffect(() => watchMyPosts(user.uid, (type, ref, p) => {
    if (p.status === 'failed') {
      Alert.alert('Video not posted', p.error || 'Processing failed. Please try another video.');
      deleteByRef(ref).catch(() => {});
    } else if (type === 'modified' && p.status === 'ready') {
      Alert.alert('Your video is live 🎉', 'It is now in the feed.');
    }
  }), [user.uid]);

  // Inbox badge = chats with unread messages + unread activity
  useEffect(() => watchChats(user.uid, (chats) => setUnreadChats(chats.filter((c) => ((c.unread || {})[user.uid] || 0) > 0).length)), [user.uid]);
  useEffect(() => watchUnreadActivity(user.uid, setUnreadActs), [user.uid]);

  // Android back button: close the top screen, then return to Home
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) { setStack((st) => st.slice(0, -1)); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, tab]);

  if (profile === undefined) return <View style={s.center}><ActivityIndicator color={C.lil} /></View>;
  if (profile === null) return <ClaimUsername user={user} />;

  const push = (name, params = {}) => setStack((st) => [...st, { name, params }]);
  const nav = {
    me: { uid: user.uid, username: profile.username },
    push,
    pop: () => setStack((st) => st.slice(0, -1)),
    goTab: setTab,
    openUser: (uid) => push('user', { uid }),
    openChat: (chatId) => push('room', { chatId }),
    openSearch: () => push('search'),
    openViewer: (posts, index) => push('viewer', { posts, index }),
  };

  const top = stack[stack.length - 1];
  const overlay = !top ? null
    : top.name === 'search' ? <Search key={stack.length} />
    : top.name === 'user' ? <UserProfile key={stack.length} uid={top.params.uid} />
    : top.name === 'room' ? <RoomScreen key={stack.length} chatId={top.params.chatId} />
    : top.name === 'live' ? <LiveRoom key={stack.length} liveId={top.params.liveId} host={!!top.params.host} />
    : top.name === 'settings' ? <Settings key={stack.length} />
    : top.name === 'viewer' ? <Viewer key={stack.length} posts={top.params.posts} index={top.params.index} />
    : null;

  const header = (transparent) => (
    <Header username={profile.username} transparent={transparent} onSearch={nav.openSearch} onProfile={() => nav.openUser(user.uid)} />
  );
  const T = (id, icon, label, badge) => (
    <TouchableOpacity style={s.tab} onPress={() => setTab(id)}>
      <View>
        <Text style={{ fontSize: 20, opacity: tab === id ? 1 : 0.6 }}>{icon}</Text>
        {badge ? <View style={[s.badge, { position: 'absolute', top: -4, right: -12 }]}><Text style={s.badgeTx}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </View>
      <Text style={[s.tabTx, tab === id && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <NavContext.Provider value={nav}>
      <View style={{ flex: 1, backgroundColor: C.ink }}>
        <OfflineBanner />
        {tab !== 'home' && header(false)}
        <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
          {tab === 'home' && <Feed height={h} />}
          {tab === 'friends' && <Friends />}
          {tab === 'inbox' && <Inbox activityBadge={unreadActs} channels={<Channels user={user} />} />}
          {tab === 'live' && <LiveHub />}
          {tab === 'home' && header(true)}
        </View>
        <View style={[s.bar, { height: 64 + insets.bottom, paddingBottom: insets.bottom }]}>
          {T('home', '🏠', 'Home')}{T('friends', '👥', 'Friends')}
          <TouchableOpacity style={s.tab} onPress={() => setUp(true)}><View style={s.plus}><Text style={s.fabTx}>+</Text></View></TouchableOpacity>
          {T('inbox', '💬', 'Inbox', unreadChats + unreadActs)}{T('live', '🔴', 'Live')}
        </View>
        {overlay}
        {up ? <Upload user={user} username={profile.username} onClose={() => setUp(false)} /> : null}
      </View>
    </NavContext.Provider>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => watchAuth(setUser), []);
  useEffect(() => {
    checkBackend().then((r) => {
      if (!r.ok) {
        Alert.alert('Cannot reach the backend',
          `The app tried ${r.host} and got no answer.\n\n1. Is the emulator running (npm run emulators)?\n2. Is the phone on the same Wi-Fi as the laptop?\n3. Does the firewall allow Java and Node?\n\nOpen http://${r.host}:4000 in the phone's browser. If that does not load, it is a network problem. If ${r.host} is not your laptop's address, set EMULATOR_HOST_OVERRIDE in firebase.js.`);
      }
    });
  }, []);
  if (user === undefined) return <View style={s.center}><ActivityIndicator color={C.lil} /></View>;
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.ink }}>
        <StatusBar barStyle="light-content" />
        {user ? <Main user={user} /> : <AuthScreen />}
      </View>
    </SafeAreaProvider>
  );
}
