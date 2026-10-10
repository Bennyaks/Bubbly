import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase';
import { useNav } from '../nav';
import { s, C, Overlay } from '../ui';

const APPS = ['Instagram', 'YouTube', 'Facebook', 'X', 'WhatsApp'];

function LinkInput({ app, value, onSave }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <View style={s.rowIn}>
      <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder={`${app} username`} placeholderTextColor={C.mist} autoCapitalize="none" value={v} onChangeText={setV} />
      <TouchableOpacity style={s.chip} onPress={() => onSave(app, v)}><Text style={s.pillTx}>Save</Text></TouchableOpacity>
    </View>
  );
}

export default function Settings() {
  const { me, pop } = useNav();
  const [links, setLinks] = useState({});
  useEffect(() => onSnapshot(doc(db, 'users', me.uid), (d) => setLinks((d.data() || {}).links || {})), [me.uid]);
  const save = (app, v) => setDoc(doc(db, 'users', me.uid), { links: { ...links, [app]: v.trim() } }, { merge: true });
  const invite = () => Share.share({ message: `Join me on Bubbly! My username is @${me.username}. Invite code: ${me.uid.slice(0, 6).toUpperCase()}` });
  const deleteAccount = () => Alert.alert(
    'Delete your account?',
    'This permanently deletes your videos, profile and username. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await httpsCallable(functions, 'deleteMyAccount')({}); await signOut(auth); } catch (e) { Alert.alert('Could not delete', e.message); }
      } },
    ],
  );
  return (
    <Overlay title="Settings" onBack={pop}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={s.h2}>Invite friends</Text>
        <TouchableOpacity style={s.btn} onPress={invite}><Text style={s.btnTx}>Invite friends</Text></TouchableOpacity>
        <Text style={s.h2}>Your social accounts</Text>
        <Text style={s.mist}>Add your usernames so friends can find you. Automatic importing needs each platform's approval and comes later.</Text>
        {APPS.map((a) => <LinkInput key={a} app={a} value={links[a] || ''} onSave={save} />)}
        <TouchableOpacity onPress={() => signOut(auth)}><Text style={s.link}>Log out</Text></TouchableOpacity>
        <TouchableOpacity onPress={deleteAccount}><Text style={[s.link, { color: '#ff6b81' }]}>Delete my account</Text></TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Overlay>
  );
}
