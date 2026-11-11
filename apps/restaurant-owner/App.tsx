import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { languageOptions } from '@roamenu/shared-utils/translations';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [restaurantName, setRestaurantName] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState(languageOptions[0].code);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ROAMENU FOR RESTAURANTS</Text>
        <Text style={styles.title}>Create a menu guests can understand.</Text>
        <Text style={styles.description}>
          Start with your restaurant's original menu. You will review the source details before anything is published.
        </Text>

        <View style={styles.panel}>
          <Text style={styles.label}>Restaurant name</Text>
          <TextInput
            value={restaurantName}
            onChangeText={setRestaurantName}
            placeholder="e.g. Casa Verde"
            placeholderTextColor="#8C877D"
            style={styles.input}
          />

          <Text style={styles.label}>Menu language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageRow}>
            {languageOptions.slice(0, 5).map((language) => {
              const selected = language.code === sourceLanguage;
              return (
                <Pressable
                  key={language.code}
                  onPress={() => setSourceLanguage(language.code)}
                  style={[styles.languageOption, selected && styles.languageOptionSelected]}
                >
                  <Text style={styles.languageFlag}>{language.flag}</Text>
                  <Text style={[styles.languageLabel, selected && styles.languageLabelSelected]}>{language.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => undefined}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
        <Text style={styles.status}>Owner sign-in and menu drafts are the next step.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { flexGrow: 1, padding: 24, paddingTop: 56 },
  eyebrow: { color: '#A64B2A', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: '#1C2925', fontSize: 38, fontWeight: '800', lineHeight: 44, marginTop: 16, maxWidth: 360 },
  description: { color: '#5E655E', fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 390 },
  panel: { backgroundColor: '#FFFDF8', borderColor: '#E4DDD0', borderRadius: 16, borderWidth: 1, marginTop: 32, padding: 20 },
  label: { color: '#35433C', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  input: { borderColor: '#D8D0C2', borderRadius: 10, borderWidth: 1, color: '#1C2925', fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  languageRow: { gap: 8, paddingTop: 4 },
  languageOption: { alignItems: 'center', backgroundColor: '#F2ECE1', borderColor: '#F2ECE1', borderRadius: 10, borderWidth: 1, minWidth: 76, paddingHorizontal: 8, paddingVertical: 10 },
  languageOptionSelected: { backgroundColor: '#E8F0E7', borderColor: '#54735E' },
  languageFlag: { fontSize: 20 },
  languageLabel: { color: '#62675F', fontSize: 11, marginTop: 5 },
  languageLabelSelected: { color: '#34523E', fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: '#1C2925', borderRadius: 10, marginTop: 20, paddingVertical: 15 },
  primaryButtonText: { color: '#FFFDF8', fontSize: 16, fontWeight: '700' },
  status: { color: '#7A786F', fontSize: 13, marginTop: 14, textAlign: 'center' },
});
