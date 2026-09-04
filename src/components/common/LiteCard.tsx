import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useAppStore } from '../../state/useAppStore';

interface LiteCardProps {
  title?: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
  badge?: string;
  badgeColor?: string;
}

export const LiteCard: React.FC<LiteCardProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  children,
  style,
  badge,
  badgeColor = '#1D4ED8',
}) => {
  const { config } = useAppStore();

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      style={[
        styles.card,
        config.enableShadows && styles.shadow,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {(title || subtitle || badge) && (
        <View style={styles.header}>
          <View style={styles.titleWrapper}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
      )}
      {children}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shadow: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
