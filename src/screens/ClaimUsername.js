import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { ui } from '../theme';

export default function ClaimUsername({ user }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    const n = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(n)) {
      return Alert.alert('Invalid username', 'Use 3 to 20 letters, numbers or underscores.');
    }
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const uref = doc(db, 'usernames', n);
        if ((await tx.get(uref)).exists()) throw new Error('That username is already taken.');
        tx.set(uref, { uid: user.uid });
        tx.set(doc(db, 'profiles', user.uid), { username: n, createdAt: serverTimestamp() });
      });
    } catch (e) {
      Alert.alert('Could not claim username', e.message);
    }
    setBusy(false);
  };

  return (
    <View style={ui.center}>
      <Text style={ui.h1}>Choose your username</Text>
      <Text style={ui.mist}>Friends will find you by this name. You can't change it later.</Text>
      <TextInput style={ui.input} placeholder="username" placeholderTextColor="#cdbfe8"
        autoCapitalize="none" autoCorrect={false} value={name} onChangeText={setName} maxLength={20} />
      <TouchableOpacity style={ui.btn} onPress={claim} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnTx}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}
