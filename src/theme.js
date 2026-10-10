import { StyleSheet } from 'react-native';

export const C = {
  ink: '#120a22', plum: '#1f1238', line: '#34214f',
  vio: '#8b3dff', lil: '#d36bff', mist: '#cdbfe8',
};

export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.ink, padding: 16 },
  center: { flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', padding: 24 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  mist: { color: C.mist, marginBottom: 8 },
  input: { width: '100%', backgroundColor: C.plum, color: '#fff', padding: 14, borderRadius: 12, marginBottom: 10 },
  btn: { width: '100%', backgroundColor: C.vio, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnAlt: { backgroundColor: C.line },
  btnTx: { color: '#fff', fontWeight: '900', fontSize: 16 },
  link: { color: C.lil, marginTop: 14, fontWeight: '700', textAlign: 'center' },
  row: { backgroundColor: C.plum, borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.vio, alignItems: 'center', justifyContent: 'center' },
  avatarTx: { color: '#fff', fontWeight: '900', fontSize: 18 },
  name: { color: '#fff', fontWeight: '900', fontSize: 16 },
  sub: { color: C.mist, fontSize: 14 },
  dot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.lil, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', backgroundColor: C.plum, borderRadius: 12, padding: 4, marginBottom: 12 },
  segBtn: { flex: 1, padding: 9, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: C.vio },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: C.vio, borderRadius: 16, borderBottomRightRadius: 4, padding: 10, marginBottom: 6, maxWidth: '80%' },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: C.plum, borderRadius: 16, borderBottomLeftRadius: 4, padding: 10, marginBottom: 6, maxWidth: '80%' },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(7,3,15,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.plum, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
});
