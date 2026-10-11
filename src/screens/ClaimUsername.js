import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ui } from '../theme';
import { friendlyError } from '../errors';
import { usernameProblem } from '../validation';
import { claimUsername } from '../services/profiles';

export default function ClaimUsername({ user }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    const problem = usernameProblem(name);
    if (problem) return Alert.alert('Invalid username', problem);
    setBusy(true);
    try { await claimUsername(user.uid, name); } catch (e) { Alert.alert('Could not claim username', friendlyError(e)); }
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
