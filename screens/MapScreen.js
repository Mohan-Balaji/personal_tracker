import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { useAppTheme } from '../utils/theme-context';

export default function MapScreen({ route }) {
  const mapRef = useRef(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [isLocationSharing, setIsLocationSharing] = useState(true);
  const [hasCentered, setHasCentered] = useState(false);
  const { themeMode } = useAppTheme();
  const { width } = useWindowDimensions();
  
  const isAdmin = route?.params?.isAdmin || false;
  const isDark = themeMode === 'dark';
  const isTablet = width >= 768;

  const normalizeCoordinate = (value) => {
    if (!value) return null;
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  };

  useEffect(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    const ADMIN_DOC = `mohan_${todayDate}`;

    const unsub = onSnapshot(doc(db, "users", ADMIN_DOC), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const incomingLocation = isAdmin ? data.adminLiveLocation : data.liveLocation;
        const normalizedLocation = normalizeCoordinate(incomingLocation);
        if (normalizedLocation) setLiveLocation(normalizedLocation);
        if (data.locationSharing !== undefined) setIsLocationSharing(data.locationSharing);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Snap camera to live location safely ONLY on first load (to avoid disrupting user panning later)
    if (isValidCoordinate(liveLocation) && mapRef.current && !hasCentered) {
      mapRef.current.animateToRegion({
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
      setHasCentered(true);
    }
  }, [liveLocation, hasCentered]);

  const isValidCoordinate = (value) => {
    if (!value) return false;
    const { latitude, longitude } = value;
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  };

  const MAP_REGION = isValidCoordinate(liveLocation) ? {
    latitude: liveLocation.latitude,
    longitude: liveLocation.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  } : {
    latitude: 12.9716, // Bangalore Default
    longitude: 77.5946,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  const MARKER_COORDINATE = isValidCoordinate(liveLocation)
    ? { latitude: liveLocation.latitude, longitude: liveLocation.longitude }
    : { latitude: 12.9716, longitude: 77.5946 };

  const handleRecenter = () => {
    if (mapRef.current && isValidCoordinate(liveLocation)) {
      mapRef.current.animateToRegion({
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F3F4F6' }]}> 
      <View style={[styles.header, { paddingVertical: isTablet ? 14 : 24, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderBottomColor: isDark ? '#334155' : '#D1D5DB' }]}> 
        <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#111827' }]}>Live Tracking</Text>
        <Text style={[styles.statusText, { color: isDark ? '#10B981' : '#059669' }]}> 
          🟢 Online & Broadcasting
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={[styles.map, styles.webPlaceholder, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}> 
            <Text style={{ fontSize: 60 }}>📍</Text>
            <Text style={[styles.webTitle, { color: isDark ? '#F8FAFC' : '#111827' }]}>Interactive Map Disabled on Web</Text>
            <Text style={[styles.webSubtitle, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Please use the mobile app to view Mohan's real-time Google Map.</Text>
          </View>
        ) : (
          <View style={styles.mapWrap}>
            {(!isLocationSharing && isAdmin) && (
              <View style={styles.adminPrivacyWarning}>
                <Text style={styles.adminPrivacyWarningText}>⚠️ Privacy mode is ON. Parents see your Last Known Region.</Text>
              </View>
            )}
            <MapView 
              ref={mapRef}
              style={styles.map}
              initialRegion={MAP_REGION}
              provider={PROVIDER_DEFAULT}
              showsUserLocation={false} 
            >
              <Marker coordinate={MARKER_COORDINATE} title={isAdmin ? "Me" : "Last Known Location"} description={(!isLocationSharing && !isAdmin) ? "Paused" : "Current Location"}>
                <View style={styles.customMarker}>
                  <Text style={styles.markerEmoji}>🚶</Text>
                </View>
              </Marker>
            </MapView>

            {/* Recenter Floating Button */}
            <TouchableOpacity style={[styles.recenterBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#D1D5DB' }]} onPress={handleRecenter}>
              <Text style={[styles.recenterText, { color: isDark ? '#FFFFFF' : '#2563EB' }]}>📍 Recenter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusTextHidden: { color: '#F59E0B' },
  mapContainer: { flex: 1 },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  webPlaceholder: { justifyContent: 'center', alignItems: 'center', padding: 24, flex: 1 },
  webTitle: { fontSize: 20, marginTop: 16, fontWeight: 'bold' },
  webSubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  customMarker: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  markerEmoji: { fontSize: 24 },

  adminPrivacyWarning: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 10, alignItems: 'center' },
  adminPrivacyWarningText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

  recenterBtn: { position: 'absolute', bottom: 30, right: 20, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  recenterText: { fontWeight: 'bold', fontSize: 14 }
});
