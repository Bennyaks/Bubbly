import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNav } from '../nav';
import { s, C } from '../ui';

// Follow / Following toggle. Counters and the notification are handled by the backend.
export default function FollowButton({ uid, style }) {
  const { me } = useNav();
  const [following, setFollowing] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'follows', `${me.uid}_${uid}`), (d) => setFollowing(d.exists())), [uid, me.uid]);
  if (uid === me.uid || following === null) return null;
  const toggle = () => {
    const ref = doc(db, 'follows', `${me.uid}_${uid}`);
    return following ? deleteDoc(ref) : setDoc(ref, { follower: me.uid, followee: uid, createdAt: serverTimestamp() });
  };
  return (
    <TouchableOpacity style={[s.chip, following && { backgroundColor: C.line }, style]} onPress={toggle}>
      <Text style={s.pillTx}>{following ? 'Following' : 'Follow'}</Text>
    </TouchableOpacity>
  );
}
