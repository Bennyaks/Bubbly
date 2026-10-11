import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { useNav } from '../nav';
import { s, C, Overlay } from '../ui';
import { friendlyError } from '../errors';
import { watchLinks, setLinks } from '../services/profiles';
import { signOutUser, currentEmail, emailVerified, resendVerification } from '../services/auth';
import { deleteAccount } from '../services/account';

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
  const [links, setLinkState] = useState({});
  const verified = emailVerified();
  useEffect(() => watchLinks(me.uid, setLinkState), [me.uid]);

  const save = (app, v) => setLinks(me.uid, { ...links, [app]: v.trim() }).catch((e) => Alert.alert('Could not save', friendlyError(e)));
  const invite = () => Share.share({ message: `Join me on Bubbly! My username is @${me.username}. Invite code: ${me.uid.slice(0, 6).toUpperCase()}` });
  const resend = () => resendVerification()
    .then(() => Alert.alert('Sent', 'Check your inbox for the verification link.'))
    .catch((e) => Alert.alert('Could not send', friendlyError(e)));
  const remove = () => Alert.alert(
    'Delete your account?',
    'This permanently deletes your videos, comments, profile and username. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAccount(); await signOutUser(); } catch (e) { Alert.alert('Could not delete', friendlyError(e)); }
      } },
    ],
  );
  return (
    <Overlay title="Settings" onBack={pop}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={s.h2}>Account</Text>
        <Text style={s.mist}>{currentEmail()} {verified ? '(verified)' : '(not verified yet)'}</Text>
        {!verified ? <TouchableOpacity onPress={resend}><Text style={[s.link, { textAlign: 'left', marginTop: 0 }]}>Resend verification email</Text></TouchableOpacity> : null}
        <Text style={s.h2}>Invite friends</Text>
        <TouchableOpacity style={s.btn} onPress={invite}><Text style={s.btnTx}>Invite friends</Text></TouchableOpacity>
        <Text style={s.h2}>Your social accounts</Text>
        <Text style={s.mist}>Add your usernames so friends can find you. Automatic importing needs each platform's approval and comes later.</Text>
        {APPS.map((a) => <LinkInput key={a} app={a} value={links[a] || ''} onSave={save} />)}
        <TouchableOpacity onPress={() => signOutUser()}><Text style={s.link}>Log out</Text></TouchableOpacity>
        <TouchableOpacity onPress={remove}><Text style={[s.link, { color: '#ff6b81' }]}>Delete my account</Text></TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Overlay>
  );
}
