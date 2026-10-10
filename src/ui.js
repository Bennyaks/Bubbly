import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const C = { ink: '#120a22', plum: '#1f1238', line: '#34214f', vio: '#8b3dff', lil: '#d36bff', mist: '#cdbfe8' };
export const HEADER_H = 48;
export const nameOf = (u) => (u.email || 'user').split('@')[0];

// "now", "5m", "3h", "2d", "4w" from a Firestore timestamp
export function timeAgo(ts) {
  const t = ts && ts.toMillis ? ts.toMillis() : Date.now();
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

export function Logo({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs><LinearGradient id="g" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#d36bff" /><Stop offset="1" stopColor="#7a2cf0" /></LinearGradient></Defs>
      <Path d="M32 4C17 4 6 15 6 29c0 8 4 15 10 19l-3 11 12-6c2 .5 4 .8 7 .8 15 0 26-11 26-25S47 4 32 4z" fill="url(#g)" />
      <Path d="M36 17v18.5a6.5 6.5 0 1 1-4-6V21l14-3v-5z" fill="#fff" />
    </Svg>
  );
}

export function Avatar({ name, size = 40 }) {
  const letter = ((name || '?').trim()[0] || '?').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.vio, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
}

// options: [{ id, label, badge? }]
export function Segment({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <TouchableOpacity key={o.id} style={[s.segBtn, value === o.id && s.segOn]} onPress={() => onChange(o.id)}>
          <Text style={s.segTx}>{o.label}</Text>
          {o.badge ? <View style={s.badge}><Text style={s.badgeTx}>{o.badge > 99 ? '99+' : o.badge}</Text></View> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Full-screen page that slides over the tabs, with a back arrow.
export function Overlay({ title, onBack, right, children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.ink, zIndex: 20, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.obar}>
        <TouchableOpacity onPress={onBack} style={s.oback}><Text style={s.obackTx}>←</Text></TouchableOpacity>
        <Text style={s.otitle} numberOfLines={1}>{title}</Text>
        <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', padding: 24 },
  page: { flex: 1, backgroundColor: C.ink, padding: 16, paddingTop: 12 },
  brand: { color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 24 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  h2: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 20, marginBottom: 8 },
  mist: { color: C.mist, marginBottom: 8 },
  input: { width: '100%', backgroundColor: C.plum, color: '#fff', padding: 14, borderRadius: 12, marginBottom: 10 },
  btn: { width: '100%', backgroundColor: C.vio, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnTx: { color: '#fff', fontWeight: '900', fontSize: 16 },
  link: { color: C.lil, marginTop: 14, fontWeight: '700', textAlign: 'center' },
  row: { backgroundColor: C.plum, borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIn: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  chip: { backgroundColor: C.vio, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  meta: { padding: 16, paddingRight: 84, paddingBottom: 28 },
  user: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cap: { color: '#fff', fontSize: 15, marginTop: 2 },
  rail: { position: 'absolute', right: 10, bottom: 36, gap: 18, alignItems: 'center' },
  railBtn: { alignItems: 'center' }, railIc: { fontSize: 30 }, cnt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  top: { position: 'absolute', top: 44, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { backgroundColor: 'rgba(18,10,34,0.7)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  pillTx: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bar: { flexDirection: 'row', height: 64, backgroundColor: C.ink, borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, tabTx: { color: C.mist, fontSize: 11, fontWeight: '700' },
  plus: { width: 48, height: 34, borderRadius: 12, backgroundColor: C.vio, alignItems: 'center', justifyContent: 'center' },
  fabTx: { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(7,3,15,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.plum, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  seg: { flexDirection: 'row', backgroundColor: C.plum, borderRadius: 12, padding: 4, marginBottom: 12 },
  segBtn: { flex: 1, padding: 9, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segOn: { backgroundColor: C.vio },
  segTx: { color: '#fff', fontWeight: '900', fontSize: 14 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.lil, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTx: { color: '#fff', fontSize: 11, fontWeight: '900' },
  obar: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  oback: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  obackTx: { color: '#fff', fontSize: 24 },
  otitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 6, backgroundColor: C.ink },
  searchBar: { flex: 1, height: 38, borderRadius: 19, backgroundColor: 'rgba(31,18,56,0.85)', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: C.line },
  searchTx: { color: C.mist, fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  chipSm: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: C.plum, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.vio, borderColor: C.vio },
  tag: { color: '#fff', fontWeight: '900', fontSize: 11, backgroundColor: '#e5336d', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
});
