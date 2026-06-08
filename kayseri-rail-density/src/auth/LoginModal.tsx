import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useAuth } from './AuthContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function LoginModal({ visible, onClose, onSuccess }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function reset() {
    setUsername('');
    setPassword('');
    setError(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleLogin() {
    const ok = login(username.trim(), password);
    if (ok) {
      reset();
      onClose();
      onSuccess?.();
    } else {
      setError(true);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={handleClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.accent} />
            <Text style={styles.title}>Yönetici Girişi</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Kullanıcı adı"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => { setUsername(t); setError(false); }}
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(false); }}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />

          {error && (
            <Text style={styles.errorText}>Kullanıcı adı veya şifre hatalı.</Text>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>İptal</Text>
            </Pressable>
            <Pressable
              onPress={handleLogin}
              style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
            >
              <Text style={styles.submitText}>Giriş Yap</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.surfaceElevated,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
    ...theme.shadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { color: theme.textPrimary, fontSize: 17, fontWeight: '800' },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.textPrimary,
    fontSize: 15,
  },
  errorText: { color: '#f87171', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelText: { color: theme.textSecondary, fontSize: 14, fontWeight: '700' },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
