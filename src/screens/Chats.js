import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, setDoc, getDoc, getDocs, updateDoc, doc,
  serverTimestamp, limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useNav } from '../nav';
import { s, C, Avatar, Segment, Overlay, timeAgo } from '../ui';

const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now());
const dmId = (a, b) => [a, b].sort().join('_');
const clock = (t) => (t && t.toDate ? t.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

export function chatTitle(c, uid) {
  if (c.type === 'group') return c.title;
  const other = c.members.find((m) => m !== uid);
  return (c.names && c.names[other]) || 'Chat';
}

// Finds or creates the one-to-one chat between me and another person. Returns the chat id.
export async function startDirectChat(me, otherUid, otherName) {
  const id = dmId(me.uid, otherUid);
  const existing = await getDoc(doc(db, 'chats', id));
  if (!existing.exists()) {
    await setDoc(doc(db, 'chats', id), {
      type: 'direct', members: [me.uid, otherUid], names: { [me.uid]: me.username, [otherUid]: otherName }, createdAt: serverTimestamp(),
    });
  }
  return id;
}

// ---------------- Group menu ----------------
function GroupMenu({ chat, onClose, onLeft }) {
  const { me } = useNav();
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = chat.ownerUid === me.uid;
  const add = async () => {
    const list = names.split(',').map((n) => n.trim()).filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    try {
      const r = await httpsCallable(functions, 'addGroupMembers')({ chatId: chat.id, usernames: list });
      setNames('');
      Alert.alert('Added', r.data.added.length ? r.data.added.map((n) => `@${n}`).join(', ') : 'Everyone was already in the group.');
    } catch (e) { Alert.alert('Could not add', e.message); }
    setBusy(false);
  };
  const leave = () => Alert.alert('Leave this group?', 'You will stop receiving its messages.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: async () => {
      try { await httpsCallable(functions, 'leaveGroup')({ chatId: chat.id }); onClose(); onLeft(); } catch (e) { Alert.alert('Could not leave', e.message); }
    } },
  ]);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetWrap}><View style={s.sheet}>
        <Text style={s.h1}>{chat.title}</Text>
        <Text style={s.mist}>{chat.members.length} members: {chat.members.map((m) => `@${chat.names[m] || '?'}`).join(', ')}</Text>
        {owner ? (<>
          <TextInput style={s.input} placeholder="Add usernames, separated by commas" placeholderTextColor={C.mist} autoCapitalize="none" value={names} onChangeText={setNames} />
          <TouchableOpacity style={s.btn} onPress={add} disabled={busy}><Text style={s.btnTx}>{busy ? 'Adding…' : 'Add people'}</Text></TouchableOpacity>
        </>) : null}
        <TouchableOpacity onPress={leave}><Text style={[s.link, { color: '#ff6b81' }]}>Leave group</Text></TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={s.link}>Close</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}

