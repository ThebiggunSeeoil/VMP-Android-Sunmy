import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface GarbageItemsListViewProps {
  items: any[];
  targetHouseNumber?: string;
  onRetry: () => void;
  onProceed: (selectedItemIds: number[]) => void;
  onViewItemDetail: (item: any) => void;
  onCancel: () => void;
}

export const GarbageItemsListView: React.FC<GarbageItemsListViewProps> = ({
  items,
  targetHouseNumber,
  onRetry,
  onProceed,
  onViewItemDetail,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'received'>('pending');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Split pending and received
  const pendingItems = useMemo(
    () => items.filter((i) => !i.paid_status && i.job_type !== 'received'),
    [items]
  );
  const receivedItems = useMemo(
    () => items.filter((i) => Boolean(i.paid_status || i.job_type === 'received')),
    [items]
  );

  const displayedItems = activeTab === 'pending' ? pendingItems : receivedItems;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllPending = () => {
    if (selectedIds.length === pendingItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingItems.map((i) => Number(i.id)));
    }
  };

  // Total pending quantities across all pending items
  const totalPendingBags = useMemo(
    () =>
      pendingItems
        .filter((i) => i.bill_type === 'Bag')
        .reduce((sum, i) => sum + Number(i.bag_no || 0), 0),
    [pendingItems]
  );

  const totalPendingCards = useMemo(
    () =>
      pendingItems
        .filter((i) => i.bill_type === 'Card')
        .reduce((sum, i) => sum + Number(i.card_no || 0), 0),
    [pendingItems]
  );

  // Selected totals
  const selectedData = useMemo(
    () => pendingItems.filter((i) => selectedIds.includes(Number(i.id))),
    [pendingItems, selectedIds]
  );

  const totalBags = useMemo(
    () =>
      selectedData
        .filter((i) => i.bill_type === 'Bag')
        .reduce((sum, i) => sum + Number(i.bag_no || 0), 0),
    [selectedData]
  );

  const totalCards = useMemo(
    () =>
      selectedData
        .filter((i) => i.bill_type === 'Card')
        .reduce((sum, i) => sum + Number(i.card_no || 0), 0),
    [selectedData]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'ไม่มีข้อมูล') return '-';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('th-TH');
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Work Summary Bar with High-Impact Focus */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryTopRow}>
          <View style={styles.houseTitleBox}>
            <Text style={styles.houseEmoji}>🏠</Text>
            <Text style={styles.houseText}>
              บ้านเลขที่ {targetHouseNumber || (items[0]?.bag_contorl_house_number_local ?? '-')}
            </Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>🔄 ค้นหาใหม่</Text>
          </TouchableOpacity>
        </View>

        {/* Highlighting Pending Banner */}
        <View style={styles.pendingHighlightBanner}>
          <View style={styles.pendingMainBadge}>
            <Text style={styles.pendingBadgeText}>
              ⏳ ค้างรับ {pendingItems.length} รายการ
            </Text>
          </View>
          <Text style={styles.pendingUnitsText}>
            ({totalPendingBags > 0 ? `ถุงขยะ ${totalPendingBags} ห่อ` : ''}
            {totalPendingBags > 0 && totalPendingCards > 0 ? ', ' : ''}
            {totalPendingCards > 0 ? `คีย์การ์ด ${totalPendingCards} อัน` : ''}
            {totalPendingBags === 0 && totalPendingCards === 0 ? '0 รายการ' : ''})
          </Text>
        </View>
      </View>

      {/* Tabs Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
          onPress={() => {
            setActiveTab('pending');
            setSelectedIds([]);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            รอนำจ่าย
          </Text>
          <View style={[styles.tabBadge, activeTab === 'pending' ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'pending' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive]}>
              {pendingItems.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'received' && styles.tabBtnActive]}
          onPress={() => {
            setActiveTab('received');
            setSelectedIds([]);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            สำเร็จแล้ว
          </Text>
          <View style={[styles.tabBadge, activeTab === 'received' ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'received' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive]}>
              {receivedItems.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Select All Row for Pending Tab */}
      {activeTab === 'pending' && pendingItems.length > 0 && (
        <View style={styles.selectAllRow}>
          <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllPending} activeOpacity={0.75}>
            <View style={[styles.checkbox, selectedIds.length === pendingItems.length && styles.checkboxSelected]}>
              {selectedIds.length === pendingItems.length && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>
              {selectedIds.length === pendingItems.length ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCountText}>เลือกแล้ว {selectedIds.length}/{pendingItems.length}</Text>
        </View>
      )}

      {/* Items List */}
      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollListContent} showsVerticalScrollIndicator={false}>
        {displayedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{activeTab === 'pending' ? '🎉' : '📂'}</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'ไม่มีรายการค้างรับ' : 'ยังไม่มีประวัติการรับของ'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'pending'
                ? 'บ้านเลขที่นี้ไม่มีถุงขยะหรือคีย์การ์ดที่รอนำจ่าย'
                : 'ไม่พบรายการที่ทำรายการสำเร็จก่อนหน้านี้'}
            </Text>
          </View>
        ) : (
          displayedItems.map((item) => {
            const isBag = item.bill_type === 'Bag';
            const count = isBag ? item.bag_no || 0 : item.card_no || 0;
            const itemId = Number(item.id);
            const isSelected = selectedIds.includes(itemId);
            const isItemPaid = Boolean(item.paid_status || item.job_type === 'received');

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemCard,
                  isItemPaid ? styles.itemCardReceived : styles.itemCardPending,
                  isSelected && styles.itemCardSelected,
                ]}
                onPress={() => {
                  if (activeTab === 'pending') {
                    toggleSelect(itemId);
                  } else {
                    onViewItemDetail(item);
                  }
                }}
                activeOpacity={0.85}
              >
                {/* Left Colored Accent Stripe */}
                <View style={[styles.cardStripe, isItemPaid ? styles.cardStripeGreen : styles.cardStripeAmber]} />

                <View style={styles.cardMain}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.typeBadge, isBag ? styles.typeBadgeBag : styles.typeBadgeCard]}>
                      <Text style={styles.typeBadgeIcon}>{isBag ? '🗑️' : '💳'}</Text>
                      <Text style={[styles.typeBadgeText, isBag ? styles.typeBadgeTextBag : styles.typeBadgeTextCard]}>
                        {isBag ? 'ถุงขยะ' : 'คีย์การ์ด'} ({count} {isBag ? 'ห่อ' : 'อัน'})
                      </Text>
                    </View>

                    {activeTab === 'pending' ? (
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    ) : (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>✅ มอบแล้ว</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBodyRow}>
                    <View style={styles.cardInfoCol}>
                      <Text style={styles.cardIdText}>รหัส #{item.id} {item.invoice_number ? `• ${item.invoice_number}` : ''}</Text>
                      <Text style={styles.cardDateText}>
                        {isItemPaid
                          ? `ส่งมอบ: ${formatDate(item.paid_date_get)}`
                          : `วันที่ชำระเงิน: ${formatDate(item.received_date || item.created)}`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.detailLinkBtn}
                      onPress={() => onViewItemDetail(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.detailLinkText}>ดูข้อมูล ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        {activeTab === 'pending' && selectedIds.length > 0 ? (
          <View style={styles.proceedSection}>
            <View style={styles.proceedSummaryCard}>
              <View style={styles.proceedSummaryHeader}>
                <View style={styles.proceedTitleGroup}>
                  <Text style={styles.proceedBoxIcon}>📦</Text>
                  <Text style={styles.proceedSummaryTitle}>ยอดที่ต้องจัดเตรียมส่งมอบ</Text>
                </View>
                <View style={styles.selectedCountBadge}>
                  <Text style={styles.selectedCountBadgeText}>{selectedIds.length} รายการ</Text>
                </View>
              </View>

              <View style={styles.proceedItemPillsRow}>
                {totalBags > 0 && (
                  <View style={styles.proceedPillBag}>
                    <Text style={styles.proceedPillIcon}>🗑️</Text>
                    <Text style={styles.proceedPillTextBag}>
                      ถุงขยะ <Text style={styles.proceedBigCount}>{totalBags}</Text> ห่อ
                    </Text>
                  </View>
                )}
                {totalCards > 0 && (
                  <View style={styles.proceedPillCard}>
                    <Text style={styles.proceedPillIcon}>💳</Text>
                    <Text style={styles.proceedPillTextCard}>
                      คีย์การ์ด <Text style={styles.proceedBigCount}>{totalCards}</Text> อัน
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.proceedActionRow}>
              <TouchableOpacity style={styles.cancelActionBtn} onPress={onCancel} activeOpacity={0.8}>
                <Text style={styles.cancelActionText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.proceedActionBtn}
                onPress={() => onProceed(selectedIds)}
                activeOpacity={0.85}
              >
                <Text style={styles.proceedActionText}>📷 ถ่ายรูปส่งมอบ ({selectedIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.singleCloseBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={styles.singleCloseText}>ปิดหน้าต่าง</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    overflow: 'hidden',
    flex: 1,
    height: '100%',
  },
  summaryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  houseTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  houseEmoji: {
    fontSize: 22,
  },
  houseText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  pendingHighlightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  pendingMainBadge: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  pendingUnitsText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '800',
  },
  retryBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  retryBtnText: {
    color: '#475569',
    fontSize: 12.5,
    fontWeight: '800',
  },
  tabSwitcher: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#6D28D9',
  },
  tabText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tabBadgeActive: {
    backgroundColor: '#F59E0B',
  },
  tabBadgeInactive: {
    backgroundColor: '#CBD5E1',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  tabBadgeTextInactive: {
    color: '#475569',
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedCountText: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '900',
  },
  scrollList: {
    flexGrow: 1,
  },
  scrollListContent: {
    padding: 12,
    gap: 8,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  itemCardPending: {
    borderColor: '#FDE68A',
  },
  itemCardReceived: {
    borderColor: '#BBF7D0',
  },
  itemCardSelected: {
    borderColor: '#6D28D9',
    backgroundColor: '#FAF5FF',
  },
  cardStripe: {
    width: 6,
  },
  cardStripeAmber: {
    backgroundColor: '#F59E0B',
  },
  cardStripeGreen: {
    backgroundColor: '#16A34A',
  },
  cardMain: {
    flex: 1,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  typeBadgeBag: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  typeBadgeCard: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  typeBadgeIcon: {
    fontSize: 16,
  },
  typeBadgeText: {
    fontSize: 14.5,
    fontWeight: '900',
  },
  typeBadgeTextBag: {
    color: '#6D28D9',
  },
  typeBadgeTextCard: {
    color: '#0369A1',
  },
  doneBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneBadgeText: {
    color: '#15803D',
    fontSize: 11.5,
    fontWeight: '900',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  cardBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardInfoCol: {
    flex: 1,
  },
  cardIdText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardDateText: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '700',
  },
  detailLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailLinkText: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '900',
  },
  bottomBar: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  proceedSection: {
    gap: 10,
  },
  proceedSummaryCard: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  proceedSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proceedTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proceedBoxIcon: {
    fontSize: 18,
  },
  proceedSummaryTitle: {
    color: '#581C87',
    fontSize: 14,
    fontWeight: '900',
  },
  selectedCountBadge: {
    backgroundColor: '#6D28D9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
  },
  proceedItemPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proceedPillBag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  proceedPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  proceedPillIcon: {
    fontSize: 16,
  },
  proceedPillTextBag: {
    color: '#6D28D9',
    fontSize: 15,
    fontWeight: '800',
  },
  proceedPillTextCard: {
    color: '#0369A1',
    fontSize: 15,
    fontWeight: '800',
  },
  proceedBigCount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4C1D95',
  },
  proceedActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelActionText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '900',
  },
  proceedActionBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  proceedActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  singleCloseBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  singleCloseText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '900',
  },
});
