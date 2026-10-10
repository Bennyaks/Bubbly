import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File, UploadType } from 'expo-file-system';
import { collection, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, STORAGE_BASE, STORAGE_BUCKET } from '../../firebase';
import { s, C } from '../ui';

// Streams the video file from the phone straight to Firebase Storage over HTTP.
// No JavaScript Blob is built, which avoids the 14-byte upload problem seen on this Expo version.
async function uploadVideo(uri, path, expectedBytes) {
  const f = new File(uri);
  const info = typeof f.info === 'function' ? f.info() : {};
  const local = info.size || f.size || expectedBytes || 0;
  console.log('upload: file bytes', local, 'picker says', expectedBytes);
  if (!local || local < 1024) throw new Error(`The phone could not read the video file (found ${local} bytes). Try a different video.`);
  const token = await auth.currentUser.getIdToken();
  const res = await f.upload(`${STORAGE_BASE}/v0/b/${STORAGE_BUCKET}/o?name=${encodeURIComponent(path)}`, {
    httpMethod: 'POST',
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: 'video/mp4',
    headers: { Authorization: `Firebase ${token}`, 'Content-Type': 'video/mp4' },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status}): ${String(res.body).slice(0, 120)}`);
  let stored = 0;
  try { stored = Number(JSON.parse(res.body).size); } catch (e) { /* ignore */ }
  console.log('upload: server stored', stored);
  if (stored && Math.abs(stored - local) > 1024) throw new Error(`Only ${stored} of ${local} bytes were stored. The upload was cut short.`);
  return local;
}

export default function Upload({ user, username, onClose }) {
  const [asset, setAsset] = useState(null); const [cap, setCap] = useState(''); const [busy, setBusy] = useState(false);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (r.canceled) return;
    const a = r.assets[0];
    if (a.fileSize && a.fileSize > 100 * 1024 * 1024) return Alert.alert('Video too large', 'Please choose a video under 100 MB.');
    if (a.duration && a.duration > 600000) return Alert.alert('Video too long', 'Please choose a video under 10 minutes.');
    setAsset(a);
  };
  const post = async () => {
    if (!asset) return Alert.alert('Choose a video first');
    setBusy(true);
    const id = doc(collection(db, 'posts')).id;
    try {
      await setDoc(doc(db, 'posts', id), {
        uid: user.uid, author: username, caption: cap.trim() || 'New video', status: 'processing',
        likeCount: 0, commentCount: 0, shareCount: 0, viewCount: 0, completeCount: 0, score: 0,
        createdAt: serverTimestamp(),
      });
      const sent = await uploadVideo(asset.uri, `videos/${user.uid}/${id}.mp4`, asset.fileSize);
      onClose();
      Alert.alert('Uploaded', `Sent ${(sent / 1048576).toFixed(1)} MB. Your video is being processed and you will get a message when it is live.`);
    } catch (e) {
      deleteDoc(doc(db, 'posts', id)).catch(() => {});
      Alert.alert('Upload failed', e.message);
    }
    setBusy(false);
  };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetWrap}><View style={s.sheet}>
        <Text style={s.h1}>Upload a video</Text>
        <TouchableOpacity style={[s.btn, { backgroundColor: C.line }]} onPress={pick}><Text style={s.btnTx}>{asset ? 'Video selected ✓' : 'Choose video'}</Text></TouchableOpacity>
        <TextInput style={[s.input, { marginTop: 10 }]} placeholder="Write a caption" placeholderTextColor={C.mist} value={cap} onChangeText={setCap} maxLength={120} />
        <TouchableOpacity style={s.btn} onPress={post} disabled={busy}>{busy ? <Text style={s.btnTx}>Uploading…</Text> : <Text style={s.btnTx}>Post to Bubbly</Text>}</TouchableOpacity>
        <TouchableOpacity onPress={onClose}><Text style={s.link}>Cancel</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}
