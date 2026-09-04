import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';

interface KeypadModalProps {
  visible: boolean;
  title?: string;
  reason?: string;
  initialValue?: string;
  houseNumbers?: string[];
  canSubmitEmpty?: boolean;
  isGateMode?: boolean;
  hideUnknownHouse?: boolean;
  hideHomeButton?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  onUnknownHouse?: () => void;
}

interface KeyButtonProps {
  label: string;
  isGateMode?: boolean;
  onPressKey: (key: string) => void;
}

const KeyButton = React.memo<KeyButtonProps>(({ label, isGateMode, onPressKey }) => {
  return (
    <Pressable
      style={[styles.keyBtn, isGateMode && styles.keyBtnGate]}
      onPressIn={() => onPressKey(label)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      android_ripple={{ color: '#E0E7FF', borderless: false }}
    >
      <Text style={[styles.keyText, isGateMode && styles.keyTextGate]}>{label}</Text>
    </Pressable>
  );
});

export const KeypadModal: React.FC<KeypadModalProps> = ({
  visible,
  title = 'ระบุบ้านเลขที่',
  reason,
  initialValue = '',
  houseNumbers = [],
  canSubmitEmpty = true,
  isGateMode = false,
  hideUnknownHouse = false,
  hideHomeButton = false,
  onConfirm,
  onCancel,
  onUnknownHouse,
}) => {
  const [text, setText] = useState(initialValue);
  const [showAllHouses, setShowAllHouses] = useState(false);
  const [selectedHouseGroup, setSelectedHouseGroup] = useState('');
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);

  const shouldHideBottomRow = isGateMode || (hideUnknownHouse && hideHomeButton);

  const availableHouses = useMemo(
    () =>
      Array.from(new Set(houseNumbers.map((house) => house.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'th-TH', { numeric: true })
      ),
    [houseNumbers]
  );

  const houseGroups = useMemo(() => {
    return availableHouses.reduce<Record<string, string[]>>((groups, house) => {
      const group = house.split('/')[0].trim() || house;
      if (!groups[group]) groups[group] = [];
      groups[group].push(house);
      return groups;
    }, {});
  }, [availableHouses]);

  const groupNames = useMemo(
    () => Object.keys(houseGroups).sort((a, b) => a.localeCompare(b, 'th-TH', { numeric: true })),
    [houseGroups]
  );

  const housesInSelectedGroup = selectedHouseGroup ? houseGroups[selectedHouseGroup] || [] : [];

  const matchingHouses = useMemo(() => {
    const keyword = text.trim();
    if (!keyword) return [];

    return availableHouses.filter((house) => house.startsWith(keyword)).slice(0, 12);
  }, [availableHouses, text]);

  // Reset ทุกครั้งที่ modal เปิด เพื่อให้ user ป้อนใหม่เสมอ
  useEffect(() => {
    if (visible) {
      setText('');
      setShowAllHouses(false);
      setSelectedHouseGroup('');
      setShowEmptyWarning(false);
    }
  }, [visible]);

  const handlePressKey = React.useCallback((key: string) => {
    setShowEmptyWarning(false);
    if (key === 'DEL') {
      setText((prev) => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setText('');
    } else {
      setText((prev) => prev + key);
    }
  }, []);

  const openAllHouses = () => {
    const typedGroup = text.trim().split('/')[0];
    const initialGroup = houseGroups[typedGroup] ? typedGroup : groupNames[0] || '';
    setSelectedHouseGroup(initialGroup);
    setShowAllHouses(true);
  };

  const handleUnknownHouse = () => {
    if (onUnknownHouse) {
      onUnknownHouse();
    } else {
      onConfirm('');
    }
  };

  // PWA Keypad Rows
  const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '/'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.modalBox, isGateMode && styles.modalBoxGate]}>
          {showAllHouses ? (
            <>
              <View style={styles.listHeader}>
                <View>
                  <Text style={styles.listTitle}>เลือกบ้านเลขที่</Text>
                  <Text style={styles.listSubtitle}>เลือกกลุ่มเลข แล้วเลือกบ้านเลขที่</Text>
                </View>
                <TouchableOpacity style={styles.backToKeypadBtn} onPress={() => setShowAllHouses(false)}>
                  <Text style={styles.backToKeypadText}>⌫ กลับไปพิมพ์</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.listDivider} />
              <View style={styles.groupAndHouseLayout}>
                <View style={styles.groupColumn}>
                  <Text style={styles.columnLabel}>กลุ่มเลข</Text>
                  <ScrollView style={styles.groupSidebar} contentContainerStyle={styles.groupList} showsVerticalScrollIndicator={false}>
                    {groupNames.map((group) => {
                      const isSelected = selectedHouseGroup === group;
                      return (
                        <TouchableOpacity
                          key={group}
                          style={[styles.groupChip, isSelected && styles.groupChipSelected]}
                          onPress={() => setSelectedHouseGroup(group)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.groupChipText, isSelected && styles.groupChipTextSelected]}>{group}</Text>
                          <Text style={[styles.groupCountText, isSelected && styles.groupCountTextSelected]}>
                            {houseGroups[group].length}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.houseColumn}>
                  <View style={styles.houseColumnHeader}>
                    <Text style={styles.columnLabel}>บ้านเลขที่ {selectedHouseGroup || '-'}</Text>
                    <Text style={styles.houseCountText}>{housesInSelectedGroup.length} รายการ</Text>
                  </View>
                  <ScrollView style={styles.houseListPane} contentContainerStyle={styles.allHousesGrid} showsVerticalScrollIndicator={false}>
                    {housesInSelectedGroup.map((house) => {
                      const isSelected = text === house;
                      return (
                        <TouchableOpacity
                          key={house}
                          style={[styles.houseChip, isSelected && styles.houseChipSelected]}
                          onPress={() => {
                            setText(house);
                            setShowAllHouses(false);
                            onConfirm(house);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.houseChipText, isSelected && styles.houseChipTextSelected]}>{house}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {availableHouses.length === 0 && (
                      <Text style={styles.emptyText}>ไม่พบรายการบ้านจากระบบ กรุณาพิมพ์บ้านเลขที่</Text>
                    )}
                  </ScrollView>
                </View>
              </View>
            </>
          ) : (
            <>
              {/* Prominent Multi-Language Notice Banner for Gate Control */}
              {isGateMode && (
                <View style={styles.gateNoticeBanner}>
                  <View style={styles.gateNoticeHeader}>
                    <Text style={styles.gateNoticeIcon}>🚧</Text>
                    <Text style={styles.gateNoticeMainText}>จำเป็นต้องป้อนบ้านเลขที่เพื่อเปิดไม้กั้น</Text>
                  </View>
                  <View style={styles.gateNoticeSubRow}>
                    <Text style={styles.gateNoticeEnText}>• House number required to open barrier</Text>
                    <Text style={styles.gateNoticeCnText}>• 必须输入房号以开启道闸</Text>
                  </View>
                </View>
              )}

              {/* เหตุผล (ถ้ามี) */}
              {reason && !isGateMode ? (
                <View style={styles.reasonBadge}>
                  <Text style={styles.reasonText}>เหตุผล : {reason}</Text>
                </View>
              ) : null}

              {/* Sub-header ระบุบ้านเลขที่ */}
              <View style={[styles.headerPill, isGateMode && styles.headerPillGate]}>
                <Text style={[styles.headerPillText, isGateMode && styles.headerPillTextGate]}>{title}</Text>
              </View>

              {/* Display Box */}
              <View style={[styles.inputDisplay, isGateMode && styles.inputDisplayGate, showEmptyWarning && styles.inputDisplayWarning]}>
                <Text style={text ? (isGateMode ? styles.inputTextGate : styles.inputText) : styles.inputPlaceholder}>
                  {text || '000/00'}
                </Text>
              </View>

              {/* Empty Warning Tooltip (if submitted empty in gate mode) */}
              {showEmptyWarning && (
                <View style={styles.emptyWarningBox}>
                  <Text style={styles.emptyWarningText}>⚠️ กรุณาระบุบ้านเลขที่ก่อนกดยืนยัน</Text>
                </View>
              )}

              {/* Suggestion Chips Slot - แสดงผลเมื่อเริ่มป้อนข้อมูลเท่านั้น */}
              <View style={styles.houseChooserSlot}>
                {text.trim().length > 0 && availableHouses.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.suggestionBar}
                    contentContainerStyle={styles.suggestionList}
                  >
                    <TouchableOpacity style={styles.allHousesChip} onPress={openAllHouses} activeOpacity={0.8}>
                      <Text style={styles.allHousesChipText}>ทั้งหมด</Text>
                    </TouchableOpacity>
                    {matchingHouses.length > 0 ? (
                      matchingHouses.map((house) => (
                        <TouchableOpacity
                          key={house}
                          style={styles.suggestionChip}
                          onPress={() => {
                            setText(house);
                            onConfirm(house);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.suggestionChipText}>{house}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.noMatchChip}>
                        <Text style={styles.noMatchChipText}>⚠️ ไม่พบในระบบ</Text>
                      </View>
                    )}
                  </ScrollView>
                ) : null}
              </View>

              {/* 4x3 Number Grid: 1-9, -, 0, / (Instant 0ms Touch Response with Memoized KeyButton) */}
              <View style={styles.grid}>
                {numberKeys.map((k) => (
                  <KeyButton
                    key={k}
                    label={k}
                    isGateMode={isGateMode}
                    onPressKey={handlePressKey}
                  />
                ))}
              </View>

              {/* Action Buttons Row: ตกลง (เขียว) | ยกเลิก (แดง) | ลบ (เหลือง/ส้ม) */}
              <View style={[styles.actionRow, isGateMode && styles.actionRowGate]}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn, isGateMode && styles.actionBtnGate]}
                  onPress={() => {
                    if (text.trim()) {
                      onConfirm(text.trim());
                    } else if (isGateMode || !canSubmitEmpty) {
                      setShowEmptyWarning(true);
                    } else {
                      handleUnknownHouse();
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>ตกลง</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn, isGateMode && styles.actionBtnGate]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>ยกเลิก</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn, isGateMode && styles.actionBtnGate]}
                  onPressIn={() => handlePressKey('DEL')}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionBtnText, styles.deleteBtnText]}>ลบ</Text>
                </TouchableOpacity>
              </View>

              {/* Bottom Row: 🏠 (ดูบ้านทั้งหมด) | ยังไม่ทราบบ้านเลขที่ (Hidden in isGateMode) */}
              {!shouldHideBottomRow && (
                <View style={styles.bottomRow}>
                  {!hideHomeButton && (
                    <TouchableOpacity style={styles.houseIconBtn} onPress={openAllHouses} activeOpacity={0.85}>
                      <Text style={styles.houseIconText}>🏠</Text>
                    </TouchableOpacity>
                  )}

                  {!hideUnknownHouse && (
                    <TouchableOpacity
                      style={styles.unknownHouseBtn}
                      onPress={handleUnknownHouse}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.unknownHouseText}>ยังไม่ทราบบ้านเลขที่</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalBoxGate: {
    maxWidth: 420,
    width: '98%',
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
  },
  gateNoticeBanner: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gateNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 3,
  },
  gateNoticeIcon: {
    fontSize: 16,
  },
  gateNoticeMainText: {
    color: '#1E3A8A',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  gateNoticeSubRow: {
    alignItems: 'center',
    gap: 1,
  },
  gateNoticeEnText: {
    color: '#2563EB',
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  gateNoticeCnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerPillGate: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    marginBottom: 6,
    paddingVertical: 5,
  },
  headerPillTextGate: {
    color: '#166534',
    fontSize: 13.5,
    fontWeight: '900',
  },
  inputDisplayGate: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1.5,
    minHeight: 48,
    paddingVertical: 6,
    marginBottom: 6,
  },
  inputDisplayWarning: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputTextGate: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  emptyWarningBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignItems: 'center',
  },
  emptyWarningText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
  },
  keyBtnGate: {
    height: 48,
  },
  keyTextGate: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '900',
  },
  actionRowGate: {
    marginBottom: 0,
  },
  actionBtnGate: {
    height: 48,
  },
  reasonBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  reasonText: {
    color: '#1E1B4B',
    fontSize: 16,
    fontWeight: '900',
  },
  headerPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  headerPillText: {
    color: '#4338CA',
    fontSize: 14,
    fontWeight: '800',
  },
  inputDisplay: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  inputText: {
    color: '#5B21B6',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputPlaceholder: {
    color: '#94A3B8',
    fontSize: 22,
    fontWeight: '800',
  },
  houseChooserSlot: {
    height: 36,
    marginBottom: 10,
    justifyContent: 'center',
  },
  suggestionBar: {
    flex: 1,
  },
  suggestionList: {
    gap: 7,
    paddingRight: 4,
    alignItems: 'center',
  },
  suggestionChip: {
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderColor: '#DDD6FE',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    height: 34,
    paddingHorizontal: 14,
  },
  suggestionChipText: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '900',
  },
  allHousesChip: {
    alignItems: 'center',
    backgroundColor: '#6D28D9',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  allHousesChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  noMatchChip: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    height: 34,
    paddingHorizontal: 12,
  },
  noMatchChipText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  keyBtn: {
    width: '31%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  keyText: {
    color: '#5B21B6',
    fontSize: 24,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  confirmBtn: {
    backgroundColor: '#16A34A',
  },
  cancelBtn: {
    backgroundColor: '#DC2626',
  },
  deleteBtn: {
    backgroundColor: '#FBBF24',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  deleteBtnText: {
    color: '#1E293B',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  houseIconBtn: {
    width: 48,
    height: 46,
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  houseIconText: {
    fontSize: 20,
  },
  unknownHouseBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unknownHouseText: {
    color: '#5B21B6',
    fontSize: 15,
    fontWeight: '900',
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listTitle: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '900',
  },
  listSubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  backToKeypadBtn: {
    backgroundColor: '#6D28D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backToKeypadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  listDivider: {
    backgroundColor: '#E2E8F0',
    height: 1,
    marginVertical: 12,
  },
  groupAndHouseLayout: {
    flexDirection: 'row',
    height: 330,
  },
  groupColumn: {
    borderRightColor: '#E2E8F0',
    borderRightWidth: 1,
    marginRight: 12,
    paddingRight: 10,
    width: 91,
  },
  columnLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '900',
  },
  groupSidebar: {
    flex: 1,
    marginTop: 9,
  },
  groupList: {
    gap: 8,
    paddingBottom: 2,
  },
  groupChip: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  groupChipSelected: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  groupChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  groupCountText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  groupChipTextSelected: {
    color: '#FFFFFF',
  },
  groupCountTextSelected: {
    color: '#DDD6FE',
  },
  houseColumn: {
    flex: 1,
  },
  houseColumnHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  houseCountText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  houseListPane: {
    flex: 1,
  },
  allHousesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 18,
  },
  houseChip: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: '47%',
  },
  houseChipSelected: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  houseChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  houseChipTextSelected: {
    color: '#FFFFFF',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 14,
  },
});
