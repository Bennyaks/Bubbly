import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { s, C } from '../ui';

function ChannelView({ channel, user, onBack }) {
  const [posts, setPosts] = useState([]); const [text, setText] = useState('');
  const owner = channel.ownerUid === user.uid;
  useEffect(() => onSnapshot(query(collection(db, 'channels', channel.id, 'posts'), orderBy('createdAt', 'asc')),
    (sn) => setPosts(sn.docs.map((d) => ({ id: d.id, ...d.data() })))), [channel.id]);
  const send = async () => {
    const t = text.trim(); if (!t) return; setText('');
    await addDoc(collection(db, 'channels', channel.id, 'posts'), { text: t, createdAt: serverTimestamp() });
  };
  return (
    <View style={s.page}>
      <TouchableOpacity onPress={onBack}><Text style={s.link}>← Channels</Text></TouchableOpacity>
      <Text style={s.h1}>📣 {channel.name}</Text>
      <Text style={s.mist}>{(channel.members || []).length} members</Text>
      <FlatList data={posts} keyExtractor={(p) => p.id} style={{ marginTop: 12 }}
        ListEmptyComponent={<Text style={s.mist}>No posts yet.</Text>}
        renderItem={({ item }) => <View style={s.row}><Text style={s.cap}>{item.text}</Text></View>} />
      {owner ? (<>
        <TextInput style={s.input} placeholder="Post to your channel" placeholderTextColor={C.mist} value={text} onChangeText={setText} />
        <TouchableOpacity style={s.btn} onPress={send}><Text style={s.btnTx}>Post</Text></TouchableOpacity>
      </>) : <Text style={s.mist}>Only the channel owner can post here.</Text>}
    </View>
  );
}

export default function Channels({ user }) {
  const [list, setList] = useState([]); const [open, setOpen] = useState(null); const [name, setName] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'channels'), orderBy('createdAt', 'desc')),
    (sn) => setList(sn.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
  const create = async () => {
    const n = name.trim(); if (!n) return; setName('');
    await addDoc(collection(db, 'channels'), { name: n, ownerUid: user.uid, members: [user.uid], createdAt: serverTimestamp() });
  };
  const toggle = (c) => updateDoc(doc(db, 'channels', c.id), { members: (c.members || []).includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  const current = open && list.find((c) => c.id === open);
  if (current) return <ChannelView channel={current} user={user} onBack={() => setOpen(null)} />;
  return (
    <View style={s.page}>
      <Text style={s.h1}>Channels</Text>
      <FlatList data={list} keyExtractor={(c) => c.id} ListEmptyComponent={<Text style={s.mist}>No channels yet. Create the first one.</Text>}
        renderItem={({ item }) => {
          const joined = (item.members || []).includes(user.uid);
          return (
            <TouchableOpacity style={s.row} onPress={() => setOpen(item.id)}>
              <View style={{ flex: 1 }}><Text style={s.user}>📣 {item.name}</Text><Text style={s.mist}>{(item.members || []).length} members</Text></View>
              <TouchableOpacity style={[s.chip, joined && { backgroundColor: C.line }]} onPress={() => toggle(item)}><Text style={s.pillTx}>{joined ? 'Joined' : 'Join'}</Text></TouchableOpacity>
            </TouchableOpacity>
          );
        }} />
      <TextInput style={s.input} placeholder="New channel name" placeholderTextColor={C.mist} value={name} onChangeText={setName} maxLength={30} />
      <TouchableOpacity style={s.btn} onPress={create}><Text style={s.btnTx}>Create channel</Text></TouchableOpacity>
    </View>
  );
}
