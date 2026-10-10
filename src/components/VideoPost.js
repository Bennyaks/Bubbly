import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc, limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, videoSrc } from '../../firebase';
import { useNav } from '../nav';
import { s, C, Avatar, timeAgo } from '../ui';
import FollowButton from './FollowButton';

export function ActiveVideo({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

// ---------- Comments ----------
export function Comments({ post, onClose }) {
  const { me, openUser } = useNav();
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => onSnapshot(
    query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'desc'), limit(100)),
    (sn) => setList(sn.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ), [post.id]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await addDoc(collection(db, 'posts', post.id, 'comments'), { text: t, uid: me.uid, author: me.username, createdAt: serverTimestamp() });
  };
  const remove = (c) => deleteDoc(doc(db, 'posts', post.id, 'comments', c.id)).catch(() => {});
  const goUser = (uid) => { onClose(); openUser(uid); };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.sheetWrap}>
        <View style={[s.sheet, { maxHeight: '75%' }]}>
          <Text style={s.h1}>{list.length} comment{list.length === 1 ? '' : 's'}</Text>
          <FlatList
            data={list} keyExtractor={(c) => c.id} style={{ flexGrow: 0, maxHeight: 320 }}
            ListEmptyComponent={<Text style={s.mist}>No comments yet. Start the conversation.</Text>}
            renderItem={({ item }) => (
              <View style={[s.row, { backgroundColor: 'transparent', paddingHorizontal: 0 }]}>
                <TouchableOpacity onPress={() => goUser(item.uid)}><Avatar name={item.author} size={34} /></TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.mist, fontSize: 12 }}>
                    <Text style={{ fontWeight: '900' }} onPress={() => goUser(item.uid)}>@{item.author}</Text>  {timeAgo(item.createdAt)}
                  </Text>
                  <Text style={s.cap}>{item.text}</Text>
                </View>
                {item.uid === me.uid || post.uid === me.uid ? (
                  <TouchableOpacity onPress={() => remove(item)}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
                ) : null}
              </View>
            )}
          />
          <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Add a comment" placeholderTextColor={C.mist} value={text} onChangeText={setText} maxLength={140} />
          <TouchableOpacity style={s.btn} onPress={send}><Text style={s.btnTx}>Send</Text></TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={s.link}>Close</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- One full-screen video ----------
export function Post({ item, height, active, onComments }) {
  const { me, openUser } = useNav();
  const [liked, setLiked] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'posts', item.id, 'likes', me.uid), (d) => setLiked(d.exists())), [item.id, me.uid]);
  const like = () => {
    const ref = doc(db, 'posts', item.id, 'likes', me.uid);
    return liked ? deleteDoc(ref) : setDoc(ref, { createdAt: serverTimestamp() });
  };
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => httpsCallable(functions, 'recordView')({ postId: item.id }).catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, [active, item.id]);
  const share = async () => {
    try {
      const r = await Share.share({ message: `Watch "${item.caption}" by ${item.author} on Bubbly` });
      if (r.action === Share.sharedAction) httpsCallable(functions, 'recordShare')({ postId: item.id }).catch(() => {});
    } catch (e) { /* user cancelled */ }
  };
  return (
    <View style={{ height, backgroundColor: C.plum, justifyContent: 'flex-end' }}>
      {active ? <ActiveVideo uri={videoSrc(item)} /> : null}
      <View style={s.meta}>
        <TouchableOpacity onPress={() => openUser(item.uid)}><Text style={s.user}>@{item.author}</Text></TouchableOpacity>
        <Text style={s.cap}>{item.caption}</Text>
      </View>
      <View style={s.rail}>
        <TouchableOpacity onPress={() => openUser(item.uid)}><Avatar name={item.author} size={46} /></TouchableOpacity>
        <FollowButton uid={item.uid} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }} />
        <TouchableOpacity style={s.railBtn} onPress={like}><Text style={s.railIc}>{liked ? '💜' : '🤍'}</Text><Text style={s.cnt}>{item.likeCount || 0}</Text></TouchableOpacity>
        <TouchableOpacity style={s.railBtn} onPress={() => onComments(item)}><Text style={s.railIc}>💬</Text><Text style={s.cnt}>{item.commentCount || 0}</Text></TouchableOpacity>
        <TouchableOpacity style={s.railBtn} onPress={share}><Text style={s.railIc}>↗️</Text><Text style={s.cnt}>{item.shareCount || 'Share'}</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ---------- Paged list of videos (used by the feed and by the viewer) ----------
export function VideoList({ posts, height, initialIndex = 0, auto = false, empty }) {
  const [idx, setIdx] = useState(initialIndex);
  const [cm, setCm] = useState(null);
  const list = useRef(null);
  const idxRef = useRef(initialIndex);
  const viewability = useRef({ itemVisiblePercentThreshold: 70 }).current;

  useEffect(() => {
    if (!auto || posts.length < 2) return undefined;
    const t = setInterval(() => list.current?.scrollToIndex({ index: (idxRef.current + 1) % posts.length, animated: true }), 6000);
    return () => clearInterval(t);
  }, [auto, posts.length]);

  const onViewable = useCallback(({ viewableItems }) => {
    if (viewableItems.length) { idxRef.current = viewableItems[0].index; setIdx(viewableItems[0].index); }
  }, []);

  if (!height) return null;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list} data={posts} keyExtractor={(p) => p.id} pagingEnabled showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex < posts.length ? initialIndex : 0}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        onViewableItemsChanged={onViewable} viewabilityConfig={viewability}
        renderItem={({ item, index }) => <Post item={item} height={height} active={index === idx} onComments={setCm} />}
        ListEmptyComponent={<View style={[s.center, { height }]}><Text style={s.cap}>{empty || 'No videos yet.'}</Text></View>}
      />
      {cm ? <Comments post={cm} onClose={() => setCm(null)} /> : null}
    </View>
  );
}
