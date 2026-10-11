import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView } from 'react-native';
import { useNav } from '../nav';
import { s, C, Avatar, Overlay } from '../ui';
import { friendlyError } from '../errors';
import {
  watchLives, watchLive, watchLiveMessages, sendLiveMessage, joinPresence, startLive, heartbeat, endLive as endLiveCall,
} from '../services/lives';

// ---------------- Live tab: who is live + Go live ----------------
export default function LiveHub() {
  const { push } = useNav();
  const [lives, setLives] = useState([]);
  const [title, setTitle] = useState('');
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchLives(setLives), []);

  const start = async () => {
    if (!title.trim()) return Alert.alert('Give your live a title');
    setBusy(true);
    try {
      const r = await startLive(title.trim());
      setTitle(''); setForm(false);
      push('live', { liveId: r.liveId, host: true });
    } catch (e) { Alert.alert('Could not go live', friendlyError(e)); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
      <Text style={s.h1}>Live</Text>
      <Text style={s.mist}>Anyone can go live. No follower minimum.</Text>
      {form ? (
        <View>
          <TextInput style={s.input} placeholder="What is your live about?" placeholderTextColor={C.mist} value={title} onChangeText={setTitle} maxLength={80} />
          <TouchableOpacity style={s.btn} onPress={start} disabled={busy}><Text style={s.btnTx}>{busy ? 'Starting…' : 'Start live now'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setForm(false)}><Text style={s.link}>Cancel</Text></TouchableOpacity>
        </View>
      ) : <TouchableOpacity style={[s.btn, { backgroundColor: '#e5336d' }]} onPress={() => setForm(true)}><Text style={s.btnTx}>🔴 Go live</Text></TouchableOpacity>}
      <Text style={s.h2}>Live now</Text>
      <FlatList
        data={lives} keyExtractor={(l) => l.id}
        ListEmptyComponent={<Text style={s.mist}>Nobody is live right now. Be the first.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => push('live', { liveId: item.id, host: false })}>
            <Avatar name={item.hostName} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={s.user} numberOfLines={1}>@{item.hostName}</Text>
              <Text style={{ color: C.mist }} numberOfLines={1}>{item.title}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={s.tag}>LIVE</Text>
              <Text style={{ color: C.mist, fontSize: 12 }}>{Math.max(0, item.viewerCount || 0)} watching</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ---------------- Inside a live: video area, viewers, live chat ----------------
export function LiveRoom({ liveId, host }) {
  const { me, pop } = useNav();
  const [live, setLive] = useState(undefined);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => watchLive(liveId, setLive), [liveId]);
  useEffect(() => watchLiveMessages(liveId, setMsgs), [liveId]);

  // viewers register their presence so the room can show how many are watching
  useEffect(() => {
    if (host) return undefined;
    return joinPresence(liveId, me.uid);
  }, [liveId, host, me.uid]);

  // the host's app tells the server it is still there; silence for 3 minutes closes the live
  useEffect(() => {
    if (!host) return undefined;
    const t = setInterval(() => heartbeat(liveId), 30000);
    return () => clearInterval(t);
  }, [liveId, host]);

  const ended = live === null || (live && live.status !== 'live');
  const endLive = () => endLiveCall(liveId).catch(() => {}).then(pop);
  const back = () => {
    if (host && !ended) {
      Alert.alert('End your live?', 'Leaving ends the live for everyone.', [
        { text: 'Keep going', style: 'cancel' }, { text: 'End live', style: 'destructive', onPress: endLive },
      ]);
    } else pop();
  };
  const send = async () => {
    const t = text.trim();
    if (!t || ended) return;
    setText('');
    try { await sendLiveMessage(liveId, me, t); }
    catch (e) { setText(t); Alert.alert('Message not sent', friendlyError(e)); }
  };

  const title = live ? `@${live.hostName}` : 'Live';
  return (
    <Overlay title={title} onBack={back} right={host && !ended ? <TouchableOpacity onPress={back}><Text style={{ color: '#ff6b81', fontWeight: '900' }}>End</Text></TouchableOpacity> : null}>
      <KeyboardAvoidingView style={{ flex: 1, paddingHorizontal: 12 }} behavior="padding">
        {/* Video area. Real video needs the LiveKit development build: see docs/LIVE.md */}
        <View style={{ height: 190, borderRadius: 16, backgroundColor: C.plum, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {live ? <Avatar name={live.hostName} size={64} /> : null}
          {live ? (
            <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.tag}>{ended ? 'ENDED' : 'LIVE'}</Text>
              <Text style={s.pillTx}>👁 {Math.max(0, live.viewerCount || 0)}</Text>
            </View>
          ) : null}
          <Text style={{ color: '#fff', fontWeight: '900', marginTop: 10 }} numberOfLines={1}>{live ? live.title : ''}</Text>
          <Text style={{ color: C.mist, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            {ended ? 'This live has ended.' : live && live.video === 'none' ? 'Video is not switched on in this build. Chat and viewers are live.' : ''}
          </Text>
        </View>
        <FlatList
          inverted data={msgs} keyExtractor={(m) => m.id} style={{ flex: 1, marginTop: 8 }}
          ListEmptyComponent={<Text style={[s.mist, { transform: [{ scaleY: -1 }] }]}>Be the first to say something.</Text>}
          renderItem={({ item }) => (
            <Text style={{ color: '#fff', marginBottom: 4 }}><Text style={{ color: C.lil, fontWeight: '900' }}>@{item.fromName} </Text>{item.text}</Text>
          )}
        />
        {ended ? (
          <TouchableOpacity style={s.btn} onPress={pop}><Text style={s.btnTx}>Back</Text></TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: 8 }}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Say something" placeholderTextColor={C.mist} value={text} onChangeText={setText} maxLength={200} onSubmitEditing={send} />
            <TouchableOpacity style={[s.btn, { width: 70, marginTop: 0 }]} onPress={send}><Text style={s.btnTx}>Send</Text></TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Overlay>
  );
}
