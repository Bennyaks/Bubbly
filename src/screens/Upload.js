import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { s, C } from '../ui';
import { friendlyError } from '../errors';
import { createPostDraft, deletePostRecord } from '../services/posts';
import { uploadVideo } from '../services/storage';

export default function Upload({ user, username, onClose }) {
  const [asset, setAsset] = useState(null);
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (r.canceled) return;
    const a = r.assets[0];
    if (a.fileSize && a.fileSize > 100 * 1024 * 1024) return Alert.alert('Video too large', 'Please choose a video under 100 MB.');
    if (a.duration && a.duration > 600000) return Alert.alert('Video too long', 'Please choose a video under 10 minutes.');
    setAsset(a);
  };

  // Two steps: create the post record, then send the file. If the file fails, the record is removed again.
  const post = async () => {
    if (!asset) return Alert.alert('Choose a video first');
    setBusy(true);
    let id = null;
    try {
      id = await createPostDraft(user, username, cap);
      const sent = await uploadVideo(asset.uri, id, user.uid, asset.fileSize);
      onClose();
      Alert.alert('Uploaded', `Sent ${(sent / 1048576).toFixed(1)} MB. Your video is being processed and you will get a message when it is live.`);
    } catch (e) {
      if (id) deletePostRecord(id).catch(() => {});
      Alert.alert('Upload failed', friendlyError(e));
    }
    setBusy(false);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetWrap}><View style={s.sheet}>
        <Text style={s.h1}>Upload a video</Text>
        <TouchableOpacity style={[s.btn, { backgroundColor: C.line }]} onPress={pick}><Text style={s.btnTx}>{asset ? 'Video selected ✓' : 'Choose video'}</Text></TouchableOpacity>
        <TextInput style={[s.input, { marginTop: 10 }]} placeholder="Write a caption (use #hashtags)" placeholderTextColor={C.mist} value={cap} onChangeText={setCap} maxLength={120} />
        <TouchableOpacity style={s.btn} onPress={post} disabled={busy}>{busy ? <Text style={s.btnTx}>Uploading…</Text> : <Text style={s.btnTx}>Post to Zeva</Text>}</TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={s.link}>Cancel</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}
