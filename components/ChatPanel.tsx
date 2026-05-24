import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  Animated, KeyboardAvoidingView, Platform, useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import { userColor } from '@/lib/userColor'
import {
  Message, getMessages, sendMessage, subscribeToMessages, markRead, getUnreadCount,
} from '@/lib/chat'
import type { RealtimeChannel } from '@supabase/supabase-js'

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 56

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = userColor(name)
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: color.text }}>
        {initials(name)}
      </Text>
    </View>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (isOwn) {
    return (
      <View style={styles.rowOwn}>
        <View style={styles.bubbleOwn}>
          <Text style={styles.bubbleTextOwn}>{message.content}</Text>
        </View>
        <Text style={styles.time}>{formatTime(message.created_at)}</Text>
      </View>
    )
  }
  return (
    <View style={styles.rowOther}>
      <Avatar name={message.sender_name} size={28} />
      <View style={{ flex: 1 }}>
        <Text style={styles.senderName}>{message.sender_name}</Text>
        <View style={styles.bubbleOther}>
          <Text style={styles.bubbleTextOther}>{message.content}</Text>
        </View>
        <Text style={styles.time}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  )
}

export default function ChatPanel() {
  const { user, displayName } = useAuth()
  const { space } = useSpace()
  const { width, height } = useWindowDimensions()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [unread, setUnread] = useState(0)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)

  const drawerAnim = useRef(new Animated.Value(0)).current
  const gestureX = useRef(new Animated.Value(0)).current
  const channelRef = useRef<RealtimeChannel | null>(null)
  const openRef = useRef(false)
  const drawerWidth = width * 0.88

  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    if (!space || !user) return
    getUnreadCount(space.id, user.id).then(setUnread).catch(() => {})
  }, [space?.id, user?.id])

  useEffect(() => {
    if (!space || !user) return
    const channel = subscribeToMessages(space.id, msg => {
      if (openRef.current) {
        setMessages(prev => [msg, ...prev])
      } else if (msg.user_id !== user.id) {
        setUnread(n => n + 1)
      }
    })
    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [space?.id, user?.id])

  const openChat = async () => {
    if (!space || !user) return
    setOpen(true)
    setLoading(true)
    Animated.spring(drawerAnim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start()
    try {
      const msgs = await getMessages(space.id)
      setMessages(msgs)
      await markRead(space.id, user.id)
      setUnread(0)
    } finally {
      setLoading(false)
    }
  }

  const closeChat = () => {
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(gestureX, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false)
      setMessages([])
      gestureX.setValue(0)
    })
  }

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: gestureX } }],
    { useNativeDriver: true },
  )

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED) {
      const { translationX, velocityX } = nativeEvent
      if (translationX > drawerWidth * 0.35 || velocityX > 500) {
        Animated.parallel([
          Animated.timing(drawerAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(gestureX, { toValue: drawerWidth, duration: 200, useNativeDriver: true }),
        ]).start(() => {
          setOpen(false)
          setMessages([])
          gestureX.setValue(0)
        })
      } else {
        Animated.spring(gestureX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start()
      }
    }
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !space || !user || !displayName) return
    setInput('')
    setSending(true)
    try {
      const msg = await sendMessage(space.id, user.id, displayName, content)
      setMessages(prev => [msg, ...prev])
    } catch {
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  const onHandleStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationX < -40 || nativeEvent.velocityX < -400) {
        openChat()
      }
    }
  }

  const backdropOpacity = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  const baseTranslateX = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [drawerWidth, 0] })
  const gestureOffset = gestureX.interpolate({ inputRange: [0, drawerWidth], outputRange: [0, drawerWidth], extrapolate: 'clamp' })
  const translateX = Animated.add(baseTranslateX, gestureOffset)
  const contentHeight = height - TAB_BAR_HEIGHT
  const handleTop = contentHeight / 2 - 32

  return (
    <>
      {!open && (
        <PanGestureHandler
          onHandlerStateChange={onHandleStateChange}
          activeOffsetX={[-10, 9999]}
          failOffsetY={[-20, 20]}
        >
          <Animated.View style={[styles.handle, { top: handleTop }]}>
            <Pressable style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} onPress={openChat}>
              <Ionicons name="chatbubbles" size={20} color="rgba(255,255,255,0.90)" />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </PanGestureHandler>
      )}

      {open && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={open ? 'auto' : 'none'}
        >
          <Pressable style={{ flex: 1 }} onPress={closeChat} />
        </Animated.View>
      )}

      {open && (
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetX={[-9999, 10]}
          failOffsetY={[-20, 20]}
        >
        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Discussion</Text>
              <Pressable onPress={closeChat} hitSlop={12}>
                <Ionicons name="close" size={22} color="rgba(50,35,80,0.70)" />
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator style={{ flex: 1 }} color="rgba(50,35,80,0.70)" />
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={messages}
                keyExtractor={m => m.id}
                inverted
                renderItem={({ item }) => (
                  <MessageBubble message={item} isOwn={item.user_id === user?.id} />
                )}
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyChat}>
                    <Text style={styles.emptyChatText}>Aucun message pour l'instant</Text>
                  </View>
                }
              />
            )}

            <View style={styles.inputBar}>
              <TextInput
                style={styles.chatInput}
                placeholder="Envoyer un message..."
                placeholderTextColor="rgba(70,50,100,0.45)"
                value={input}
                onChangeText={setInput}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                multiline
              />
              <Pressable
                style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="rgba(255,255,255,0.90)" />
                  : <Ionicons name="arrow-up" size={18} color="rgba(255,255,255,0.90)" />
                }
              </Pressable>
            </View>
          </KeyboardAvoidingView>
          {Platform.OS === 'android' && <View style={styles.navBarFill} />}
        </Animated.View>
        </PanGestureHandler>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    right: 0,
    width: 46,
    height: 64,
    backgroundColor: 'rgba(110,55,180,0.85)',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  badge: {
    position: 'absolute',
    top: 8, right: 8,
    minWidth: 16, height: 16,
    borderRadius: 8,
    backgroundColor: '#e05555',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 190,
  },

  drawer: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    backgroundColor: '#1a0e30',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.40)',
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 200,
    overflow: 'hidden',
  },

  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.30)',
  },
  drawerTitle: { fontSize: 17, fontWeight: '700', color: '#1e1a36' },

  messageList: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },

  rowOwn: { alignItems: 'flex-end', gap: 3 },
  rowOther: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },

  bubbleOwn: {
    backgroundColor: 'rgba(110,55,180,0.85)',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.50)',
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  bubbleTextOwn: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 21 },
  bubbleTextOther: { fontSize: 15, color: '#1e1a36', lineHeight: 21 },
  senderName: { fontSize: 11, color: 'rgba(50,35,80,0.60)', fontWeight: '600', marginBottom: 3, marginLeft: 2 },
  time: { fontSize: 10, color: 'rgba(70,50,100,0.40)', marginTop: 2 },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 14, color: 'rgba(70,50,100,0.45)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.30)',
    backgroundColor: '#1a0e30',
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1e1a36',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.40)',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(110,55,180,0.85)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  sendBtnDisabled: { opacity: 0.35 },

  navBarFill: {
    height: 44,
    backgroundColor: '#1a0e30',
  },
})
