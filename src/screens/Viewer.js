import React, { useState } from 'react';
import { View } from 'react-native';
import { useNav } from '../nav';
import { Overlay } from '../ui';
import { VideoList } from '../components/VideoPost';

// Plays a list of videos full screen, starting at one (opened from a profile, search or the activity feed).
export default function Viewer({ posts, index }) {
  const { pop } = useNav();
  const [h, setH] = useState(0);
  return (
    <Overlay title="" onBack={pop}>
      <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        <VideoList posts={posts} height={h} initialIndex={index} />
      </View>
    </Overlay>
  );
}
