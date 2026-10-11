import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, Alert } from 'react-native';
import { useNav } from '../nav';
import { s, C } from '../ui';
import { watchIsFollowing, follow, unfollow } from '../services/follows';
import { friendlyError } from '../errors';

// Follow / Following toggle. Counters and the notification are handled by the backend.
export default function FollowButton({ uid, style }) {
  const { me } = useNav();
  const [following, setFollowing] = useState(null);
  useEffect(() => watchIsFollowing(me.uid, uid, setFollowing), [uid, me.uid]);
  if (uid === me.uid || following === null) return null;
  const toggle = () => (following ? unfollow(me.uid, uid) : follow(me.uid, uid)).catch((e) => Alert.alert('Could not update', friendlyError(e)));
  return (
    <TouchableOpacity style={[s.chip, following && { backgroundColor: C.line }, style]} onPress={toggle}>
      <Text style={s.pillTx}>{following ? 'Following' : 'Follow'}</Text>
    </TouchableOpacity>
  );
}
