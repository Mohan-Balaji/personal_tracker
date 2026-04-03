import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { sendPushToOthers } from '../utils/push-notifications';
import { useAppTheme } from '../utils/theme-context';

export default function ChatScreen({ route }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const insets = useSafeAreaInsets();
  const { themeMode } = useAppTheme();
  
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

  const isDark = themeMode === 'dark';

  const theme = {
    bg: isDark ? '#0F172A' : '#F3F4F6',
    headerBg: isDark ? '#111827' : '#FFFFFF',
    headerBorder: isDark ? '#1F2937' : '#D1D5DB',
    headerText: isDark ? '#F8FAFC' : '#111827',
    panelBg: isDark ? '#111827' : '#FFFFFF',
    panelBorder: isDark ? '#1F2937' : '#D1D5DB',
    dateBg: isDark ? 'rgba(51, 65, 85, 0.7)' : '#E5E7EB',
    dateBorder: isDark ? '#334155' : '#D1D5DB',
    dateText: isDark ? '#E2E8F0' : '#4B5563',
    theirBubbleBg: isDark ? '#1E293B' : '#FFFFFF',
    theirBubbleBorder: isDark ? '#334155' : '#D1D5DB',
    theirText: isDark ? '#F8FAFC' : '#111827',
    theirTime: isDark ? '#94A3B8' : '#6B7280',
    inputBg: isDark ? '#0F172A' : '#F9FAFB',
    inputBorder: isDark ? '#334155' : '#D1D5DB',
    inputText: isDark ? '#FFFFFF' : '#111827',
  };

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

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
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

  const openWhatsApp = async () => {
    const appUrl = 'whatsapp://send?phone=918925236216';
    const webUrl = 'https://wa.me/918925236216';
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      if (canOpen) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      Alert.alert('WhatsApp', 'Unable to open WhatsApp right now.');
    }
  };

  const getNameColor = (name) => {
    if (name === 'Mohan') return '#F97316'; // Orange
    if (name === 'Kalaiselvi') return '#F43F5E'; // Red/Pink (Rose)
    if (name === 'Baskar') return '#D97706'; // Muted amber for better text contrast
    return '#3B82F6';
  };

  const renderMessage = ({ item }) => {
    if (item.isDate) {
      return (
        <View style={[styles.dateSeparator, { backgroundColor: theme.dateBg, borderColor: theme.dateBorder }]}>
          <Text style={[styles.dateSeparatorText, { color: theme.dateText }]}>{item.text}</Text>
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
        style={[
          styles.messageBubble,
          isMe
            ? [styles.myMessage, { backgroundColor: myBubbleColor }]
            : [styles.theirMessage, { backgroundColor: theme.theirBubbleBg, borderColor: theme.theirBubbleBorder }],
        ]}
      >
        {!isMe && <Text style={[styles.senderName, { color: getNameColor(item.sender) }]}>{item.sender}</Text>}
        <Text style={[styles.messageText, isMe ? styles.myMessageText : [styles.theirMessageText, { color: theme.theirText }]]}>
          {item.text}
        </Text>
        <Text style={[styles.timestampText, isMe ? styles.myTimestampText : [styles.theirTimestampText, { color: theme.theirTime }]]}>
          {timeString}
        </Text>
      </TouchableOpacity>
    );
  };

  const inputDockPadding = Math.max(insets.bottom, 10);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}> 
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}> 
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>Family Chat - {senderName}</Text>
        <TouchableOpacity style={styles.whatsappTopBtn} onPress={openWhatsApp}>
          <Text style={styles.whatsappTopBtnText}>WhatsApp</Text>
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.contentWrapper} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 10}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ref={flatListRef}
        />

        <View style={[styles.inputContainer, { paddingBottom: inputDockPadding, backgroundColor: theme.panelBg, borderTopColor: theme.panelBorder }]}> 
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
            placeholder="Type a message..."
            placeholderTextColor={isDark ? '#64748B' : '#8E8E93'}
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
            textAlignVertical="center"
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
  container: { flex: 1, alignItems: 'center' },
  header: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: { fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },
  whatsappTopBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#25D366' },
  whatsappTopBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  
  contentWrapper: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  chatList: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 18 },
  messageBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginBottom: 10 },
  myMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  theirMessage: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 6 },
  
  dateSeparator: {
    alignSelf: 'center',
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginVertical: 14
  },
  dateSeparatorText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  senderName: { fontSize: 11, marginBottom: 4, fontWeight: '700' },
  messageText: { fontSize: 16, lineHeight: 21 },
  myMessageText: { color: '#FFFFFF' },
  theirMessageText: {},
  
  timestampText: { fontSize: 10, marginTop: 5, alignSelf: 'flex-end', letterSpacing: 0.2 },
  myTimestampText: { color: 'rgba(241, 247, 255, 0.85)' },
  theirTimestampText: {},

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    maxHeight: 120
  },
  sendBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2D7DFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 1,
    shadowColor: '#2D7DFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  sendIcon: { fontSize: 20, color: '#F4F8FF', marginLeft: 1 }
});
