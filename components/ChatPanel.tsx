import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, FlatList, TextInput,
  Animated, KeyboardAvoidingView, Platform, useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { useAuth } from '@/context/auth'
import { useSpace } from '@/context/space'
import {
  Message, getMessages, sendMessage, subscribeToMessages, markRead, getUnreadCount,
} from '@/lib/chat'
import type { RealtimeChannel } from '@supabase/supabase-js'

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 56



function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (isOwn) {
    return (
      <View style={styles.rowOwn}>
        <View style={styles.bubbleOwn}>
          <Text style={styles.bubbleTextOwn}>{message.content}</Text>
          <Text style={styles.timeOwn}>{formatTime(message.created_at)}</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={styles.rowOther}>
      <View>
        <Text style={styles.senderName}>{message.sender_name}</Text>
        <View style={styles.bubbleOther}>
          <Text style={styles.bubbleTextOther}>{message.content}</Text>
          <Text style={styles.timeOther}>{formatTime(message.created_at)}</Text>
        </View>
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
  const inputRef = useRef<TextInput>(null)
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
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [msg, ...prev])
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
      setTimeout(() => inputRef.current?.focus(), 100)
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
      await sendMessage(space.id, user.id, displayName, content)
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
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.handleTint]} />
            <Pressable style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} onPress={openChat}>
              <Ionicons name="chatbubbles" size={20} color="rgba(200,220,255,0.90)" />
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
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.80)" />
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator style={{ flex: 1 }} color="rgba(255,255,255,0.80)" />
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
                ref={inputRef}
                style={styles.chatInput}
                placeholder="Envoyer un message..."
                placeholderTextColor="rgba(255,255,255,0.50)"
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
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    borderColor: 'rgba(140,180,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  handleTint: {
    backgroundColor: 'rgba(30,55,140,0.25)',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
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
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    borderColor: 'rgba(140,170,255,0.20)',
    elevation: 20,
    zIndex: 200,
    overflow: 'hidden',
    backgroundColor: 'rgba(8,16,48,0.92)',
  },

  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.28)',
  },
  drawerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },

  messageList: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },

  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },

  bubbleOwn: {
    backgroundColor: 'rgba(37,99,235,0.80)',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    maxWidth: '80%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,160,255,0.35)',
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    maxWidth: '75%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bubbleTextOwn: { fontSize: 15, color: '#ffffff', lineHeight: 21 },
  bubbleTextOther: { fontSize: 15, color: 'rgba(220,232,255,0.95)', lineHeight: 21 },
  senderName: { fontSize: 11, fontWeight: '600', color: 'rgba(180,200,255,0.60)', marginBottom: 3, marginLeft: 2 },
  timeOwn: { fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 4, textAlign: 'right' },
  timeOther: { fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 4, textAlign: 'right' },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 14, color: 'rgba(255,255,255,0.50)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(8,16,48,0.60)',
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140,170,255,0.20)',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(37,99,235,0.80)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,160,255,0.35)',
  },
  sendBtnDisabled: { opacity: 0.35 },

  navBarFill: {
    height: 44,
    backgroundColor: '#1a0e30',
  },
})
