import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, useWindowDimensions } from 'react-native';
import { thumbSrc } from '../../firebase';
import { s, C } from '../ui';

// 3-column grid of video thumbnails. Tapping one calls onOpen(index).
export default function VideoGrid({ posts, onOpen, header, empty, onEnd }) {
  const { width } = useWindowDimensions();
  const size = (width - 8 * 2 - 4 * 2) / 3;
  return (
    <FlatList
      data={posts} numColumns={3} keyExtractor={(p) => p.id}
      ListHeaderComponent={header} onEndReached={onEnd} onEndReachedThreshold={1.5}
      ListEmptyComponent={<Text style={[s.mist, { textAlign: 'center', marginTop: 20 }]}>{empty || 'No videos yet.'}</Text>}
      contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
      renderItem={({ item, index }) => (
        <TouchableOpacity onPress={() => onOpen(index)} style={{ width: size, height: size * 1.35, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: C.plum }}>
          {thumbSrc(item) ? <Image source={{ uri: thumbSrc(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
          <Text style={{ position: 'absolute', left: 6, bottom: 4, color: '#fff', fontWeight: '900', fontSize: 12 }}>♥ {item.likeCount || 0}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
