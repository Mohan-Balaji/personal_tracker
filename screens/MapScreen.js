import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

export default function MapScreen({ route }) {
  const mapRef = useRef(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [isLocationSharing, setIsLocationSharing] = useState(true);
  const [hasCentered, setHasCentered] = useState(false);
  
  const isAdmin = route?.params?.isAdmin || false;

  useEffect(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    const ADMIN_DOC = `mohan_${todayDate}`;

    const unsub = onSnapshot(doc(db, "users", ADMIN_DOC), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (isAdmin && data.adminLiveLocation) {
          setLiveLocation(data.adminLiveLocation);
        } else if (!isAdmin && data.liveLocation) {
          setLiveLocation(data.liveLocation);
        }
        if (data.locationSharing !== undefined) setIsLocationSharing(data.locationSharing);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Snap camera to live location safely ONLY on first load (to avoid disrupting user panning later)
    if (liveLocation && mapRef.current && !hasCentered) {
      mapRef.current.animateToRegion({
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
      setHasCentered(true);
    }
  }, [liveLocation, hasCentered]);

  const MOHAN_LOCATION = liveLocation ? {
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

  const handleRecenter = () => {
    if (mapRef.current && liveLocation) {
      mapRef.current.animateToRegion({
        latitude: liveLocation.latitude,
        longitude: liveLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <Text style={styles.statusText}>
          🟢 Online & Broadcasting
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={[styles.map, styles.webPlaceholder]}>
            <Text style={{ fontSize: 60 }}>📍</Text>
            <Text style={styles.webTitle}>Interactive Map Disabled on Web</Text>
            <Text style={styles.webSubtitle}>Please use the mobile app to view Mohan's real-time Google Map.</Text>
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
              initialRegion={MOHAN_LOCATION}
              provider={PROVIDER_DEFAULT}
              showsUserLocation={false} 
            >
              <Marker coordinate={MOHAN_LOCATION} title={isAdmin ? "Me" : "Last Known Location"} description={(!isLocationSharing && !isAdmin) ? "Paused" : "Current Location"}>
                <View style={styles.customMarker}>
                  <Text style={styles.markerEmoji}>🚶</Text>
                </View>
              </Marker>
            </MapView>

            {/* Recenter Floating Button */}
            <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter}>
              <Text style={styles.recenterText}>📍 Recenter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 24, paddingBottom: 16, backgroundColor: '#1E293B' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  statusText: { fontSize: 14, color: '#10B981', fontWeight: '600' },
  statusTextHidden: { color: '#F59E0B' },
  mapContainer: { flex: 1 },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  webPlaceholder: { backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 24, flex: 1 },
  webTitle: { color: '#F8FAFC', fontSize: 20, marginTop: 16, fontWeight: 'bold' },
  webSubtitle: { color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center' },
  customMarker: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  markerEmoji: { fontSize: 24 },

  adminPrivacyWarning: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 10, alignItems: 'center' },
  adminPrivacyWarningText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

  recenterBtn: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#1E293B', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  recenterText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});
