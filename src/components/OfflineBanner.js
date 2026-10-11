import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// A slim red bar when the phone has no network. Chats and likes are queued and sent when it comes back.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((st) => setOffline(st.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={{ backgroundColor: '#b3261e', paddingVertical: 6, paddingHorizontal: 12, zIndex: 30 }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>You're offline. Changes will sync when you're back online.</Text>
    </View>
  );
}
