import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { sendPushToOthers } from '../utils/push-notifications';

export default function ChatScreen({ route }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const flatListRef = useRef(null);
  
  const email = route.params?.email || '';
  const isAdmin = email === 'bmohanbalaji1976@gmail.com';
  let senderName = 'Family Member';
  if (email === 'bmohanbalaji1976@gmail.com') {
    senderName = 'Mohan';
  } else if (email === 'mohanbalaji801@gmail.com') {
    senderName = 'Kalaiselvi';
  } else if (email === 'mohanbalaji144@gmail.com') {
    senderName = 'Baskar';
  }

  useEffect(() => {
    // Listen to all messages in the 'family_chat' folder
    const q = query(collection(db, 'family_chat'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // WhatsApp Style Date Injection
      const grouped = [];
      let lastDate = '';
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      msgs.forEach(m => {
        const dateObj = m.createdAt ? m.createdAt.toDate() : new Date();
        let dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        if (dateObj.toDateString() === today.toDateString()) {
          dateStr = 'Today';
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
          dateStr = 'Yesterday';
        }

        if (dateStr !== lastDate) {
          grouped.push({ id: `date-${dateStr}`, isDate: true, text: dateStr });
          lastDate = dateStr;
        }
        grouped.push(m);
      });

      setMessages(grouped);
    });

    return () => unsub();
  }, []);

  const sendMessage = async () => {
    if (newMessage.trim() === '') return;
    const textToSend = newMessage.trim();
    
    await addDoc(collection(db, 'family_chat'), {
      text: textToSend,
      sender: senderName,
      isAdmin: isAdmin,
      createdAt: serverTimestamp()
    });

    await sendPushToOthers(db, {
      title: `New Message from ${senderName}`,
      body: textToSend,
      excludeEmail: email,
      data: { type: 'chat' },
    });
    
    setNewMessage('');
  };

  const deleteMessage = (id) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message permanently?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteDoc(doc(db, 'family_chat', id));
          } catch(e) {}
        } }
      ]
    );
  };

  const getNameColor = (name) => {
    if (name === 'Mohan') return '#F97316'; // Orange
    if (name === 'Kalaiselvi') return '#F43F5E'; // Red/Pink (Rose)
    if (name === 'Baskar') return '#FBBF24'; // Manjatha (Bright Yellow)
    return '#3B82F6';
  };

  const renderMessage = ({ item }) => {
    if (item.isDate) {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{item.text}</Text>
        </View>
      );
    }

    const isMe = item.sender === senderName;
    const timeString = item.createdAt 
      ? new Date(item.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Sending...';

    const myBubbleColor = getNameColor(senderName);

    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        onLongPress={isMe ? () => deleteMessage(item.id) : null}
        delayLongPress={400}
        style={[styles.messageBubble, isMe ? [styles.myMessage, { backgroundColor: myBubbleColor }] : styles.theirMessage]}
      >
        {!isMe && <Text style={[styles.senderName, { color: getNameColor(item.sender) }]}>{item.sender}</Text>}
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.text}
        </Text>
        <Text style={[styles.timestampText, isMe ? styles.myTimestampText : styles.theirTimestampText]}>
          {timeString}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Family Chat - {senderName}</Text>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.contentWrapper} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
          // To automatically start at the bottom, we wait for layout
          onContentSizeChange={(_, h) => flatListRef.current?.scrollToOffset({ offset: h, animated: true })}
          ref={flatListRef}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#64748B"
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center' },
  header: { width: '100%', padding: 20, backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  
  contentWrapper: { flex: 1, width: '100%', maxWidth: 800 },
  chatList: { padding: 16, paddingBottom: 30 },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 12 },
  myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderBottomLeftRadius: 4 },
  
  dateSeparator: { alignSelf: 'center', backgroundColor: 'rgba(51, 65, 85, 0.7)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16, marginVertical: 16 },
  dateSeparatorText: { color: '#F8FAFC', fontSize: 12, fontWeight: 'bold' },

  senderName: { fontSize: 12, marginBottom: 4, fontWeight: 'bold' },
  messageText: { fontSize: 16 },
  myMessageText: { color: '#FFFFFF' },
  theirMessageText: { color: '#F8FAFC' },
  
  timestampText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  myTimestampText: { color: 'rgba(255, 255, 255, 0.7)' },
  theirTimestampText: { color: '#94A3B8' },
  
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155' },
  input: { flex: 1, backgroundColor: '#0F172A', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  sendBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  sendIcon: { fontSize: 20, color: '#FFF' }
});