// ---------------- One conversation ----------------
function Room({ chat }) {
  const { me } = useNav();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const list = useRef(null);
  const group = chat.type === 'group';

  useEffect(() => onSnapshot(
    query(collection(db, 'chats', chat.id, 'messages'), orderBy('createdAt', 'asc')),
    (sn) => setMsgs(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ), [chat.id]);

  // mark as read whenever new messages arrive while the room is open
  useEffect(() => {
    updateDoc(doc(db, 'chats', chat.id), { [`lastRead.${me.uid}`]: serverTimestamp(), [`unread.${me.uid}`]: 0 }).catch(() => {});
  }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await addDoc(collection(db, 'chats', chat.id, 'messages'), { text: t, from: me.uid, fromName: me.username, createdAt: serverTimestamp() });
    } catch (e) { Alert.alert('Message not sent', e.message); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingHorizontal: 12 }} behavior="padding">
      <FlatList
        ref={list} data={msgs} keyExtractor={(m) => m.id} style={{ flex: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={s.mist}>No messages yet. Say hi 👋</Text>}
        renderItem={({ item }) => {
          const mine = item.from === me.uid;
          return (
            <View style={{
              alignSelf: mine ? 'flex-end' : 'flex-start', backgroundColor: mine ? C.vio : C.plum, borderRadius: 16,
              borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, padding: 10, marginBottom: 6, maxWidth: '80%',
            }}>
              {group && !mine ? <Text style={{ color: C.lil, fontWeight: '900', fontSize: 12 }}>@{item.fromName}</Text> : null}
              <Text style={{ color: '#fff', fontSize: 15 }}>{item.text}</Text>
              <Text style={{ color: C.mist, fontSize: 10, alignSelf: 'flex-end' }}>{clock(item.createdAt)}</Text>
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: 8 }}>
        <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Message" placeholderTextColor={C.mist} value={text} onChangeText={setText} onSubmitEditing={send} />
        <TouchableOpacity style={[s.btn, { width: 70, marginTop: 0 }]} onPress={send}><Text style={s.btnTx}>Send</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Full-screen chat opened from the inbox, a profile, or the friends list.
export function RoomScreen({ chatId }) {
  const { me, pop, openUser } = useNav();
  const [chat, setChat] = useState(undefined);
  const [menu, setMenu] = useState(false);
  useEffect(() => onSnapshot(
    doc(db, 'chats', chatId),
    (d) => setChat(d.exists() ? { id: d.id, ...d.data() } : null),
    () => setChat(null), // e.g. you just left the group
  ), [chatId]);

  if (chat === undefined) return <Overlay title="Chat" onBack={pop}><ActivityIndicator color={C.lil} style={{ marginTop: 40 }} /></Overlay>;
  if (chat === null) return <Overlay title="Chat" onBack={pop}><Text style={[s.mist, { padding: 16 }]}>This chat is no longer available.</Text></Overlay>;

  const other = chat.type === 'direct' ? chat.members.find((m) => m !== me.uid) : null;
  const right = chat.type === 'group'
    ? <TouchableOpacity onPress={() => setMenu(true)}><Text style={{ color: '#fff', fontSize: 22 }}>⋯</Text></TouchableOpacity>
    : <TouchableOpacity onPress={() => openUser(other)}><Avatar name={chatTitle(chat, me.uid)} size={30} /></TouchableOpacity>;
  return (
    <Overlay title={chatTitle(chat, me.uid)} onBack={pop} right={right}>
      <Room chat={chat} />
      {menu ? <GroupMenu chat={chat} onClose={() => setMenu(false)} onLeft={pop} /> : null}
    </Overlay>
  );
}

// ---------------- New chat ----------------
function NewChat({ onClose, onOpen }) {
  const { me } = useNav();
  const [group, setGroup] = useState(false);
  const [title, setTitle] = useState('');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const list = [...new Set(names.split(',').map((n) => n.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))].filter((n) => n !== me.username);
    if (!list.length) return Alert.alert('Enter at least one username');
    if (group && !title.trim()) return Alert.alert('Give the group a name');
    if (!group && list.length > 1) return Alert.alert('A direct chat has one person. Use a group for more.');
    setBusy(true);
    try {
      const uids = {};
      for (const n of list) {
        const u = await getDoc(doc(db, 'usernames', n));
        if (!u.exists()) throw new Error(`No user called @${n}`);
        uids[u.data().uid] = n;
      }
      if (group) {
        const members = [me.uid, ...Object.keys(uids)];
        const r = await addDoc(collection(db, 'chats'), {
          type: 'group', title: title.trim(), members, names: { [me.uid]: me.username, ...uids }, ownerUid: me.uid, createdAt: serverTimestamp(),
        });
        onOpen(r.id);
      } else {
        const [uid, name] = Object.entries(uids)[0];
        onOpen(await startDirectChat(me, uid, name));
      }
    } catch (e) { Alert.alert('Could not start chat', e.message); }
    setBusy(false);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetWrap}><View style={s.sheet}>
        <Text style={s.h1}>New chat</Text>
        <Segment options={[{ id: 'd', label: 'Direct' }, { id: 'g', label: 'Group' }]} value={group ? 'g' : 'd'} onChange={(v) => setGroup(v === 'g')} />
        {group ? <TextInput style={s.input} placeholder="Group name" placeholderTextColor={C.mist} value={title} onChangeText={setTitle} maxLength={40} /> : null}
        <TextInput style={s.input} placeholder={group ? 'Usernames, separated by commas' : 'Their username'} placeholderTextColor={C.mist}
          autoCapitalize="none" autoCorrect={false} value={names} onChangeText={setNames} />
        <TouchableOpacity style={s.btn} onPress={create} disabled={busy}><Text style={s.btnTx}>{busy ? 'Starting…' : 'Start chat'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={s.link}>Cancel</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}

// ---------------- Chat list: pinned, muted, archived, filters ----------------
function ChatList() {
  const { me, openChat } = useNav();
  const [chats, setChats] = useState([]);
  const [prefs, setPrefs] = useState({});
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState(null);

  useEffect(() => onSnapshot(
    query(collection(db, 'chats'), where('members', 'array-contains', me.uid)),
    (sn) => setChats(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ), [me.uid]);
  useEffect(() => onSnapshot(collection(db, 'users', me.uid, 'chatPrefs'), (sn) => {
    const m = {};
    sn.docs.forEach((d) => { m[d.id] = d.data(); });
    setPrefs(m);
  }), [me.uid]);

  const unreadOf = (c) => (c.unread || {})[me.uid] || 0;
  const p = (c) => prefs[c.id] || {};
  const visible = chats
    .filter((c) => {
      if (filter === 'archived') return p(c).archived;
      if (p(c).archived) return false;
      if (filter === 'direct') return c.type === 'direct';
      if (filter === 'groups') return c.type === 'group';
      if (filter === 'unread') return unreadOf(c) > 0;
      return true;
    })
    .sort((a, b) => (p(b).pinned ? 1 : 0) - (p(a).pinned ? 1 : 0)
      || ms((b.lastMessage || {}).at || b.createdAt) - ms((a.lastMessage || {}).at || a.createdAt));

  const setPref = (c, patch) => setDoc(doc(db, 'users', me.uid, 'chatPrefs', c.id), patch, { merge: true });
  const leaveFromList = (c) => Alert.alert('Leave this group?', c.title, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: () => httpsCallable(functions, 'leaveGroup')({ chatId: c.id }).catch((e) => Alert.alert('Could not leave', e.message)) },
  ]);

  const chip = (id, label) => (
    <TouchableOpacity key={id} style={[s.chipSm, filter === id && s.chipOn]} onPress={() => setFilter(id)}>
      <Text style={s.pillTx}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.chipRow}>{chip('all', 'All')}{chip('direct', 'Direct')}{chip('groups', 'Groups')}{chip('unread', 'Unread')}{chip('archived', 'Archived')}</View>
      <FlatList
        data={visible} keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={s.mist}>{filter === 'all' ? 'No chats yet. Tap New chat and message someone by username.' : 'Nothing here.'}</Text>}
        renderItem={({ item }) => {
          const title = chatTitle(item, me.uid);
          const lm = item.lastMessage;
          const n = unreadOf(item);
          return (
            <TouchableOpacity style={s.row} onPress={() => openChat(item.id)} onLongPress={() => setMenu(item)}>
              <Avatar name={title} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={s.user} numberOfLines={1}>{p(item).pinned ? '📌 ' : ''}{item.type === 'group' ? '👥 ' : ''}{title}{p(item).muted ? ' 🔕' : ''}</Text>
                <Text style={{ color: n ? '#fff' : C.mist, fontWeight: n ? '900' : '400' }} numberOfLines={1}>{lm ? lm.text : 'No messages yet'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: C.mist, fontSize: 12 }}>{lm ? timeAgo(lm.at) : ''}</Text>
                {n ? <View style={s.badge}><Text style={s.badgeTx}>{n > 99 ? '99+' : n}</Text></View> : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <Text style={{ color: C.mist, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Tip: press and hold a chat to pin, mute or archive it</Text>
      <TouchableOpacity style={s.btn} onPress={() => setCreating(true)}><Text style={s.btnTx}>New chat</Text></TouchableOpacity>
      {creating ? <NewChat onClose={() => setCreating(false)} onOpen={(id) => { setCreating(false); openChat(id); }} /> : null}
      {menu ? (
        <Modal transparent animationType="fade" onRequestClose={() => setMenu(null)}>
          <TouchableOpacity activeOpacity={1} style={s.sheetWrap} onPress={() => setMenu(null)}>
            <View style={s.sheet}>
              <Text style={s.h1} numberOfLines={1}>{chatTitle(menu, me.uid)}</Text>
              <TouchableOpacity style={s.row} onPress={() => { setPref(menu, { pinned: !p(menu).pinned }); setMenu(null); }}><Text style={s.cap}>{p(menu).pinned ? '📌 Unpin' : '📌 Pin to top'}</Text></TouchableOpacity>
              <TouchableOpacity style={s.row} onPress={() => { setPref(menu, { muted: !p(menu).muted }); setMenu(null); }}><Text style={s.cap}>{p(menu).muted ? '🔔 Unmute' : '🔕 Mute notifications'}</Text></TouchableOpacity>
              <TouchableOpacity style={s.row} onPress={() => { setPref(menu, { archived: !p(menu).archived }); setMenu(null); }}><Text style={s.cap}>{p(menu).archived ? '📥 Unarchive' : '🗄 Archive'}</Text></TouchableOpacity>
              {menu.type === 'group' ? <TouchableOpacity style={s.row} onPress={() => { const c = menu; setMenu(null); leaveFromList(c); }}><Text style={[s.cap, { color: '#ff6b81' }]}>Leave group</Text></TouchableOpacity> : null}
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );
}

// ---------------- Activity: likes, comments, follows, lives ----------------
const ICON = { like: '💜', comment: '💬', follow: '👤', live: '🔴' };

function Activity() {
  const { me, openUser, openViewer, push } = useNav();
  const [items, setItems] = useState([]);
  useEffect(() => onSnapshot(
    query(collection(db, 'notifications', me.uid, 'items'), orderBy('createdAt', 'desc'), limit(50)),
    (sn) => setItems(sn.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))),
    (e) => console.warn('activity', e.message),
  ), [me.uid]);

  // opening the Activity tab marks everything as read
  useEffect(() => {
    items.filter((i) => !i.read).forEach((i) => updateDoc(i.ref, { read: true }).catch(() => {}));
  }, [items.length]);

  const open = async (i) => {
    if (i.type === 'follow') return openUser(i.fromUid);
    if (i.type === 'live') return push('live', { liveId: i.liveId, host: false });
    const d = await getDoc(doc(db, 'posts', i.postId));
    if (d.exists()) openViewer([{ id: d.id, ...d.data() }], 0);
    else Alert.alert('Video not found', 'This video was removed.');
  };

  return (
    <FlatList
      data={items} keyExtractor={(i) => i.id}
      ListEmptyComponent={<Text style={s.mist}>Nothing yet. Likes, comments, new followers and lives will show up here.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={[s.row, !item.read && { borderWidth: 1, borderColor: C.vio }]} onPress={() => open(item)}>
          <Text style={{ fontSize: 24 }}>{ICON[item.type] || '🔔'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cap}><Text style={{ fontWeight: '900' }}>@{item.fromName}</Text> {item.text}</Text>
            <Text style={{ color: C.mist, fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

// ---------------- Inbox tab: Chats | Activity | Channels ----------------
export default function Inbox({ channels, activityBadge }) {
  const [seg, setSeg] = useState('chats');
  return (
    <View style={{ flex: 1, paddingTop: 8 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <Segment
          options={[{ id: 'chats', label: 'Chats' }, { id: 'activity', label: 'Activity', badge: activityBadge }, { id: 'channels', label: 'Channels' }]}
          value={seg} onChange={setSeg}
        />
      </View>
      <View style={{ flex: 1, paddingHorizontal: seg === 'channels' ? 0 : 16 }}>
        {seg === 'chats' ? <ChatList /> : seg === 'activity' ? <Activity /> : channels}
      </View>
    </View>
  );
}
