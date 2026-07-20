import React, { useState, useEffect, useRef } from 'react';
import { Archive, Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe, Sparkles } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon, getRestaurantExportPrefix, safeFilenamePart, downloadCsvRows, openPrintableReport, buildMenuDependencyReport, safeWriteWithQueue, replayOfflineQueue } from '../core/appCore';
import { buildPrepCreatePayload, buildPrepQuantityUpdate, findPrepMatch, formatPrepAmount, parsePrepCommandItems, summarizePrepResults } from '../core/smartPrep';
import { buildEightySixAlertDetails, buildMenuImpactText, getMenuImpactForInventoryItem, getZeroStockMenuImpacts, resolveEightySixInventoryMatch } from '../core/menuIntelligence';
import { prepareScannerUploadFile, isPdfFile } from '../core/fileCompression';
import { createAiScanIdempotencyKey, resolveClientScanPageCount, normalizeAiUsage, aiPageLimitMessage } from '../core/aiScanUsage';
import { buildAiOrderAssistant, formatAiOrderDraftText, summarizeAiOrderAssistant, isLikelyInvoiceNoiseInventoryItem } from '../core/aiOrderAssistant';
import { classifyInvoiceRow, inferInvoiceProductFields, invoiceProductKey, invoiceRowText, isPurchasedInvoiceLine, LEADING_PURCHASE_RE, normalizeInvoiceName as normalizeName, normalizeInvoiceSku as normalizeSku } from '../core/invoiceRowClassification';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';
import { usePlanAccess } from '../hooks/usePlanAccess';
import { FEATURE_KEYS } from '../config/plans';

const readableApiError = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || value.name || 'Unknown error';
  if (typeof value === 'object') {
    const direct = value.message || value.error || value.detail || value.reason || value.code;
    if (direct && direct !== value) return readableApiError(direct);
    try { return JSON.stringify(value); } catch (err) { return String(value); }
  }
  return String(value);
};


// Inventory is isolated in its own feature chunk so the Today, Prep, Recipes, and Maintenance routes do not drag the scanner/order workspace into the first authenticated load.
const EMPTY_AI_ORDER_ASSISTANT = { recommendations: [], vendorDrafts: [], managerBrief: [], eventNeeds: [], priceWarnings: [], wasteWarnings: [], prepSuggestions: [] };

const TabInventory = ({ addToast, appUser, clientData = {}, initialSubTab, onInitialSubTabConsumed }) => {
  const inventoryPlanAccess = usePlanAccess(appUser, clientData);
  const canUseBasicInventory = inventoryPlanAccess.canUse(FEATURE_KEYS.BASIC_INVENTORY).allowed || inventoryPlanAccess.canUse(FEATURE_KEYS.BURN_LOG).allowed;
  const canUseSmartInventory = inventoryPlanAccess.canUse(FEATURE_KEYS.COGS_CENTER).allowed || inventoryPlanAccess.canUse(FEATURE_KEYS.INVOICE_TOTALS).allowed || inventoryPlanAccess.canUse(FEATURE_KEYS.INVOICE_SCANNING).allowed;
  const canUseMenuIntelligence = inventoryPlanAccess.canUse(FEATURE_KEYS.MENU_INTELLIGENCE).allowed || inventoryPlanAccess.canUse(FEATURE_KEYS.DEPENDENCY_TOOLS).allowed || inventoryPlanAccess.canUse(FEATURE_KEYS.SMART_86_ALERTS).allowed;
  const canUseAiOrdering = inventoryPlanAccess.canUse(FEATURE_KEYS.AI_ORDER_ASSISTANT).allowed;
  const canUsePythonIntelligence = inventoryPlanAccess.canUse(FEATURE_KEYS.PYTHON_INTELLIGENCE).allowed;
  const [invTab, setInvTab] = useState(initialSubTab || 'count');
  const [focusBelowPar, setFocusBelowPar] = useState(() => sessionStorage.getItem('inventoryFocus') === 'belowPar');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState('Category');
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const isAiOrderTab = invTab === 'ai-order';
  const isInvoiceTab = invTab === 'invoices';
  const isVendorTab = invTab === 'vendors';
  const isWasteTab = invTab === 'waste';
  const isOrderTab = invTab === 'order';
  const isManageTab = invTab === 'manage';
  const inventorySearchActive = Boolean(String(searchTerm || '').trim()) || focusBelowPar;
  const needsInventoryCatalog = canUseBasicInventory || canUseSmartInventory || canUseMenuIntelligence;
  const needsVendorDirectory = invTab === 'count' || isVendorTab || isManageTab || isOrderTab || isInvoiceTab || isAiOrderTab;
  const needsWasteHistory = isWasteTab || isAiOrderTab;
  const needsSmartHistory = isInvoiceTab || isAiOrderTab;
  const needsMenuGraph = isAiOrderTab || focusBelowPar;
  const inventoryLimit = (isManageTab || isOrderTab || isInvoiceTab || isAiOrderTab || isWasteTab || inventorySearchActive) ? 500 : 220;
  const inventoryItems = useLiveCollection('inventoryItems', appUser?.restaurantId, { enabled: needsInventoryCatalog, limitCount: inventoryLimit, fallbackLimitCount: 120 });
  const orderableInventoryItems = inventoryItems.filter(item => !isLikelyInvoiceNoiseInventoryItem(item));
  const menuDependencies = useLiveCollection('menuDependencies', appUser?.restaurantId, { enabled: canUseMenuIntelligence && needsMenuGraph, limitCount: isAiOrderTab ? 500 : 160, fallbackLimitCount: 80 });
  const vendors = useLiveCollection('vendors', appUser?.restaurantId, { enabled: (canUseBasicInventory || canUseSmartInventory) && needsVendorDirectory, limitCount: 150, fallbackLimitCount: 60 });
  const wasteLogs = useLiveCollection('wasteLogs', appUser?.restaurantId, { enabled: canUseBasicInventory && needsWasteHistory, limitCount: isAiOrderTab ? 200 : 80, fallbackLimitCount: 35 });
  const futureEvents = useLiveCollection('events', appUser?.restaurantId, { enabled: canUseAiOrdering && isAiOrderTab, whereClauses: [['date','>=', getToday()]], orderByField: 'date', orderDirection: 'asc', limitCount: 120, fallbackLimitCount: 60 });
  const prepItemsForOrdering = useLiveCollection('prepItems', appUser?.restaurantId, { enabled: canUseAiOrdering && isAiOrderTab, limitCount: 220, fallbackLimitCount: 80 });
  const invoices = useLiveCollection('invoices', appUser?.restaurantId, { enabled: canUseSmartInventory && needsSmartHistory, limitCount: isAiOrderTab ? 120 : 60, fallbackLimitCount: 25 });
  const [viewInvoice, setViewInvoice] = useState(null);

  useEffect(() => {
    if (!initialSubTab) return;
    setInvTab(initialSubTab);
    if (initialSubTab === 'invoices') {
      setTimeout(() => document.getElementById('invoice-scanner-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
    onInitialSubTabConsumed?.();
  }, [initialSubTab]);


  useEffect(() => {
    if (sessionStorage.getItem('inventoryFocus') === 'belowPar') {
      setFocusBelowPar(true);
      setInvTab('count');
      sessionStorage.removeItem('inventoryFocus');
      setTimeout(() => document.getElementById('below-par-focus-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
    if (sessionStorage.getItem('inventoryFocus') === 'aiOrder') {
      sessionStorage.removeItem('inventoryFocus');
      if (canUseAiOrdering) {
        setInvTab('ai-order');
        setTimeout(() => document.getElementById('ai-order-assistant-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } else {
        setInvTab('count');
        addToast?.('Smart Kitchen Required', 'AI assisted ordering starts with the Smart Kitchen plan.');
      }
    }
  }, []);

  // Inventory Form
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState(''); const [newItemCode, setNewItemCode] = useState(''); const [newItemSupplier, setNewItemSupplier] = useState(''); const [newItemPackSize, setNewItemPackSize] = useState('1 CS'); const [newItemYield, setNewItemYield] = useState('1'); const [newItemPrice, setNewItemPrice] = useState(''); 
  const [editItem, setEditItem] = useState(null); 
  const [orderOverrides, setOrderOverrides] = useState({}); 
  const [selectedAiOrderIds, setSelectedAiOrderIds] = useState({}); 
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, vendorId: null, items: [] });
  const [aiOrderDaysAhead, setAiOrderDaysAhead] = useState(7);
  const [aiEventDaysAhead, setAiEventDaysAhead] = useState(14);
  const [pythonOrderIntel, setPythonOrderIntel] = useState(null);
  const [pythonOrderLoading, setPythonOrderLoading] = useState(false);
  const [pythonOrderError, setPythonOrderError] = useState('');
  const [pythonOpsIntel, setPythonOpsIntel] = useState(null);
  const [pythonOpsLoading, setPythonOpsLoading] = useState(false);
  const [pythonOpsError, setPythonOpsError] = useState('');
  const [opsBackupStatus, setOpsBackupStatus] = useState(null);
  
  // Vendor Form
  const [vName, setVName] = useState(''); const [vRep, setVRep] = useState(''); const [vPhone, setVPhone] = useState(''); const [vEmail, setVEmail] = useState(''); const [vDays, setVDays] = useState([]); const [vTime, setVTime] = useState('');
  const [editVendor, setEditVendor] = useState(null);

  // Waste Form States
  const [wItemId, setWItemId] = useState(''); 
  const [wQty, setWQty] = useState(''); 
  const [wReason, setWReason] = useState('Dropped / Spilled');
  const [wMode, setWMode] = useState('count');
  const [wWeightPerStockUnit, setWWeightPerStockUnit] = useState('');
  const [wUnitLabel, setWUnitLabel] = useState('unit');
  const [editWaste, setEditWaste] = useState(null);
  const [wSearchTerm, setWSearchTerm] = useState(''); // Search filter for selecting items to burn
  const [wasteSearch, setWasteSearch] = useState(''); // Search filter for looking up past burn logs

  // AI Invoice Scanner State
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [invoiceScanProgress, setInvoiceScanProgress] = useState({ percent: 0, label: 'Ready', phase: 'idle' });
  const [scannedInvoice, setScannedInvoice] = useState(null);
  const [invoiceReviewTab, setInvoiceReviewTab] = useState('matched');
  const [csvImportReview, setCsvImportReview] = useState(null);
  const [isSavingCsvImport, setIsSavingCsvImport] = useState(false);
  const [invoiceAiUsage, setInvoiceAiUsage] = useState({ invoicePagesUsed: 0, invoicePagesLimit: 40, invoicePagesProcessed: 0, invoiceBypassPagesProcessed: 0 });
  const [invoiceAiUsageLoading, setInvoiceAiUsageLoading] = useState(false);
  const [invoiceAiExempt, setInvoiceAiExempt] = useState(false);
  const invoiceScanBusyRef = useRef(false);

  const loadInvoiceAiUsage = async () => {
    if (!appUser?.restaurantId || !canUseSmartInventory) return;
    setInvoiceAiUsageLoading(true);
    try {
      const response = await secureFetch(`/api/ai-usage?restaurantId=${encodeURIComponent(appUser.restaurantId)}&eventLimit=5`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Could not load AI page usage.');
      setInvoiceAiUsage(payload.usage || { invoicePagesUsed: 0, invoicePagesLimit: 40, invoicePagesProcessed: 0, invoiceBypassPagesProcessed: 0 });
      setInvoiceAiExempt(payload.isExempt === true);
    } catch (error) {
      console.warn('Invoice AI usage could not load:', error?.message || error);
    } finally {
      setInvoiceAiUsageLoading(false);
    }
  };

  useEffect(() => { if (isInvoiceTab) loadInvoiceAiUsage(); }, [appUser?.restaurantId, canUseSmartInventory, isInvoiceTab]);

  useEffect(() => {
    if (invTab === 'invoices' && !canUseSmartInventory) setInvTab('count');
    if (invTab === 'ai-order' && !canUseAiOrdering) setInvTab('count');
  }, [invTab, canUseSmartInventory, canUseAiOrdering]);

  // Master Permission Check for Inventory Tabs
  const hasInvPerms = appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.workspaceOwner || appUser?.permissions?.inventory || appUser?.permissions?.team;
  const opsIntelEnabled = false; // Python Ops Scan now lives in Manager Brief to avoid loading large admin datasets inside Inventory.
  const opsUsers = useLiveCollection('users', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 260, fallbackLimitCount: 80 });
  const opsShifts = useLiveCollection('shifts', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 1200, fallbackLimitCount: 160 });
  const opsTimePunches = useLiveCollection('timePunches', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 650, fallbackLimitCount: 120 });
  const opsTimeOffRequests = useLiveCollection('timeOffRequests', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 350, fallbackLimitCount: 80 });
  const opsAvailabilityRecords = useLiveCollection('availabilityRecords', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 350, fallbackLimitCount: 80 });
  const opsReminders = useLiveCollection('personalReminders', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 600, fallbackLimitCount: 120 });
  const opsTasks = useLiveCollection('tasks', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 600, fallbackLimitCount: 120 });
  const opsMaintenanceLogs = useLiveCollection('maintenanceLogs', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 350, fallbackLimitCount: 80 });
  const opsRecipes = useLiveCollection('recipes', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 240, fallbackLimitCount: 80 });
  const opsAuditLogs = useLiveCollection('auditLogs', appUser?.restaurantId, { enabled: opsIntelEnabled, limitCount: 450, fallbackLimitCount: 80 });

  useEffect(() => {
    if (!opsIntelEnabled) { setOpsBackupStatus(null); return undefined; }
    const unsub = onSnapshot(doc(db, 'system', 'backupStatus'), snap => setOpsBackupStatus(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => setOpsBackupStatus(null));
    return () => unsub();
  }, [opsIntelEnabled]);

  const safeInventoryWrite = ({ quiet = false, ...args } = {}) => safeWriteWithQueue({ user: appUser, addToast: quiet ? null : addToast, ...args });

  // --- LOGIC ---
  const handleAddItem = async (e) => { e.preventDefault(); if (!newItemName.trim() || !newItemSupplier) return addToast('Error', 'Name and Vendor required.'); await safeInventoryWrite({ action: 'add', collectionName: "inventoryItems", label: "Inventory item", data: { name: newItemName.trim(), category: newItemCat || 'Other', pfgCode: newItemCode.trim(), supplierId: newItemSupplier, packSize: newItemPackSize.trim(), yieldQty: parseInt(newItemYield) || 1, price: parseFloat(newItemPrice) || 0, parLevel: 0, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null, restaurantId: appUser.restaurantId } }); setNewItemName(''); setNewItemCode(''); setNewItemPrice(''); setNewItemYield('1'); addToast('Inventory Updated', 'Item cataloged.'); };
  const handleSaveEdit = async (e) => { 
    e.preventDefault(); 
    await safeInventoryWrite({ action: 'update', collectionName: "inventoryItems", docId: editItem.id, label: "Inventory item", before: editItem, data: { 
      name: editItem.name.trim(), 
      category: editItem.category || 'Other', 
      pfgCode: (editItem.pfgCode || '').trim(), 
      supplierId: editItem.supplierId, 
      packSize: editItem.packSize || '', 
      yieldQty: parseFloat(editItem.yieldQty) || 1, 
      weightPerStockUnit: parseFloat(editItem.weightPerStockUnit) || 0,
      burnDefaultMode: editItem.burnDefaultMode || 'count',
      burnUnitLabel: editItem.burnUnitLabel || 'unit',
      price: parseFloat(editItem.price) || 0 
    } }); 
    setEditItem(null); 
    addToast('Item Updated', 'Master file overwritten.'); 
  };
  const updateStock = async (id, newStock) => {
    const item = inventoryItems.find(i => i.id === id);
    const nextStock = Math.max(0, parseFloat(newStock) || 0);
    await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: id, label: "Inventory stock", before: item, data: { currentStock: nextStock } });
    const lastImpactMs = item?.menuImpactAlertedAt ? new Date(item.menuImpactAlertedAt).getTime() : 0;
    const crossedToZero = item && Number(item.currentStock || 0) > 0 && nextStock <= 0 && (!lastImpactMs || Date.now() - lastImpactMs > 12 * 60 * 60 * 1000);
    if (crossedToZero) {
      const impactRows = getZeroStockMenuImpacts([{ ...item, currentStock: 0 }], menuDependencies);
      const impacts = impactRows[0]?.impacts || [];
      if (impacts.length) {
        const impactText = `No longer available from the menu: ${impacts.slice(0, 6).map(i => i.name).join(', ')}${impacts.length > 6 ? ` and ${impacts.length - 6} more` : ''}`;
        await addDoc(collection(db, 'events'), {
          restaurantId: appUser.restaurantId,
          type: 'note',
          category: 'Menu Impact',
          messageCategory: '86 Alert',
          title: `86 ${item.name}`,
          notes: impactText,
          author: appUser.name || appUser.email || 'Inventory',
          date: new Date().toISOString(),
          isImportant: true,
          replies: [],
          source: 'inventory_zero_stock_menu_impact',
          commandCenterAlert: true,
          managerBriefAlert: true,
          kitchenCommandCenterAlert: true,
          menuImpact: impactText,
          menuImpactItems: impacts.map(i => i.name).filter(Boolean),
          menuImpactItemId: item.id,
          inventoryItemName: item.name || '',
          requestedItemName: item.name || '',
          createdAt: new Date().toISOString()
        });
        secureFetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: appUser.restaurantId,
            title: `86 ${item.name}`,
            body: `${item.name} hit 0 stock. ${impactText}.`,
            type: 'message',
            isCritical: true,
            textContent: `86 ${item.name} - ${impactText}`
          })
        }).catch((err) => console.warn('Menu impact push failed:', err?.message || err));
        updateDoc(doc(db, 'inventoryItems', id), { menuImpactAlertedAt: new Date().toISOString() }).catch(() => {});
      }
    }
  };
  const updatePar = async (id, newPar) => await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: id, label: "Inventory par", data: { parLevel: Math.max(0, parseFloat(newPar) || 0) } });
  const handleOrderChange = (id, change, currentQty) => setOrderOverrides(prev => ({ ...prev, [id]: Math.max(0, currentQty + change) }));
  
  const handleAddVendor = async (e) => { e.preventDefault(); if(!vName.trim()) return; await safeInventoryWrite({ action: 'add', collectionName: "vendors", label: "Vendor", data: { name: vName.trim(), rep: vRep.trim(), phone: vPhone.trim(), email: vEmail.trim(), cutOffDays: vDays, cutOffTime: vTime, restaurantId: appUser.restaurantId } }); setVName(''); setVRep(''); setVPhone(''); setVEmail(''); setVDays([]); setVTime(''); addToast('Vendor Added', 'Directory updated.'); };
const handleSaveVendorEdit = async (e) => { e.preventDefault(); await safeInventoryWrite({ action: 'update', collectionName: "vendors", docId: editVendor.id, label: "Vendor", before: editVendor, data: { name: editVendor.name, rep: editVendor.rep, phone: editVendor.phone, email: editVendor.email, cutOffDays: editVendor.cutOffDays || [], cutOffTime: editVendor.cutOffTime || '', ediEndpoint: editVendor.ediEndpoint || '' } }); setEditVendor(null); addToast('Vendor Updated', 'Profile saved.'); };  const toggleVendorDay = (day, isEdit = false) => { if (isEdit) { const d = editVendor.cutOffDays || []; setEditVendor({...editVendor, cutOffDays: d.includes(day) ? d.filter(x=>x!==day) : [...d, day]}); } else { setVDays(vDays.includes(day) ? vDays.filter(x=>x!==day) : [...vDays, day]); } };

const cleanNumber = (value) => {
    const n = parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

const parsePackProfile = (packValue = '') => {
    const pack = String(packValue || '').toLowerCase().replace(/#/g, ' lb ').replace(/\s+/g, ' ').trim();
    const result = { count: 0, weightLbs: 0, notes: [] };
    if (!pack) return result;

    // Count patterns: 24 ct, 24 each, 12/1 ct, 2 x 5 lb, 2/5 lb, 4-10 lb, etc.
    const countMatch = pack.match(/(\d+(?:\.\d+)?)\s*(ct|count|ea|each|pc|pcs|piece|pieces|portion|portions|patty|patties|bottle|bottles|can|cans|bag|bags|pack|pk)\b/i);
    if (countMatch) {
      result.count = Math.max(0, parseFloat(countMatch[1]) || 0);
      result.notes.push(`Count detected: ${result.count}`);
    }

    // Catch-weight style: 2/5 lb, 2 x 5 lb, 4-10 lb, 6 10 oz.
    const comboWeight = pack.match(/(\d+(?:\.\d+)?)\s*(?:\/|x|×|-|by)\s*(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|oz|ounce|ounces)\b/i);
    if (comboWeight) {
      const a = parseFloat(comboWeight[1]) || 0;
      const b = parseFloat(comboWeight[2]) || 0;
      const unit = comboWeight[3] || 'lb';
      const lbs = unit.startsWith('oz') || unit.startsWith('ounce') ? (a * b) / 16 : a * b;
      result.weightLbs = Math.max(result.weightLbs, lbs);
      result.notes.push(`Weight detected: ${lbs.toFixed(2)} lb per stock unit`);
    }

    const singleWeight = pack.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|oz|ounce|ounces)\b/i);
    if (!result.weightLbs && singleWeight) {
      const n = parseFloat(singleWeight[1]) || 0;
      const unit = singleWeight[2] || 'lb';
      const lbs = unit.startsWith('oz') || unit.startsWith('ounce') ? n / 16 : n;
      result.weightLbs = Math.max(0, lbs);
      result.notes.push(`Weight detected: ${lbs.toFixed(2)} lb per stock unit`);
    }

    // Pattern like 12 ct / 8 oz each = 6 lbs total
    const countWeightEach = pack.match(/(\d+(?:\.\d+)?)\s*(ct|count|ea|each).*?(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|lb|lbs)\b/i);
    if (countWeightEach) {
      const c = parseFloat(countWeightEach[1]) || 0;
      const w = parseFloat(countWeightEach[3]) || 0;
      const u = countWeightEach[4] || 'oz';
      const lbs = u.startsWith('oz') || u.startsWith('ounce') ? (c * w) / 16 : c * w;
      if (lbs > result.weightLbs) result.weightLbs = lbs;
      if (!result.count) result.count = c;
      result.notes.push(`Each weight detected: ${c} x ${w} ${u}`);
    }

    return result;
  };

const getBurnUnitsPerStockUnit = (item) => {
    const explicitYield = parseFloat(item?.yieldQty);
    if (Number.isFinite(explicitYield) && explicitYield > 0) return explicitYield;
    const packProfile = parsePackProfile(item?.packSize);
    if (packProfile.count > 0) return packProfile.count;
    return 1;
  };

const getBurnWeightPerStockUnit = (item) => {
    const explicitWeight = parseFloat(item?.weightPerStockUnit);
    if (Number.isFinite(explicitWeight) && explicitWeight > 0) return explicitWeight;
    const packProfile = parsePackProfile(item?.packSize);
    if (packProfile.weightLbs > 0) return packProfile.weightLbs;
    return 0;
  };

const inferBurnModeForItem = (item) => {
    if (!item) return { mode: 'count', unitLabel: 'unit', weightPerStockUnit: '', unitsPerStockUnit: 1, notes: [] };
    const profile = parsePackProfile(item.packSize);
    const explicitMode = item.burnDefaultMode;
    const weight = getBurnWeightPerStockUnit(item);
    const units = getBurnUnitsPerStockUnit(item);
    let mode = explicitMode || 'count';
    if (!explicitMode && weight > 0 && units <= 1) mode = 'weight';
    return {
      mode,
      unitLabel: item.burnUnitLabel || (mode === 'weight' ? 'lb' : 'unit'),
      weightPerStockUnit: weight || '',
      unitsPerStockUnit: units,
      notes: profile.notes || []
    };
  };

const getBurnStockDeduction = (qty, item, options = {}) => {
    const amount = Math.max(0, parseFloat(qty) || 0);
    const mode = options.mode || item?.burnDefaultMode || 'count';
    if (mode === 'recordOnly') return 0;
    if (mode === 'stock') return amount;
    if (mode === 'weight') {
      const weightPerStockUnit = Math.max(0, parseFloat(options.weightPerStockUnit) || getBurnWeightPerStockUnit(item));
      return weightPerStockUnit > 0 ? amount / weightPerStockUnit : amount;
    }
    const unitsPerStockUnit = Math.max(1, parseFloat(options.unitsPerStockUnit) || getBurnUnitsPerStockUnit(item));
    return amount / unitsPerStockUnit;
  };

const handleWasteItemSelect = (itemId) => {
    setWItemId(itemId);
    const item = inventoryItems.find(i => i.id === itemId);
    const inferred = inferBurnModeForItem(item);
    setWMode(inferred.mode || 'count');
    setWWeightPerStockUnit(inferred.weightPerStockUnit ? String(inferred.weightPerStockUnit) : '');
    setWUnitLabel(inferred.unitLabel || 'unit');
  };

const handleLogWaste = async (e) => {
    e.preventDefault(); 
    if(!wItemId || !wQty) return; 
    
    const item = inventoryItems.find(i => i.id === wItemId); 
    if(!item) return;

    const burnAmount = Math.max(0, parseFloat(wQty) || 0); 
    if (burnAmount <= 0) return addToast('Missing Qty', 'Enter how much was wasted.');

    const mode = wMode || 'count';
    const unitsPerStockUnit = getBurnUnitsPerStockUnit(item);
    const weightPerStockUnit = mode === 'weight' ? Math.max(0, parseFloat(wWeightPerStockUnit) || getBurnWeightPerStockUnit(item)) : getBurnWeightPerStockUnit(item);
    if (mode === 'weight' && weightPerStockUnit <= 0) return addToast('Weight Needed', 'Enter how many pounds are in one stock unit/case before logging a weight burn.');

    const stockDeduction = getBurnStockDeduction(burnAmount, item, { mode, unitsPerStockUnit, weightPerStockUnit }); 
    const pricePerStockUnit = parseFloat(item.price) || 0;
    const totalCostLost = pricePerStockUnit * stockDeduction;
    const unitLabel = mode === 'weight' ? 'lb' : mode === 'stock' ? 'stock unit' : (wUnitLabel || item.burnUnitLabel || 'unit');

    await safeInventoryWrite({ action: 'add', collectionName: "wasteLogs", label: "Waste log", data: { 
      itemId: item.id, 
      itemName: item.name, 
      qty: burnAmount, 
      burnAmount,
      burnUnitLabel: unitLabel,
      burnMode: mode,
      costLost: totalCostLost,
      stockDeducted: stockDeduction,
      unitsPerStockUnit,
      weightPerStockUnit,
      burnQtyMode: mode === 'count' ? 'individual_units' : mode, 
      reason: wReason, 
      loggedBy: appUser.name, 
      date: getToday(), 
      timestamp: new Date().toISOString(), 
      restaurantId: appUser.restaurantId 
    } });

    if (stockDeduction > 0) {
      await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: item.id, label: "Waste stock deduction", before: item, data: { 
        currentStock: Math.max(0, (parseFloat(item.currentStock) || 0) - stockDeduction),
        ...(mode === 'weight' && weightPerStockUnit > 0 ? { weightPerStockUnit } : {}),
        ...(mode ? { burnDefaultMode: mode } : {})
      } });
    }

    setWItemId(''); setWQty(''); setWSearchTerm(''); setWMode('count'); setWWeightPerStockUnit(''); setWUnitLabel('unit');
    const deductedText = stockDeduction > 0 ? `${stockDeduction.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')} stock unit${stockDeduction === 1 ? '' : 's'}` : 'no stock';
    addToast('Burn Logged', `$${totalCostLost.toFixed(2)} logged. ${burnAmount} ${unitLabel}${burnAmount === 1 ? '' : 's'} deducted as ${deductedText}.`);
  };

  const handleDeleteWaste = async (log) => {
    if (!window.confirm(`Delete burn log for ${log.itemName} and restore stock?`)) return;
    const item = inventoryItems.find(i => i.id === log.itemId);
    if (item) {
       const stockRestoration = parseFloat(log.stockDeducted) || getBurnStockDeduction(log.qty, item, { mode: log.burnMode, weightPerStockUnit: log.weightPerStockUnit, unitsPerStockUnit: log.unitsPerStockUnit });
       if (stockRestoration > 0) await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: item.id, label: "Waste stock restore", before: item, data: { currentStock: Math.max(0, (parseFloat(item.currentStock)||0) + stockRestoration) } });
    }
    await safeInventoryWrite({ action: "delete", collectionName: "wasteLogs", docId: log.id, label: "Waste log", before: log });
    addToast('Log Deleted', 'Stock restored successfully.');
  };

 const handleSaveWasteEdit = async (e) => {
    e.preventDefault();
    const log = editWaste;
    const item = inventoryItems.find(i => i.id === log.itemId);
    
    if (item) {
       const originalLog = wasteLogs.find(w => w.id === log.id);
       const oldQty = parseFloat(originalLog.qty) || 0;
       const newQty = parseFloat(log.qty) || 0;
       const mode = originalLog?.burnMode || log.burnMode || 'count';
       const unitsPerStockUnit = parseFloat(originalLog?.unitsPerStockUnit) || getBurnUnitsPerStockUnit(item);
       const weightPerStockUnit = parseFloat(originalLog?.weightPerStockUnit) || getBurnWeightPerStockUnit(item);

       const oldDeduction = parseFloat(originalLog?.stockDeducted) || getBurnStockDeduction(oldQty, item, { mode, unitsPerStockUnit, weightPerStockUnit });
       const newDeduction = getBurnStockDeduction(newQty, item, { mode, unitsPerStockUnit, weightPerStockUnit });
       const stockDifference = newDeduction - oldDeduction; 
       const newCostLost = (parseFloat(item.price) || 0) * newDeduction;

       if (stockDifference !== 0) await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: item.id, label: "Waste edit stock adjustment", before: item, data: { 
         currentStock: Math.max(0, (parseFloat(item.currentStock) || 0) - stockDifference) 
       } });
       await safeInventoryWrite({ action: "update", collectionName: "wasteLogs", docId: log.id, label: "Waste log edit", before: log, data: { 
         qty: newQty, 
         burnAmount: newQty,
         reason: log.reason, 
         costLost: newCostLost,
         stockDeducted: newDeduction,
         unitsPerStockUnit,
         weightPerStockUnit,
         burnMode: mode,
         burnQtyMode: mode === 'count' ? 'individual_units' : mode 
       } });
    } else {
       await safeInventoryWrite({ action: "update", collectionName: "wasteLogs", docId: log.id, label: "Waste log edit", before: log, data: { qty: log.qty, reason: log.reason } });
    }
    
    setEditWaste(null);
    addToast('Log Updated', 'Burn log and stock adjusted.');
  };

  const itemsToOrder = inventoryItems.filter(i => { const override = orderOverrides[i.id]; return override !== undefined ? override > 0 : (i.currentStock || 0) < (i.parLevel || 0); });
  const vendorsWithDeficits = vendors.filter(v => itemsToOrder.some(i => i.supplierId === v.id));
  const pendingVendors = vendors.filter(v => inventoryItems.some(i => i.supplierId === v.id && (i.pendingQty || 0) > 0));
  const aiOrderAssistant = (isAiOrderTab && canUseAiOrdering) ? buildAiOrderAssistant({ inventoryItems: orderableInventoryItems, vendors, wasteLogs, invoices, events: futureEvents, prepItems: prepItemsForOrdering, menuDependencies, currentDate: getToday(), daysAhead: aiOrderDaysAhead, eventDaysAhead: aiEventDaysAhead }) : EMPTY_AI_ORDER_ASSISTANT;
  const aiOrderSummaryText = summarizeAiOrderAssistant(aiOrderAssistant);
  const aiOrderRecommendations = aiOrderAssistant.recommendations || [];
  const aiSuggestedRows = aiOrderRecommendations.filter(row => Number(row.suggestedQty || 0) > 0 && (row.itemId || row.itemName));
  const selectedAiSuggestionRows = aiSuggestedRows.filter(row => selectedAiOrderIds[row.itemId || row.itemName]);
  const allVisibleAiSuggestionsSelected = aiSuggestedRows.length > 0 && aiSuggestedRows.every(row => selectedAiOrderIds[row.itemId || row.itemName]);
  const aiOrderDraftGroups = aiOrderAssistant.vendorDrafts || [];
  const pythonForecastRows = pythonOrderIntel?.orderForecasts || [];
  const pythonManagerBrief = pythonOrderIntel?.managerBrief || [];
  const pythonSummary = pythonOrderIntel?.summary || null;
  const pythonOpsSummary = pythonOpsIntel?.summary || null;
  const pythonOpsBrief = pythonOpsIntel?.managerBrief || [];
  const pythonOpsHealthRows = pythonOpsIntel?.dataHealth || [];
  const pythonOpsLaborRows = pythonOpsIntel?.laborScheduleWarnings || [];
  const pythonOpsMenuRows = pythonOpsIntel?.menuCosting || [];

  const handleReviewOrder = (vendorId) => {
    const list = itemsToOrder.filter(i => i.supplierId === vendorId).map(item => { const deficit = Math.max(0, (item.parLevel||0) - (item.currentStock||0)); const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.ceil(deficit); return { ...item, orderQty: qty }; }).filter(i => i.orderQty > 0);
    if (list.length === 0) return addToast('Order Empty', `No deficits for this vendor.`);
    setConfirmModal({ isOpen: true, vendorId, items: list });
  };

  const handleReviewAiOrder = (group) => {
    const list = (group?.items || []).map(row => ({ ...(row.item || {}), id: row.itemId || row.item?.id, orderQty: Math.max(1, Number(row.suggestedQty || 0)), aiReasons: row.reasons || [], aiPriority: row.priority, aiEstimatedCost: row.estimatedCost }));
    if (!list.length) return addToast('Order Empty', 'No AI suggestions for that vendor.');
    setConfirmModal({ isOpen: true, vendorId: group.vendorId || list[0]?.supplierId || '', items: list });
  };

  const isAiSuggestionApplied = (row = {}) => {
    if (!row.itemId) return false;
    const suggested = Math.max(0, Number(row.suggestedQty || 0));
    return Number(orderOverrides[row.itemId] || 0) === suggested && suggested > 0;
  };

  const applyAiOrderRows = (rows = [], { openOrderScreen = false, label = 'suggested' } = {}) => {
    const next = {};
    rows.filter(row => row?.itemId && Number(row.suggestedQty || 0) > 0).forEach(row => {
      next[row.itemId] = Math.max(0, Number(row.suggestedQty || 0));
    });
    const count = Object.keys(next).length;
    if (!count) return addToast('AI Draft Empty', 'No suggested quantities were selected.');
    setOrderOverrides(prev => ({ ...prev, ...next }));
    if (openOrderScreen) setInvTab('order');
    addToast('AI Draft Updated', `${count} ${label} order ${count === 1 ? 'quantity was' : 'quantities were'} loaded for manager review.`);
  };

  const applyAiOrderOverrides = () => applyAiOrderRows(aiSuggestedRows, { openOrderScreen: true, label: 'AI-suggested' });

  const applySelectedAiOrderOverrides = () => {
    applyAiOrderRows(selectedAiSuggestionRows, { openOrderScreen: false, label: 'selected' });
  };

  const toggleAiOrderSelection = (row = {}) => {
    const key = row.itemId || row.itemName;
    if (!key) return;
    setSelectedAiOrderIds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllAiOrderSelections = () => {
    if (allVisibleAiSuggestionsSelected) return setSelectedAiOrderIds({});
    const next = {};
    aiSuggestedRows.forEach(row => { next[row.itemId || row.itemName] = true; });
    setSelectedAiOrderIds(next);
  };

  const undoAiSuggestedQty = (row = {}) => {
    if (!row.itemId) return;
    setOrderOverrides(prev => {
      const next = { ...prev };
      delete next[row.itemId];
      return next;
    });
    addToast('Suggested Qty Removed', `${row.itemName || 'Item'} was removed from the draft quantity overrides.`);
  };

  const copyAiOrderDraft = async () => {
    const text = formatAiOrderDraftText(aiOrderAssistant);
    if (!text) return addToast('Draft Empty', 'No AI order draft is ready yet.');
    try { await navigator.clipboard.writeText(text); addToast('AI Draft Copied', 'Order draft copied for review.'); }
    catch (err) { addToast('Copy Failed', 'Your browser blocked clipboard access.'); }
  };

  const saveAiOrderDraft = async () => {
    const items = aiOrderRecommendations.filter(row => row.suggestedQty > 0).map(row => ({
      itemId: row.itemId, itemName: row.itemName, vendorId: row.vendorId, vendorName: row.vendorName, qty: row.suggestedQty, packSize: row.packSize || '', estimatedCost: row.estimatedCost || 0, priority: row.priority, reasons: row.reasons || []
    }));
    if (!items.length) return addToast('Draft Empty', 'No suggested order items to save.');
    await safeInventoryWrite({ action: 'add', collectionName: 'orders', label: 'AI order draft', data: {
      restaurantId: appUser.restaurantId, workspaceId: appUser.restaurantId, status: 'draft', source: 'ai_order_assistant', title: `AI Order Draft ${getToday()}`, date: getToday(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: appUser.id || '', createdByName: appUser.name || appUser.email || '', items, vendorDrafts: aiOrderDraftGroups.map(group => ({ vendorId: group.vendorId, vendorName: group.vendorName, total: group.total, itemCount: group.items.length })), summary: aiOrderSummaryText, managerBrief: aiOrderAssistant.managerBrief || [], eventNeeds: (aiOrderAssistant.eventNeeds || []).slice(0, 10).map(row => ({ eventId: row.event.id || '', eventTitle: row.event.title || '', date: row.date, itemNames: row.items.map(i => i.itemName).slice(0, 8) })), priceWarnings: (aiOrderAssistant.priceWarnings || []).slice(0, 20), pythonIntelligence: pythonOrderIntel ? { generatedAt: pythonOrderIntel.generatedAt, summary: pythonOrderIntel.summary || {}, managerBrief: pythonOrderIntel.managerBrief || [], topForecasts: (pythonOrderIntel.orderForecasts || []).slice(0, 20), priceTrends: (pythonOrderIntel.priceTrends || []).slice(0, 20), parRecommendations: (pythonOrderIntel.parRecommendations || []).slice(0, 20), wasteInsights: (pythonOrderIntel.wasteInsights || []).slice(0, 20), eventSupplyPlan: (pythonOrderIntel.eventSupplyPlan || []).slice(0, 30) } : null
    } });
    addToast('AI Draft Saved', 'Saved to Orders as a draft. Review before sending to vendors.');
  };

  const runPythonOrderIntelligence = async () => {
    if (!appUser?.restaurantId) return addToast('Missing Workspace', 'Choose a workspace before running Python order intelligence.');
    setPythonOrderLoading(true);
    setPythonOrderError('');
    try {
      const response = await secureFetch('/api/python-order-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          currentDate: getToday(),
          daysAhead: aiOrderDaysAhead,
          eventDaysAhead: aiEventDaysAhead,
          inventoryItems, vendors, wasteLogs, invoices, events: futureEvents, prepItems: prepItemsForOrdering, menuDependencies
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Python order intelligence failed.');
      setPythonOrderIntel(payload);
      addToast('Python Forecast Ready', `${payload?.summary?.forecastCount || 0} forecasts, ${payload?.summary?.priceWarningCount || 0} price warnings, ${payload?.summary?.eventSupplyCount || 0} event supply signals.`);
    } catch (error) {
      const message = error?.message || 'Python order intelligence is unavailable.';
      setPythonOrderError(message);
      addToast('Python Forecast Unavailable', `${message} The normal AI Order Assistant is still available.`);
    } finally {
      setPythonOrderLoading(false);
    }
  };

  const runPythonOpsIntelligence = async () => {
    if (!appUser?.restaurantId) return addToast('Missing Workspace', 'Choose a workspace before running Python Ops Intelligence.');
    setPythonOpsLoading(true);
    setPythonOpsError('');
    try {
      const response = await secureFetch('/api/python-ops-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          currentDate: getToday(),
          daysAhead: aiOrderDaysAhead,
          inventoryItems, vendors, wasteLogs, invoices, events: futureEvents, prepItems: prepItemsForOrdering, menuDependencies,
          recipes: opsRecipes, users: opsUsers, shifts: opsShifts, timePunches: opsTimePunches, timeOffRequests: opsTimeOffRequests,
          availabilityRecords: opsAvailabilityRecords, reminders: opsReminders, tasks: opsTasks, maintenanceLogs: opsMaintenanceLogs, auditLogs: opsAuditLogs,
          backupStatus: opsBackupStatus || {}
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(readableApiError(payload?.error || payload?.message || payload) || 'Python Ops Intelligence failed.');
      setPythonOpsIntel(payload);
      addToast('Python Ops Scan Ready', `${payload?.summary?.dataHealthCount || 0} data issues, ${payload?.summary?.laborWarningCount || 0} labor warnings, ${payload?.summary?.menuCostCount || 0} menu cost checks.`);
    } catch (error) {
      const message = error?.message || 'Python Ops Intelligence is unavailable.';
      setPythonOpsError(message);
      addToast('Python Ops Scan Unavailable', `${message} The normal AI Order Assistant is still available.`);
    } finally {
      setPythonOpsLoading(false);
    }
  };

  const copyPythonOpsReport = async (format = 'text') => {
    const value = format === 'csv' ? pythonOpsIntel?.reports?.csv : pythonOpsIntel?.reports?.text;
    if (!value) return addToast('No Report Ready', 'Run Python Ops Scan before copying a report.');
    try { await navigator.clipboard.writeText(value); addToast(format === 'csv' ? 'CSV Report Copied' : 'Ops Report Copied', 'Paste it into a document, email, or spreadsheet for review.'); }
    catch (err) { addToast('Copy Failed', 'Your browser blocked clipboard access.'); }
  };

const executeOrder = async (method) => {
    const { vendorId, items } = confirmModal; const vendor = vendors.find(v => v.id === vendorId);
    
    let bodyText = items.map(i => `${i.orderQty}x ${i.pfgCode ? `[${i.pfgCode}] ` : ''}${i.name} (${i.packSize})`).join('%0D%0A');
    let fullText = `Order via 86chaos%0D%0A%0D%0A${bodyText}`;

    // UNIVERSAL FAILSAFE: Always copy to clipboard in the background just in case
    try { await navigator.clipboard.writeText(decodeURIComponent(fullText)); } catch (e) { console.log(e); }

    if (method === 'csv') {
      const rows = [['Qty','Code','Name','Pack Size'], ...items.map(i => [i.orderQty, i.pfgCode || '', i.name, i.packSize || ''])];
      const filename = `${getRestaurantExportPrefix(appUser)}-Order-${safeFilenamePart(vendor?.name || 'Vendor')}-${getToday()}.csv`;
      downloadCsvRows(filename, rows);
      addToast('Exported', 'Order downloaded with the restaurant name in the filename.');
    } else if (method === 'email') {
      const subject = `${appUser?.restaurantName || 'Restaurant'} Order`;
      const emailUrl = `mailto:${vendor?.email||''}?subject=${encodeURIComponent(subject)}&body=${fullText}`;
      if (emailUrl.length > 2000) { addToast('📋 Order Copied!', 'List is huge! We opened email, just tap and PASTE.'); window.location.href = `mailto:${vendor?.email||''}?subject=${encodeURIComponent(subject + ' (Paste From Clipboard)')}`; } 
      else { window.location.href = emailUrl; }
    } else if (method === 'sms') {
      const smsUrl = `sms:${vendor?.phone||''}?body=${fullText}`;
      if (smsUrl.length > 2000) { addToast('📋 Order Copied!', 'List is huge! We opened SMS, just tap and PASTE.'); window.location.href = `sms:${vendor?.phone||''}`; } 
      else { window.location.href = smsUrl; }
    } else if (method === 'edi') {
      
      // 1. Check for Endpoint
      if (!vendor?.ediEndpoint) {
        return addToast('Missing Config', 'Please add an EDI API Webhook URL in the Vendor Settings first.');
      }
      
      addToast('Transmitting', `Establishing secure handshake with ${vendor.name}...`);
      
      // 2. Compile Machine-Readable Payload
      const ediPayload = {
        restaurantId: appUser.restaurantId,
        timestamp: new Date().toISOString(),
        items: items.map(i => ({ sku: i.pfgCode || 'UNKNOWN', quantity: i.orderQty, packSize: i.packSize }))
      };

      // 3. Transmit (Currently simulating the API call)
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(`[EDI SIMULATION] Payload sent to ${vendor.ediEndpoint}:`, ediPayload);
        addToast('EDI Success', `Order securely injected into ${vendor.name}'s system.`);
      } catch (err) {
        addToast('EDI Failure', 'Connection timed out. Retrying...');
        return; // Abort stock updates on failure so the user can try again
      }

    } else {
      addToast('Copied', 'Order list copied to clipboard!');
    }
    
    // Update Pending Stock
    for (const item of items) { await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: item.id, label: "Pending order", before: item, data: { pendingQty: item.orderQty, lastOrderedQty: item.orderQty, lastOrderedDate: getToday() } }); }
    setOrderOverrides({}); setConfirmModal({ isOpen: false, vendorId: null, items: [] });
  };

  const handleReceiveDelivery = async (vendorId) => {
    const itemsToReceive = inventoryItems.filter(i => i.supplierId === vendorId && (i.pendingQty || 0) > 0);
    for (const item of itemsToReceive) {
      await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: item.id, label: "Delivery received", before: item, data: { currentStock: (parseFloat(item.currentStock) || 0) + (parseFloat(item.pendingQty) || 0), pendingQty: 0 } });
    }
    addToast('Delivery Accepted', `Stock automatically updated for ${itemsToReceive.length} items.`);
  };

  const handleUpdatePendingQty = async (itemId, newQty) => {
    await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: itemId, label: "Pending quantity", data: { pendingQty: Math.max(0, parseInt(newQty) || 0) } });
  };

  const handleCancelDelivery = async (vendorId) => {
    if (!window.confirm("Cancel this dispatched order? This will clear all pending incoming stock for this vendor.")) return;
    const itemsToCancel = inventoryItems.filter(i => i.supplierId === vendorId && (i.pendingQty || 0) > 0);
    for (const item of itemsToCancel) {
      await safeInventoryWrite({ action: "update", collectionName: "inventoryItems", docId: item.id, label: "Cancel pending delivery", before: item, data: { pendingQty: 0 } });
    }
    addToast('Order Canceled', 'Pending quantities cleared.');
  };

  // --- CSV INVENTORY UPLOAD + CLEANUP REVIEW ---
  const parseCsvColumns = (line = '') => line.split(/(?!\B"[^"]*),(?![^"]*"\B)/).map(c => c.trim().replace(/^"|"$/g, ''));
  const normalizeImportKey = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const buildCsvImportReview = (text = '', fileName = 'inventory.csv') => {
    const rows = text.split(/\r?\n/).filter(row => row.trim());
    const seen = new Set();
    const parsedRows = [];
    const issues = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = parseCsvColumns(rows[i]);
      const name = (cols[0] || '').trim();
      if (!name) { issues.push(`Row ${i + 1}: missing item name`); continue; }
      const productCode = (cols[2] || '').trim();
      const nameKey = normalizeImportKey(name);
      const codeKey = normalizeImportKey(productCode);
      const duplicateInFile = seen.has(codeKey || nameKey);
      seen.add(codeKey || nameKey);
      const existing = inventoryItems.find(item => (codeKey && normalizeImportKey(item.pfgCode || item.productCode || item.sku) === codeKey) || normalizeImportKey(item.name) === nameKey);
      const vendorName = (cols[6] || 'Unassigned Vendor').trim();
      parsedRows.push({
        rowNumber: i + 1,
        name,
        category: cols[1] || 'Other',
        pfgCode: productCode,
        packSize: cols[3] || '1 CS',
        yieldQty: parseFloat(cols[4]) || 1,
        price: parseFloat(cols[5]) || 0,
        vendorName,
        existingId: existing?.id || '',
        existingName: existing?.name || '',
        duplicateInFile,
        action: duplicateInFile ? 'skip' : (existing ? 'update' : 'create')
      });
    }
    const createCount = parsedRows.filter(r => r.action === 'create').length;
    const updateCount = parsedRows.filter(r => r.action === 'update').length;
    const skipCount = parsedRows.filter(r => r.action === 'skip').length;
    return { fileName, rows: parsedRows, issues, createCount, updateCount, skipCount, createdAt: new Date().toISOString() };
  };
  const updateCsvReviewRow = (idx, patch) => setCsvImportReview(review => review ? { ...review, rows: review.rows.map((row, rowIdx) => rowIdx === idx ? { ...row, ...patch } : row) } : review);
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const review = buildCsvImportReview(event.target.result || '', file.name);
        if (!review.rows.length) return addToast('Import Review Empty', 'No usable inventory rows were found in that CSV.');
        setCsvImportReview(review);
        addToast('Import Review Ready', `${review.rows.length} row(s) ready for cleanup review before saving.`);
      } catch (err) {
        addToast('Import Review Failed', err.message || 'Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const approveCsvImport = async () => {
    if (!csvImportReview?.rows?.length) return;
    setIsSavingCsvImport(true);
    try {
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const vendorCache = new Map(vendors.map(v => [String(v.name || '').toLowerCase(), v.id]));
      for (const row of csvImportReview.rows) {
        if (row.action === 'skip') { skipped++; continue; }
        const vendorKey = String(row.vendorName || 'Unassigned Vendor').toLowerCase();
        let vId = vendorCache.get(vendorKey) || '';
        if (!vId) {
          const newVRef = await safeInventoryWrite({ quiet: true, action: 'add', collectionName: 'vendors', label: 'CSV vendor', data: { name: row.vendorName || 'Unassigned Vendor', rep: '', email: '', phone: '', restaurantId: appUser.restaurantId, source: 'csv-import-review' } });
          vId = newVRef?.id || '';
          vendorCache.set(vendorKey, vId);
        }
        const payload = { name: row.name, category: row.category || 'Other', pfgCode: row.pfgCode || '', packSize: row.packSize || '1 CS', yieldQty: parseFloat(row.yieldQty) || 1, price: parseFloat(row.price) || 0, supplierId: vId, importReviewedAt: new Date().toISOString(), importSourceFile: csvImportReview.fileName };
        if (row.action === 'update' && row.existingId) {
          const before = inventoryItems.find(item => item.id === row.existingId) || null;
          await safeInventoryWrite({ quiet: true, action: 'update', collectionName: 'inventoryItems', docId: row.existingId, label: 'CSV inventory cleanup update', before, data: payload });
          updated++;
        } else if (row.action === 'create') {
          await safeInventoryWrite({ quiet: true, action: 'add', collectionName: 'inventoryItems', label: 'CSV inventory cleanup item', data: { ...payload, parLevel: 0, lastOrderedQty: 0, lastOrderedDate: null, currentStock: 0, pendingQty: 0, isStarred: false, restaurantId: appUser.restaurantId } });
          created++;
        } else {
          skipped++;
        }
      }
      setCsvImportReview(null);
      addToast('Import Saved', `${created} created, ${updated} updated, ${skipped} skipped.`);
    } catch (err) {
      addToast('Import Save Failed', err.message || 'Could not save reviewed CSV import.');
    } finally {
      setIsSavingCsvImport(false);
    }
  };

// --- INVOICE SCANNER (PDF + HIGH-DETAIL IMAGE SCAN) ---
  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const compressImageForScan = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let maxWidth = 2400;
        let quality = 0.92;
        const draw = () => {
          const scaleSize = img.width > maxWidth ? maxWidth / img.width : 1;
          canvas.width = Math.round(img.width * scaleSize);
          canvas.height = Math.round(img.height * scaleSize);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', quality).split(',')[1];
        };
        let base64 = draw();
        // Stay under Vercel's practical JSON body limit while keeping enough detail for line-item OCR.
        while (base64.length > 3_700_000 && (quality > 0.62 || maxWidth > 1500)) {
          if (quality > 0.62) quality -= 0.08;
          else maxWidth -= 250;
          base64 = draw();
        }
        resolve({ base64, mimeType: 'image/jpeg', scanDetail: { maxWidth, quality: Number(quality.toFixed(2)) } });
      };
      img.onerror = () => reject(new Error('Could not read image. Try a clearer photo or PDF.'));
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });


  const updateInvoiceProgress = (percent, label, phase = 'working') => {
    const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    setInvoiceScanProgress({ percent: safePercent, label, phase });
  };

  const scanFileViaStorage = async (file, onProgress = () => {}, originalFile = file, compression = {}) => {
    const ext = (file.name.split('.').pop() || 'upload').toLowerCase().replace(/[^a-z0-9]/g, '') || 'upload';
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const restaurantId = appUser?.restaurantId || 'unknown-restaurant';
    const storagePath = `${restaurantId}/invoices/scans/${safeName}`;
    const fileRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, file, {
      contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
      customMetadata: {
        originalName: originalFile?.name || file.name,
        uploadedName: file.name,
        originalBytes: String(originalFile?.size || file.size || 0),
        uploadedBytes: String(file.size || 0),
        compressionMethod: compression?.method || 'none',
        compressed: compression?.wasCompressed ? 'true' : 'false',
        restaurantId,
        uploadedBy: appUser?.id || '',
        uploadedByName: appUser?.name || '',
        purpose: 'invoice-scan'
      }
    });

    await new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const uploadPercent = snapshot.totalBytes ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
          onProgress({ uploadPercent, bytesTransferred: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes });
        },
        reject,
        resolve
      );
    });

    const downloadUrl = await getDownloadURL(fileRef);
    return {
      storagePath,
      downloadUrl,
      mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
      fileName: originalFile?.name || file.name,
      uploadedFileName: file.name,
      restaurantId,
      originalSize: originalFile?.size || file.size,
      uploadedSize: file.size,
      compression
    };
  };

  const handleScanInvoice = async (e) => {
    if (!canUseSmartInventory) {
      e.target.value = '';
      addToast('Smart Kitchen Required', 'Invoice scanning starts with Smart Kitchen. Ask an owner or System Administrator to review Plan & Billing.');
      return;
    }
    if (invoiceScanBusyRef.current) return;
    const file = e.target.files?.[0];
    if (!file) return;
    invoiceScanBusyRef.current = true;

    let requestedPages = 0;
    try {
      requestedPages = await resolveClientScanPageCount(file);
    } catch (pageError) {
      addToast('Cannot Count PDF Pages', pageError.message || 'The page count could not be verified safely.');
      invoiceScanBusyRef.current = false;
      e.target.value = '';
      return;
    }
    const currentUsage = normalizeAiUsage(invoiceAiUsage, 'invoice');
    if (!invoiceAiExempt && requestedPages > currentUsage.remaining) {
      addToast('Invoice AI Page Limit', aiPageLimitMessage('invoice', invoiceAiUsage, requestedPages));
      invoiceScanBusyRef.current = false;
      e.target.value = '';
      return;
    }

    const idempotencyKey = createAiScanIdempotencyKey('invoice', appUser?.restaurantId);
    const maxBytes = 20 * 1024 * 1024;
    setIsScanningInvoice(true);
    setScannedInvoice(null);
    updateInvoiceProgress(2, 'Preparing invoice file...', 'prepare');

    let timeoutId = null;
    let aiPulseId = null;
    const controller = new AbortController();

    try {
      const prepared = await prepareScannerUploadFile(file, {
        label: 'Invoice file',
        maxBytes,
        imageCompressAboveBytes: 6 * 1024 * 1024,
        targetImageBytes: 9 * 1024 * 1024,
        maxImageDimension: 2800,
        onProgress: info => updateInvoiceProgress(Math.max(2, Math.min(42, info.percent || 8)), info.detail || info.label || 'Preparing invoice file...', 'compress')
      });
      const uploadFile = prepared.file;
      const isPdf = isPdfFile(uploadFile);
      if (prepared.wasCompressed) addToast('Invoice Compressed', `${prepared.displaySizeBefore} → ${prepared.displaySizeAfter}. Scanning the smaller copy.`);
      addToast('Scanning Invoice', isPdf ? 'Uploading PDF, then sending it to the invoice scanner...' : 'Uploading photo, then sending it to the invoice scanner...');

      // Upload the prepared file directly to Firebase Storage first. Photos may be an automatically
      // compressed copy, and PDFs get a best-effort compaction pass before upload.
      // The progress bar is actual Firebase upload progress for this stage.
      const payload = await scanFileViaStorage(uploadFile, ({ uploadPercent, bytesTransferred, totalBytes }) => {
        const uiPercent = 42 + Math.round((uploadPercent / 100) * 20);
        const mbDone = (bytesTransferred / (1024 * 1024)).toFixed(1);
        const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
        updateInvoiceProgress(uiPercent, `Uploading invoice: ${Math.round(uploadPercent)}% (${mbDone}/${mbTotal} MB)`, 'upload');
      }, file, prepared.compression);

      updateInvoiceProgress(63, 'Upload complete. Handing large document to AI file processor...', 'ai');
      const startedAt = Date.now();
      aiPulseId = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const waitPercent = Math.min(90, 66 + Math.floor(elapsedSeconds / 4));
        updateInvoiceProgress(waitPercent, `AI scanner is reading the full invoice document... ${elapsedSeconds}s`, 'ai');
      }, 2000);

      timeoutId = window.setTimeout(() => controller.abort(), 320000);
      const response = await secureFetch('/api/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey }),
        signal: controller.signal
      });

      if (aiPulseId) window.clearInterval(aiPulseId);
      if (timeoutId) window.clearTimeout(timeoutId);
      updateInvoiceProgress(92, 'Scanner finished. Building review screen...', 'reconcile');

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         throw new Error("Invoice scanner returned a non-JSON response. Try a smaller invoice or check the Vercel function logs.");
      }

      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'AI_PAGE_LIMIT_REACHED') {
          setInvoiceAiUsage(previous => ({ ...previous, invoicePagesUsed: data.used, invoicePagesLimit: data.limit }));
          throw new Error(`This restaurant has used all invoice AI pages for ${data.monthKey}. Used ${data.used} of ${data.limit}; ${data.remaining} remain.`);
        }
        if (data.code === 'AI_SCAN_ALREADY_SUBMITTED') throw new Error('This invoice scan was already submitted. Wait for the first request to finish before trying again.');
        throw new Error(data.error || data.details || 'Failed to scan invoice.');
      }
      if (data.aiUsage) {
        setInvoiceAiUsage(previous => ({ ...previous, invoicePagesUsed: data.aiUsage.usedAfter, invoicePagesLimit: data.aiUsage.limit, invoicePagesProcessed: data.aiUsage.processedAfter ?? Math.max(Number(previous.invoicePagesProcessed || 0), Number(data.aiUsage.usedAfter || 0)), invoiceBypassPagesProcessed: data.aiUsage.bypassPagesAfter ?? Number(previous.invoiceBypassPagesProcessed || 0) }));
      }

      const fullRows = Array.isArray(data.allExtractedRows) ? data.allExtractedRows : (Array.isArray(data.invoiceRows) ? data.invoiceRows : []);
      const modelRows = Array.isArray(data.lineItems) ? data.lineItems : [];
      const sourceRows = [...modelRows, ...fullRows];

      const prepareReviewRow = (sourceItem, rowIndex) => {
        const inferred = inferInvoiceProductFields(sourceItem);
        const classification = classifyInvoiceRow(inferred);
        const itemName = inferred.itemName || inferred.description || inferred.name || inferred.rawText || `Invoice Row ${rowIndex + 1}`;
        const incomingCode = inferred.productCode || inferred.sku || inferred.itemNumber || inferred.pfgCode || inferred.code || inferred.itemCode || '';
        const skuKey = normalizeSku(incomingCode);
        const nameKey = normalizeName(itemName);
        const isInventoryLine = ['stock', 'non_food'].includes(classification.kind);
        const matchByCode = isInventoryLine && skuKey ? inventoryItems.find(inv => normalizeSku(inv.pfgCode) === skuKey) : null;
        const matchByName = isInventoryLine ? inventoryItems.find(inv => normalizeName(inv.name) === nameKey || (nameKey && normalizeName(inv.name).includes(nameKey)) || (normalizeName(inv.name) && nameKey.includes(normalizeName(inv.name)))) : null;
        const match = matchByCode || matchByName;
        return {
          ...inferred,
          ...classification.row,
          itemName,
          productCode: incomingCode,
          quantity: inferred.quantity ?? inferred.qty ?? inferred.shippedQty ?? inferred.receivedQty ?? '',
          packSize: inferred.packSize || inferred.pack || inferred.size || inferred.uom || '',
          unitPrice: inferred.unitPrice ?? inferred.priceEach ?? inferred.casePrice ?? '',
          totalPrice: inferred.totalPrice ?? inferred.extendedPrice ?? inferred.lineTotal ?? '',
          rowType: String(inferred.rowType || inferred.lineType || inferred.type || 'item').toLowerCase(),
          rawText: inferred.rawText || '',
          scannerClassification: classification.kind,
          classificationCategory: classification.category,
          classificationReason: classification.reason,
          isInventoryLine,
          matchedItemId: isInventoryLine && match ? match.id : '',
          matchId: isInventoryLine && match ? match.id : '',
          matchName: isInventoryLine && match ? match.name : '',
          action: isInventoryLine ? (match ? 'update' : 'create') : 'record'
        };
      };

      const preparedRows = sourceRows.map(prepareReviewRow);
      const lineItemMap = new Map();
      preparedRows.filter(row => ['stock', 'non_food'].includes(row.scannerClassification)).forEach(row => {
        const key = invoiceProductKey(row);
        const previous = lineItemMap.get(key) || {};
        lineItemMap.set(key, { ...previous, ...row, isInventoryLine: true, rowType: row.scannerClassification === 'non_food' ? 'non_food_supply' : 'product' });
      });
      const normalizedLineItems = Array.from(lineItemMap.values());
      const productKeys = new Set(normalizedLineItems.map(invoiceProductKey));
      const normalizedFullRows = (fullRows.length ? fullRows : sourceRows).map(prepareReviewRow);

      const reviewMap = new Map();
      normalizedFullRows
        .filter(row => row.scannerClassification === 'review')
        .filter(row => !productKeys.has(invoiceProductKey(row)))
        .forEach(row => reviewMap.set(invoiceProductKey(row), { ...row, isInventoryLine: false }));
      const skippedRows = Array.from(reviewMap.values());
      const ignoredDocumentRowCount = normalizedFullRows.filter(row => row.scannerClassification === 'document').length;

      updateInvoiceProgress(100, 'Review ready.', 'done');
      setInvoiceReviewTab('matched');
      setScannedInvoice({
        ...data,
        lineItems: normalizedLineItems,
        skippedRows,
        ignoredDocumentRowCount,
        allExtractedRows: normalizedFullRows,
        sourceFile: file.name,
        scanCompression: payload.compression || null,
        scanUploadedFileName: payload.uploadedFileName || ''
      });
      const recoveredCount = normalizedLineItems.filter(row => /recovered from distributor/i.test(row.classificationReason || '')).length;
      const reviewText = skippedRows.length ? `${skippedRows.length} uncertain purchase row${skippedRows.length === 1 ? '' : 's'} need review.` : 'No uncertain rows need review.';
      const supplyCount = normalizedLineItems.filter(row => row.scannerClassification === 'non_food').length;
      addToast('Scan Complete', `Found ${normalizedLineItems.length} purchased inventory rows${supplyCount ? `, including ${supplyCount} non-food suppl${supplyCount === 1 ? 'y' : 'ies'}` : ''}${recoveredCount ? ` and ${recoveredCount} recovered from dense invoice text` : ''}. ${reviewText}`);
    } catch (err) {
      if (aiPulseId) window.clearInterval(aiPulseId);
      if (timeoutId) window.clearTimeout(timeoutId);
      console.error(err);
      const message = err?.name === 'AbortError'
        ? 'The invoice scanner needed more time. Try this same document one more time; if it keeps happening, split only the biggest PDF pages.'
        : (err.message || 'Could not scan invoice.');
      updateInvoiceProgress(100, message, 'error');
      addToast(/over|compress|split|large/i.test(message) ? 'Invoice Too Large' : 'Scan Error', message);
    } finally {
      invoiceScanBusyRef.current = false;
      setIsScanningInvoice(false);
      e.target.value = '';
      loadInvoiceAiUsage();
    }
  };
  const promoteInvoiceReviewRow = (row, rowIndex, sourceList = 'skippedRows') => {
    const inferred = inferInvoiceProductFields(row);
    const itemName = inferred.itemName || inferred.description || inferred.name || inferred.rawText || `Recovered invoice row ${rowIndex + 1}`;
    const incomingCode = inferred.productCode || inferred.sku || inferred.itemNumber || inferred.pfgCode || inferred.code || inferred.itemCode || '';
    const skuKey = normalizeSku(incomingCode);
    const nameKey = normalizeName(itemName);
    const matchByCode = skuKey ? inventoryItems.find(inv => normalizeSku(inv.pfgCode) === skuKey) : null;
    const matchByName = inventoryItems.find(inv => normalizeName(inv.name) === nameKey || (nameKey && normalizeName(inv.name).includes(nameKey)) || (normalizeName(inv.name) && nameKey.includes(normalizeName(inv.name))));
    const match = matchByCode || matchByName;
    const promoted = {
      ...inferred,
      itemName,
      productCode: incomingCode,
      rowType: 'product',
      scannerClassification: 'stock',
      classificationCategory: 'Food or inventory product',
      isInventoryLine: true,
      matchedItemId: match?.id || '',
      matchId: match?.id || '',
      matchName: match?.name || '',
      action: match ? 'update' : 'create',
      classificationReason: 'Manually promoted from Needs Review'
    };

    setScannedInvoice(previous => {
      if (!previous) return previous;
      const nextItems = [...(previous.lineItems || [])];
      const key = invoiceProductKey(promoted);
      if (!nextItems.some(item => invoiceProductKey(item) === key)) nextItems.push(promoted);
      return {
        ...previous,
        lineItems: nextItems,
        [sourceList]: (previous[sourceList] || []).filter((_, index) => index !== rowIndex)
      };
    });
    setInvoiceReviewTab('matched');
    addToast('Moved to Stock Matcher', `${itemName} is ready to match or add as a new inventory item.`);
  };

  const excludeInvoiceReviewRow = (row, rowIndex) => {
    const dismissed = {
      ...row,
      scannerClassification: 'document',
      classificationCategory: 'Manually excluded document row',
      classificationReason: 'Reviewer confirmed this row is not a purchased inventory item',
      isInventoryLine: false
    };
    setScannedInvoice(previous => {
      if (!previous) return previous;
      return {
        ...previous,
        skippedRows: (previous.skippedRows || []).filter((_, index) => index !== rowIndex),
        excludedReviewRows: [...(previous.excludedReviewRows || []), dismissed]
      };
    });
    addToast('Row Excluded', 'The row was confirmed as document noise or a non-inventory charge.');
  };

  const handleApproveInvoice = async () => {
     const unresolvedReviewRows = scannedInvoice?.skippedRows || [];
     if (unresolvedReviewRows.length) {
       setInvoiceReviewTab('skipped');
       addToast('Review Needed', `${unresolvedReviewRows.length} uncertain invoice row${unresolvedReviewRows.length === 1 ? '' : 's'} must be moved to Stock Matcher or deliberately excluded as a document/charge before approval. Nothing was saved or changed.`);
       return;
     }
     const unresolvedProducts = (scannedInvoice?.lineItems || []).filter(item => item.isInventoryLine && !item.matchedItemId);
     if (unresolvedProducts.length) {
       setInvoiceReviewTab('matched');
       addToast('Review Needed', `${unresolvedProducts.length} purchased product row${unresolvedProducts.length === 1 ? '' : 's'} still need an inventory match or “Add as New Item” selection. Nothing was saved or changed.`);
       return;
     }

     try {
       // 1. Log the invoice record for history
       await safeInventoryWrite({ quiet: true, action: "add", collectionName: "invoices", label: "Invoice scan", data: {
         ...scannedInvoice,
         restaurantId: appUser.restaurantId,
         processedAt: new Date().toISOString(),
         processedBy: appUser.name
       } });

       // 2. Resolve Vendor (Auto-Create if Missing)
       let vId = '';
       let existingVendor = vendors.find(v => v.name.toLowerCase() === (scannedInvoice.vendorName || '').toLowerCase());
       
       if (existingVendor) {
          vId = existingVendor.id;
       } else if (scannedInvoice.vendorName) {
          const newVRef = await safeInventoryWrite({ quiet: true, action: "add", collectionName: "vendors", label: "Invoice vendor", data: { 
            name: scannedInvoice.vendorName, 
            rep: "", email: "", phone: "", 
            restaurantId: appUser.restaurantId 
          } });
          vId = newVRef.id;
       }

       // 3. Loop through and apply stock updates OR create new items
       let updateCount = 0;
       let newCount = 0;
       
for (const item of scannedInvoice.lineItems) {
          // Catch every possible key name the AI might use for the SKU/Product Code
          const incomingCode = item.productCode || item.sku || item.itemNumber || item.pfgCode || item.code || item.itemCode || '';
          if (!item.isInventoryLine || !isPurchasedInvoiceLine(item)) continue;

if (item.matchedItemId === 'CREATE_NEW') {
             // Smart Auto-Categorizer
             const n = (item.itemName || '').toLowerCase();
             let autoCat = item.scannerClassification === 'non_food' ? 'Supplies' : 'Other';
             if (item.scannerClassification !== 'non_food') {
               if (n.includes('beef') || n.includes('chicken') || n.includes('pork') || n.includes('steak') || n.includes('bacon') || n.includes('sausage') || n.includes('turkey')) autoCat = 'Meat';
               else if (n.includes('lettuce') || n.includes('tomato') || n.includes('onion') || n.includes('potato') || n.includes('apple') || n.includes('lemon') || n.includes('lime') || n.includes('pepper') || n.includes('produce')) autoCat = 'Produce';
               else if (n.includes('milk') || n.includes('cheese') || n.includes('cream') || n.includes('butter') || n.includes('yogurt') || n.includes('dairy')) autoCat = 'Dairy';
               else if (n.includes('bread') || n.includes('bun') || n.includes('roll') || n.includes('tortilla') || n.includes('dough')) autoCat = 'Bakery';
               else if (n.includes('fish') || n.includes('shrimp') || n.includes('salmon') || n.includes('crab') || n.includes('seafood')) autoCat = 'Seafood';
               else if (n.includes('fry') || n.includes('fries') || n.includes('frozen') || n.includes('ice')) autoCat = 'Frozen';
               else if (n.includes('box') || n.includes('cup') || n.includes('napkin') || n.includes('fork') || n.includes('towel') || n.includes('lid') || n.includes('straw') || n.includes('container') || n.includes('bag') || n.includes('foil') || n.includes('wrap')) autoCat = 'Supplies';
               else if (n.includes('beer') || n.includes('wine') || n.includes('soda') || n.includes('juice') || n.includes('syrup') || n.includes('water') || n.includes('tea') || n.includes('coffee')) autoCat = 'Beverage';
             }

             const packProfile = parsePackProfile(item.packSize || item.uom || item.size || '');
             await safeInventoryWrite({ quiet: true, action: "add", collectionName: "inventoryItems", label: "Invoice inventory item", data: {
                name: item.itemName,
                category: autoCat, 
                pfgCode: incomingCode, 
                supplierId: vId,
                packSize: item.packSize || item.uom || item.size || '1 CS',
                yieldQty: parseFloat(item.unitsPerCase || item.casePackCount || item.caseCount || packProfile.count) || 1, 
                weightPerStockUnit: parseFloat(item.weightPerCaseLbs || item.weightPerStockUnit || packProfile.weightLbs) || 0,
                burnDefaultMode: (parseFloat(item.weightPerCaseLbs || item.weightPerStockUnit || packProfile.weightLbs) || 0) > 0 ? 'weight' : 'count',
                burnUnitLabel: (parseFloat(item.weightPerCaseLbs || item.weightPerStockUnit || packProfile.weightLbs) || 0) > 0 ? 'lb' : 'unit',
                price: parseFloat(item.unitPrice || item.casePrice) || 0,
                parLevel: 0,
                currentStock: parseFloat(item.quantity || item.shippedQty || item.receivedQty) || 0,
                pendingQty: 0,
                isStarred: false,
                lastOrderedDate: null,
                inventorySourceType: item.scannerClassification === 'non_food' ? 'non_food_supply' : 'food_product',
                invoiceSupplyCategory: item.scannerClassification === 'non_food' ? (item.classificationCategory || 'Supplies') : '',
                lastInvoiceRaw: item,
                restaurantId: appUser.restaurantId
             } });
             newCount++;
          } else if (item.matchedItemId) {
             const invItem = inventoryItems.find(i => i.id === item.matchedItemId);
             if (invItem) {
                const addedStock = parseFloat(item.quantity || item.shippedQty || item.receivedQty) || 0;
                const updates = { 
                   currentStock: (parseFloat(invItem.currentStock) || 0) + addedStock 
                };
                
                // If the item doesn't have a product code yet, but the invoice found one, save it
                if (!invItem.pfgCode && incomingCode) {
                   updates.pfgCode = incomingCode;
                }
                const packProfile = parsePackProfile(item.packSize || item.uom || item.size || '');
                if (!invItem.weightPerStockUnit && packProfile.weightLbs > 0) updates.weightPerStockUnit = packProfile.weightLbs;
                if ((!invItem.yieldQty || Number(invItem.yieldQty) <= 1) && packProfile.count > 1) updates.yieldQty = packProfile.count;
                updates.lastInvoiceRaw = item;

                await safeInventoryWrite({ quiet: true, action: "update", collectionName: "inventoryItems", docId: invItem.id, label: "Invoice stock update", before: invItem, data: updates });
                updateCount++;
             }
          }
       }

       addToast('Invoice Processed', `Saved ${updateCount + newCount} item${updateCount + newCount === 1 ? '' : 's'}: updated ${updateCount}, added ${newCount}.`);
       setScannedInvoice(null);
     } catch(e) {
       console.error('Invoice approval failed:', e);
       addToast('Invoice Not Processed', e?.message || 'The invoice could not be saved. No further stock updates will be attempted until the error is corrected.');
     }
  };

const isBelowPar = (item) => Number(item.parLevel || 0) > 0 && Number(item.currentStock || 0) < Number(item.parLevel || 0);
const belowParItems = orderableInventoryItems.filter(isBelowPar);
const zeroStockMenuImpacts = getZeroStockMenuImpacts(orderableInventoryItems, menuDependencies);
const selectedWasteItem = inventoryItems.find(i => i.id === wItemId) || null;
const selectedWasteUnitsPerStock = selectedWasteItem ? getBurnUnitsPerStockUnit(selectedWasteItem) : 1;
const selectedWasteWeightPerStock = selectedWasteItem ? (parseFloat(wWeightPerStockUnit) || getBurnWeightPerStockUnit(selectedWasteItem)) : 0;
const selectedWasteDeductionPreview = selectedWasteItem && wQty ? getBurnStockDeduction(wQty, selectedWasteItem, { mode: wMode, weightPerStockUnit: selectedWasteWeightPerStock, unitsPerStockUnit: selectedWasteUnitsPerStock }) : 0;
const selectedWastePackProfile = selectedWasteItem ? parsePackProfile(selectedWasteItem.packSize) : { notes: [] };
const groupedItems = orderableInventoryItems
  .filter(i => !focusBelowPar || isBelowPar(i))
  .filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm)))
  .reduce((acc, item) => { 
    const key = groupBy === 'Vendor' ? (vendors.find(v=>v.id===item.supplierId)?.name || 'Unassigned Vendor') : (item.category || 'Uncategorized');
    if (!acc[key]) acc[key] = []; acc[key].push(item); return acc; 
  }, {});
  const orderTotal = confirmModal.items.reduce((sum, item) => sum + ((item.price||0) * item.orderQty), 0);

  const printInvoiceHistory = () => {
    const rows = [['Vendor', 'Invoice Date', 'Total', 'Processed By'], ...invoices.slice().sort((a,b) => new Date(b.processedAt || 0) - new Date(a.processedAt || 0)).map(inv => [inv.vendorName || 'Unknown', inv.invoiceDate || '', `$${Number(inv.invoiceTotal || 0).toFixed(2)}`, inv.processedBy || ''])];
    openPrintableReport({ title: '86 Chaos Invoice History', subtitle: appUser?.restaurantName || 'Workspace', rows, filename: `86chaos-invoice-history-${getToday()}` });
  };
  const printCurrentInvoice = (invoice) => {
    if (!invoice) return;
    const rows = [['Item', 'Qty', 'Pack', 'Unit', 'Total'], ...(invoice.lineItems || []).map(item => [item.itemName || item.name || '', item.quantity || item.shippedQty || '', item.packSize || item.uom || '', `$${Number(item.unitPrice || item.casePrice || 0).toFixed(2)}`, `$${Number(item.totalPrice || item.extendedPrice || item.lineTotal || 0).toFixed(2)}`])];
    openPrintableReport({ title: `Invoice ${invoice.invoiceNumber || ''}`.trim() || 'Invoice Detail', subtitle: `${invoice.vendorName || 'Unknown vendor'} • ${invoice.invoiceDate || ''}`, rows, filename: `86chaos-invoice-${invoice.invoiceNumber || getToday()}` });
  };

  const invoiceUsageSummary = normalizeAiUsage(invoiceAiUsage, 'invoice');
  const invoiceUsageWarning = aiPageLimitMessage('invoice', invoiceAiUsage);

  return (
    <div className="inventory-desktop max-w-7xl mx-auto space-y-4 pb-24">
      
      {/* CSV IMPORT CLEANUP REVIEW MODAL */}
      <Modal isOpen={!!csvImportReview} onClose={() => isSavingCsvImport ? null : setCsvImportReview(null)} title="Inventory Import Cleanup Review">
        {csvImportReview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Rows</div><div className="text-lg font-black text-white">{csvImportReview.rows.length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Creates</div><div className="text-lg font-black text-emerald-400">{csvImportReview.rows.filter(r => r.action === 'create').length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Updates</div><div className="text-lg font-black text-[#D4A381]">{csvImportReview.rows.filter(r => r.action === 'update').length}</div></div>
            </div>
            {csvImportReview.issues?.length > 0 && <div className="bg-amber-900/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200 font-bold">{csvImportReview.issues.slice(0, 5).join(' • ')}</div>}
            <div className="max-h-[55vh] overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {csvImportReview.rows.map((row, idx) => (
                <div key={`${row.rowNumber}-${idx}`} className="p-3 bg-[#1A2126] grid md:grid-cols-[1fr_120px] gap-3">
                  <div>
                    <div className="text-sm font-black text-white">{row.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-1">Row {row.rowNumber} • {row.category} • {row.pfgCode || 'No SKU'} • {row.packSize} • ${Number(row.price || 0).toFixed(2)} • {row.vendorName}</div>
                    {row.existingName && <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-widest mt-1">Existing match: {row.existingName}</div>}
                    {row.duplicateInFile && <div className="text-[9px] text-red-300 font-black uppercase tracking-widest mt-1">Duplicate in CSV, skipped by default</div>}
                  </div>
                  <select value={row.action} onChange={e => updateCsvReviewRow(idx, { action: e.target.value })} className={`${T.input} text-xs font-black`}>
                    <option value="create">Create New</option>
                    <option value="update" disabled={!row.existingId}>Update Match</option>
                    <option value="skip">Skip</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2"><button disabled={isSavingCsvImport} onClick={() => setCsvImportReview(null)} className={T.btnAlt}>Cancel</button><button disabled={isSavingCsvImport} onClick={approveCsvImport} className={T.btn}>{isSavingCsvImport ? 'Saving...' : 'Approve Import'}</button></div>
          </div>
        )}
      </Modal>

      {/* INVOICE RECONCILIATION MODAL */}
      <Modal isOpen={!!scannedInvoice} onClose={() => setScannedInvoice(null)} title="Reconcile & Approve Invoice">
        {scannedInvoice && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
              <div>
                <div className="font-black text-white text-lg">{scannedInvoice.vendorName || 'Unknown Vendor'}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{scannedInvoice.invoiceDate || 'No date found'} {scannedInvoice.invoiceNumber ? ` • Inv #${scannedInvoice.invoiceNumber}` : ''}</div>
                {scannedInvoice.scanFileName && <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">File: {scannedInvoice.scanFileName}</div>}
              </div>
<div className="text-xl font-black text-emerald-400">${Number(scannedInvoice.invoiceTotal || scannedInvoice.grandTotal || 0).toFixed(2)}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Purchased Items</div><div className="text-lg font-black text-white">{(scannedInvoice.lineItems || []).length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Food / Beverage</div><div className="text-lg font-black text-emerald-300">{(scannedInvoice.lineItems || []).filter(row => row.scannerClassification === 'stock').length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Needs Review</div><div className={`text-lg font-black ${(scannedInvoice.skippedRows || []).length ? 'text-amber-300' : 'text-emerald-300'}`}>{(scannedInvoice.skippedRows || []).length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Non-food Supplies</div><div className="text-lg font-black text-blue-300">{(scannedInvoice.lineItems || []).filter(row => row.scannerClassification === 'non_food').length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Document Rows</div><div className="text-lg font-black text-slate-300">{Number(scannedInvoice.ignoredDocumentRowCount || 0)}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Confidence</div><div className="text-lg font-black text-[#D4A381]">{scannedInvoice.confidence || 'Review'}</div></div>
            </div>

            {(scannedInvoice.extractionWarnings || scannedInvoice.extractionNotes || scannedInvoice.rawTranscription) && (
              <details className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Full Extraction Audit / Raw Text</summary>
                {scannedInvoice.extractionWarnings && <div className="mt-2 text-[10px] text-orange-300 font-bold">Warnings: {Array.isArray(scannedInvoice.extractionWarnings) ? scannedInvoice.extractionWarnings.join(' • ') : scannedInvoice.extractionWarnings}</div>}
                {scannedInvoice.extractionNotes && <div className="mt-2 text-[10px] text-slate-300 font-bold">Notes: {Array.isArray(scannedInvoice.extractionNotes) ? scannedInvoice.extractionNotes.join(' • ') : scannedInvoice.extractionNotes}</div>}
                {scannedInvoice.rawTranscription && <pre className="mt-2 max-h-36 overflow-auto text-[10px] whitespace-pre-wrap text-slate-400 bg-black/20 p-2 rounded-lg border border-[#2A353D]">{scannedInvoice.rawTranscription}</pre>}
              </details>
            )}
            
            {(scannedInvoice.skippedRows || []).length > 0 && (
              <div className="bg-amber-900/10 border border-amber-500/30 rounded-xl p-2 text-[10px] text-amber-100 font-bold leading-snug">
                Only uncertain purchase-looking rows appear in Needs Review. Move a real purchased item to Stock Matcher or choose Exclude Row before approval.
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 bg-[#12161A] border border-[#2A353D] rounded-xl p-1">
              {[['matched','Stock Matcher'], ['skipped',`Needs Review (${(scannedInvoice.skippedRows || []).length})`], ['raw','Raw Audit']].map(([id,label]) => <button key={id} type="button" onClick={() => setInvoiceReviewTab(id)} className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${invoiceReviewTab === id ? `${T.grad} text-slate-900` : 'text-slate-400 hover:text-white'}`}>{label}</button>)}
            </div>

            {invoiceReviewTab === 'matched' && <div className="flex justify-between items-center mt-2 mb-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest pl-1">Stock Matcher</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const newItems = scannedInvoice.lineItems.map(i => ({...i, matchedItemId: ''})); setScannedInvoice({...scannedInvoice, lineItems: newItems}); }} className="text-[9px] bg-[#1A2126] text-slate-400 border border-[#2A353D] hover:text-white px-2 py-1 rounded font-black uppercase tracking-widest transition-colors shadow-sm">
                  Clear All
                </button>
                <button type="button" onClick={() => { const newItems = scannedInvoice.lineItems.map(i => ({...i, matchedItemId: i.matchedItemId || 'CREATE_NEW'})); setScannedInvoice({...scannedInvoice, lineItems: newItems}); }} className="text-[9px] bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 px-2 py-1 rounded font-black uppercase tracking-widest transition-colors shadow-sm">
                  Mark Unmatched as New
                </button>
              </div>
            </div>}

            {invoiceReviewTab === 'matched' && <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {(scannedInvoice.lineItems || []).map((item, idx) => (
                <div key={idx} className="p-3 bg-[#1A2126] flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
<div className="font-bold text-white text-sm flex items-center gap-1.5">
  {item.productCode && <span className="text-[#D4A381] font-black">[{item.productCode}]</span>}
  {item.itemName}
  {item.scannerClassification === 'non_food' && <span className="text-[8px] bg-blue-900/30 text-blue-200 border border-blue-500/30 px-1.5 py-0.5 rounded uppercase">Supply</span>}
  {!item.isInventoryLine && <span className="text-[8px] bg-slate-800 text-slate-400 border border-[#2A353D] px-1.5 py-0.5 rounded uppercase">{item.rowType || 'non-stock'}</span>}
</div>                      <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-widest mt-0.5">
                        Qty: {item.quantity || item.shippedQty || '—'} {item.packSize || item.uom || ''} • Unit: ${Number(item.unitPrice || item.casePrice || 0).toFixed(2)} • Total: ${Number(item.totalPrice || item.extendedPrice || item.lineTotal || 0).toFixed(2)}
                      </div>
                      {(item.orderedQty || item.shippedQty || item.weight || item.tax || item.discount || item.rawText) && <div className="text-[9px] text-slate-500 font-bold mt-1 leading-snug">
                        {item.orderedQty ? `Ordered: ${item.orderedQty} ` : ''}{item.shippedQty ? `Shipped: ${item.shippedQty} ` : ''}{item.weight ? `Weight: ${item.weight} ` : ''}{item.tax ? `Tax: ${item.tax} ` : ''}{item.discount ? `Discount: ${item.discount} ` : ''}{item.rawText ? `Raw: ${item.rawText}` : ''}
                      </div>}
                    </div>
                    <div className="font-black text-slate-300 text-right">${Number(item.totalPrice || item.extendedPrice || item.lineTotal || 0).toFixed(2)}</div>
                  </div>
                  
                  {/* RECONCILIATION DROPDOWN */}
                  <select 
                    value={item.matchedItemId} 
                    onChange={(e) => {
                       const newItems = [...scannedInvoice.lineItems];
                       newItems[idx].matchedItemId = e.target.value;
                       setScannedInvoice({...scannedInvoice, lineItems: newItems});
                    }}
                    className={`${T.input} py-2 text-xs font-bold outline-none cursor-pointer ${item.matchedItemId === 'CREATE_NEW' ? 'border-blue-500/50 text-blue-400 bg-blue-900/10' : item.matchedItemId ? 'border-emerald-500/50 text-emerald-400 bg-emerald-900/10' : 'border-orange-500/50 text-orange-400 bg-orange-900/10'}`}
                  >
                    <option value="">{item.isInventoryLine ? '-- Select an inventory match or Add as New --' : '-- Non-inventory row saved to invoice only --'}</option>
                    {item.isInventoryLine && <option value="CREATE_NEW">➕ Add as New Item</option>}
                    {inventoryItems.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>}

            {invoiceReviewTab === 'raw' && <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">{(scannedInvoice.allExtractedRows || []).length ? scannedInvoice.allExtractedRows.map((row, idx) => <div key={idx} className="p-3 bg-[#1A2126]"><div className="text-[9px] text-[#D4A381] font-black uppercase tracking-widest">Raw row {idx + 1}</div><pre className="mt-1 whitespace-pre-wrap text-[10px] text-slate-300">{typeof row === 'string' ? row : JSON.stringify(row, null, 2)}</pre></div>) : <div className="p-6 text-center text-slate-500 font-bold">No raw rows returned by scanner.</div>}</div>}

            {invoiceReviewTab === 'skipped' && <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {(scannedInvoice.skippedRows || []).length ? scannedInvoice.skippedRows.map((row, idx) => (
                <div key={idx} className="p-3 bg-[#1A2126] flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-black">{row.itemName || row.description || row.rawText || `Review row ${idx + 1}`}</div>
                    <div className="text-[10px] text-amber-200 font-bold mt-1">{row.classificationReason || 'Possible purchase row with incomplete evidence'}</div>
                    {row.rawText && row.rawText !== row.itemName && <div className="text-[9px] text-slate-500 font-bold mt-1 break-words">Raw: {row.rawText}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" onClick={() => excludeInvoiceReviewRow(row, idx)} className="rounded-lg border border-slate-600 bg-slate-900/40 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-white">
                      Exclude Row
                    </button>
                    <button type="button" onClick={() => promoteInvoiceReviewRow(row, idx, 'skippedRows')} className="rounded-lg border border-[#D4A381]/50 bg-[#D4A381]/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#F4C8A8] hover:bg-[#D4A381]/20">
                      Move to Stock Matcher
                    </button>
                  </div>
                </div>
              )) : <div className="p-6 text-center text-emerald-300 font-bold">No uncertain rows need review.</div>}
            </div>}

            <button onClick={handleApproveInvoice} disabled={(scannedInvoice.skippedRows || []).length > 0 || (scannedInvoice.lineItems || []).some(item => item.isInventoryLine && !item.matchedItemId)} className={`w-full ${T.btn} py-3 disabled:opacity-50 disabled:cursor-not-allowed`}>Approve & Update Stock</button>
          </div>
        )}
      </Modal>

      {/* VIEW PAST INVOICE DETAILS MODAL */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Details">
        {viewInvoice && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
              <div>
                <div className="font-black text-white text-lg">{viewInvoice.vendorName}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{viewInvoice.invoiceDate}</div>
              </div>
              <div className="text-xl font-black text-emerald-400">${Number(viewInvoice.invoiceTotal || 0).toFixed(2)}</div>
            </div>
            
            <div className="max-h-60 overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {(viewInvoice.lineItems || []).map((item, idx) => (
                <div key={idx} className="p-2.5 bg-[#1A2126] flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-sm">{item.itemName}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {item.quantity} {item.packSize} @ ${Number(item.unitPrice || 0).toFixed(2)}/ea
                    </div>
                    {item.matchedItemId && item.matchedItemId !== 'CREATE_NEW' && <div className="text-[8px] text-emerald-500 font-black uppercase mt-1">Matched to Inventory</div>}
                    {item.matchedItemId === 'CREATE_NEW' && <div className="text-[8px] text-blue-400 font-black uppercase mt-1">Added as New Item</div>}
                  </div>
                  <div className="font-black text-slate-300">${Number(item.totalPrice || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => printCurrentInvoice(viewInvoice)} className={`w-full ${T.btn} py-3`}>Print / PDF</button><button onClick={() => setViewInvoice(null)} className={`w-full ${T.btnAlt} py-3`}>Close</button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, vendorId: null, items: [] })} title={`Review Order: ${vendors.find(v=>v.id===confirmModal.vendorId)?.name}`}>
         <div className="space-y-4">
           <div className={`max-h-60 overflow-y-auto border ${T.border} rounded-xl divide-y divide-[#2A353D]`}>{confirmModal.items.map(item => (<div key={item.id} className="p-3 flex justify-between items-center bg-[#12161A]"><div><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-xs ${T.muted}`}>{item.packSize}</span><div className="text-[9px] text-[#D4A381] mt-0.5 uppercase tracking-widest font-black">Est: ${((item.price||0) * item.orderQty).toFixed(2)}</div></div><div className={`font-black ${T.copper} text-lg`}>{item.orderQty}</div></div>))}</div>
           <div className="flex justify-between items-center bg-[#1A2126] p-3 rounded-xl border border-[#2A353D]"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estimated Total</span><span className="text-lg font-black text-emerald-400">${orderTotal.toFixed(2)}</span></div>
<div className="grid grid-cols-2 gap-2">
<button onClick={() => executeOrder('edi')} className={`w-full col-span-2 bg-blue-900/20 text-blue-400 font-black tracking-widest uppercase border border-blue-900/50 hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2 py-3 text-xs rounded-xl shadow-[0_0_10px_rgba(59,130,246,0.1)]`}>
                <Globe size={16}/> Direct EDI Sync
                <span className="ml-2 bg-blue-900/30 text-blue-400 border border-blue-500/50 text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black shadow-[0_0_8px_rgba(59,130,246,0.2)]">Beta</span>
              </button>              <button onClick={() => executeOrder('email')} className={`w-full ${T.btn} flex items-center justify-center gap-2 py-2 text-xs`}><Send size={16}/> Email</button>
              <button onClick={() => executeOrder('sms')} className={`w-full ${T.btn} flex items-center justify-center gap-2 py-2 text-xs`}><MessageSquare size={16}/> Text</button>
             <button onClick={() => executeOrder('csv')} className={`w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-emerald-400 transition-all px-2 py-2 text-xs flex items-center justify-center gap-2`}><Package size={16}/> CSV Export</button>
             <button onClick={() => executeOrder('copy')} className={`w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-[#D4A381] transition-all px-2 py-2 text-xs flex items-center justify-center gap-2`}><ClipboardList size={16}/> Copy List</button>
           </div>
         </div>
      </Modal>

      <Modal isOpen={!!editVendor} onClose={() => setEditVendor(null)} title="Edit Vendor">
        {editVendor && (
          <form onSubmit={handleSaveVendorEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><input type="text" value={editVendor.name} onChange={e=>setEditVendor({...editVendor, name: e.target.value})} className={T.input} required placeholder="Company Name"/><input type="text" value={editVendor.rep || ''} onChange={e=>setEditVendor({...editVendor, rep: e.target.value})} className={T.input} placeholder="Rep Name"/></div>
      <div className="grid grid-cols-2 gap-3"><input type="tel" value={editVendor.phone || ''} onChange={e=>setEditVendor({...editVendor, phone: e.target.value})} className={T.input} placeholder="Phone"/><input type="email" value={editVendor.email || ''} onChange={e=>setEditVendor({...editVendor, email: e.target.value})} className={T.input} placeholder="Email"/></div>
            <div>
              <label className={T.label}>Direct EDI / API Webhook URL</label>
              <input type="url" value={editVendor.ediEndpoint || ''} onChange={e=>setEditVendor({...editVendor, ediEndpoint: e.target.value})} className={`${T.input} border-blue-900/50 focus:border-blue-500`} placeholder="https://api.sysco.com/v1/orders..." />
            </div>
            <div>
              <label className={T.label}>Order Cut-Off Time</label>
              <input type="time" value={editVendor.cutOffTime || ''} onChange={e=>setEditVendor({...editVendor, cutOffTime: e.target.value})} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Order Cut-Off Days</label>
              <div className="flex flex-wrap gap-2 mt-1">{weekDays.map(d=><button type="button" key={d} onClick={()=>toggleVendorDay(d, true)} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${editVendor.cutOffDays?.includes(d) ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:text-white'}`}>{d.substring(0,3)}</button>)}</div>
            </div>
            <button type="submit" className={`w-full ${T.btn} mt-2`}>Save Vendor Details</button>
          </form>
        )}
      </Modal>

      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b ${T.border} pb-3`}>
        <h2 className="text-2xl font-black flex items-center gap-2 text-white"><ClipboardList size={24} className={T.copper}/> Inventory</h2>
        <div className={`inventory-subtabs bg-[#12161A] p-1 rounded-xl flex flex-wrap border ${T.border} w-full sm:w-auto`}>
          <button onClick={() => setInvTab('count')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'count' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>count</button>
          {hasInvPerms && <button onClick={() => setInvTab('order')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'order' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>order</button>}
          {hasInvPerms && canUseAiOrdering && <button onClick={() => setInvTab('ai-order')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'ai-order' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>🤖 AI Order</button>}
          {hasInvPerms && <button onClick={() => setInvTab('manage')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'manage' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>manage</button>}
          {hasInvPerms && <button onClick={() => setInvTab('vendors')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'vendors' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>vendors</button>}
          {hasInvPerms && canUseSmartInventory && <button onClick={() => setInvTab('invoices')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'invoices' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>🧾 Invoices</button>}
<button onClick={() => setInvTab('waste')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex items-center justify-center gap-1 flex-1 sm:flex-none ${invTab === 'waste' ? `bg-red-500/20 text-red-500 shadow-sm border border-red-500/50` : 'text-slate-400 hover:text-red-400'}`}>
            🚨 Burn Log <span className="inventory-preview-badge ml-1 bg-red-900/30 text-red-300 border border-red-500/50 text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black shadow-[0_0_8px_rgba(239,68,68,0.2)]">Preview</span>
          </button>        </div>
      </div>

{invTab === 'count' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div id="below-par-focus-panel" className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Search product or code..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${T.input} flex-1`} />
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className={`${T.input} sm:w-48 font-bold`}>
              <option value="Category">Group by Category</option>
              <option value="Vendor">Group by Vendor</option>
            </select>
            <button type="button" onClick={() => setFocusBelowPar(v => !v)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${focusBelowPar ? 'bg-red-900/30 border-red-500/50 text-red-300' : 'bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-white'}`}>
              {focusBelowPar ? `Showing ${belowParItems.length} Below Par` : `Below-Par Focus (${belowParItems.length})`}
            </button>
          </div>
          {focusBelowPar && belowParItems.length === 0 && <div className="bg-emerald-900/10 border border-emerald-500/30 text-emerald-300 rounded-xl p-4 text-sm font-bold">No inventory items are currently below par. Items equal to par are not counted as low.</div>}
          {zeroStockMenuImpacts.length > 0 && (
            <div className="bg-red-950/20 border border-red-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-red-200 text-sm uppercase tracking-widest">Menu Impact Alerts</h3>
                  <p className="text-[10px] text-red-100/70 font-bold mt-1">These inventory items are at 0 stock and are linked to menu items.</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-300">{zeroStockMenuImpacts.length} item(s)</span>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {zeroStockMenuImpacts.slice(0, 8).map(row => (
                  <div key={row.item.id} className="bg-[#12161A] border border-red-900/50 rounded-xl p-3">
                    <div className="text-sm font-black text-white">{row.item.name}</div>
                    <div className="text-[10px] text-red-200 font-bold mt-1 leading-snug">Impacts: {row.impacts.map(i => i.name).join(', ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.entries(groupedItems).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className={`text-base font-black border-b ${T.border} pb-0.5 uppercase tracking-wide text-slate-400`}>{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{items.map(item => (
                  <div key={item.id} className={`${T.card} p-2 flex items-center justify-between gap-2 ${isBelowPar(item) ? 'border-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.15)] bg-red-950/10' : ''}`}>
                    <div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name}</div><div className={`text-[9px] font-bold ${T.muted} uppercase`}>{vendors.find(v=>v.id===item.supplierId)?.name || 'No Vendor'}   {item.packSize || '1 CS'}   YIELD: {item.yieldQty||1}</div></div>
                    <div className={`flex items-center gap-2 bg-[#12161A] p-1 rounded-md border ${T.border} flex-shrink-0`}>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>PAR</span><input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} disabled={!hasInvPerms} className={`w-8 text-center font-bold border rounded py-0.5 outline-none text-xs bg-[#1A2126] text-white border-[#2A353D]`} /></div>
                      <div className={`h-6 w-px bg-[#2A353D]`}></div>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>STOCK</span><div className="flex items-center gap-1"><button onClick={() => updateStock(item.id, (item.currentStock||0) - 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white hover:text-[#D4A381]`}>-</button><span className={`w-6 text-center font-black text-sm ${(item.currentStock||0) < (item.parLevel||0) ? 'text-red-500' : 'text-white'}`}>{Number(item.currentStock||0).toFixed(2).replace(/\.00$/, '')}</span><button onClick={() => updateStock(item.id, (item.currentStock||0) + 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white hover:text-[#D4A381]`}>+</button></div></div>
                    </div>
                  </div>
                ))}</div>
            </div>
          ))}
        </div>
      )}

      {hasInvPerms && canUseAiOrdering && invTab === 'ai-order' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div id="ai-order-assistant-panel" className={`${T.card} p-4 sm:p-5 border-[#D4A381]/40 bg-gradient-to-br from-[#1A2126] to-[#0B0E11]`}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] flex items-center gap-2"><Sparkles size={14}/> AI Order Assistant</div>
                <h3 className="text-2xl font-black text-white mt-1">Smart order drafts, event supply checks, price warnings</h3>
                <p className="text-sm text-slate-300 font-bold mt-2 max-w-3xl">AI suggests and explains. Managers still review, edit, copy, export, email, text, or save drafts before anything becomes a real vendor order.</p>
                <div className="mt-3 text-xs font-bold text-slate-400">{aiOrderSummaryText}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 min-w-[220px]">
                <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-xl font-black text-white">{aiOrderRecommendations.filter(r => r.suggestedQty > 0).length}</div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Suggested</div></div>
                <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-xl font-black text-amber-300">{aiOrderAssistant.eventNeeds.length}</div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Event Checks</div></div>
                <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-xl font-black text-red-300">{aiOrderAssistant.priceWarnings.length}</div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Price Warnings</div></div>
                <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-xl font-black text-emerald-300">{aiOrderDraftGroups.length}</div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Vendor Drafts</div></div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
              <div><label className={T.label}>Order lookahead</label><select value={aiOrderDaysAhead} onChange={e=>setAiOrderDaysAhead(Number(e.target.value)||7)} className={T.input}><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option></select></div>
              <div><label className={T.label}>Event lookahead</label><select value={aiEventDaysAhead} onChange={e=>setAiEventDaysAhead(Number(e.target.value)||14)} className={T.input}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></div>
              <button type="button" onClick={applyAiOrderOverrides} className={`${T.btn} self-end py-3`}>Apply All Suggestions</button>
              <button type="button" onClick={copyAiOrderDraft} className={`${T.btnAlt} self-end py-3`}>Copy Full Draft</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <button type="button" onClick={saveAiOrderDraft} className="w-full rounded-xl bg-emerald-900/20 border border-emerald-500/40 text-emerald-300 py-3 text-xs font-black uppercase tracking-widest hover:bg-emerald-900/30">Save AI Draft to Orders</button>
              {canUsePythonIntelligence ? <button type="button" onClick={runPythonOrderIntelligence} disabled={pythonOrderLoading} className="w-full rounded-xl bg-blue-900/20 border border-blue-500/40 text-blue-200 py-3 text-xs font-black uppercase tracking-widest hover:bg-blue-900/30 disabled:opacity-60">{pythonOrderLoading ? 'Running Python Forecast…' : 'Run Python Forecast'}</button> : <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 text-[11px] font-black text-amber-100">Python forecasting starts with Smart Kitchen.</div>}
              <button type="button" onClick={applySelectedAiOrderOverrides} disabled={!selectedAiSuggestionRows.length} className="w-full rounded-xl bg-[#0B0E11] border border-[#2A353D] text-[#D4A381] py-3 text-xs font-black uppercase tracking-widest hover:border-[#D4A381]/60 disabled:opacity-40">Apply Selected to Draft</button>
            </div>
            {pythonOrderError && <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] font-bold text-amber-100">Python analysis did not finish: {pythonOrderError}. The regular AI Order Assistant is still active.</div>}

          </div>

          {pythonOrderIntel && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              <div className={`${T.card} p-4 xl:col-span-4 border-blue-500/30 bg-blue-950/10`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-200">Python Intelligence Layer</div>
                    <h3 className="font-black text-white text-xl mt-1">Forecasts, par tuning, invoice trends, waste strategy</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">This is the behind-the-scenes Python analysis layer. It does not send orders. It adds heavier forecasting math to the manager review workflow.</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <div className="rounded-xl border border-blue-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonSummary?.forecastCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Forecasts</div></div>
                    <div className="rounded-xl border border-blue-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonSummary?.parChangeCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Par Ideas</div></div>
                    <div className="rounded-xl border border-blue-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonSummary?.priceWarningCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Prices</div></div>
                    <div className="rounded-xl border border-blue-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonSummary?.wasteInsightCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Waste</div></div>
                    <div className="rounded-xl border border-blue-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonSummary?.eventSupplyCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Events</div></div>
                    <div className="rounded-xl border border-blue-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonSummary?.prepForecastCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Prep</div></div>
                  </div>
                </div>
              </div>
              <div className={`${T.card} p-4 xl:col-span-2`}>
                <h3 className="font-black text-white text-lg mb-3">Python Order Forecasts</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">{pythonForecastRows.length ? pythonForecastRows.slice(0, 16).map(row => <div key={`py-${row.itemId || row.itemName}`} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-white">{row.itemName}</span><span className="text-[8px] px-2 py-0.5 rounded-full border border-blue-500/40 text-blue-200 uppercase tracking-widest font-black">{row.confidence}% confidence</span><span className="text-[8px] px-2 py-0.5 rounded-full border border-[#2A353D] text-slate-300 uppercase tracking-widest font-black">{row.priority}</span></div><div className="text-[11px] text-slate-400 font-bold mt-1">Suggest {row.suggestedQty} • Weekly velocity {row.weeklyVelocity || 0} • Stock {row.stock} / Par {row.par}</div><div className="text-[11px] text-slate-300 mt-1">{(row.reasons || []).slice(0, 4).join(' • ') || 'Review setup and history.'}</div></div>) : <p className="text-xs text-slate-500 font-bold">Run Python Forecast to see deeper order analysis.</p>}</div>
              </div>
              <div className={`${T.card} p-4`}>
                <h3 className="font-black text-white text-lg mb-3">Par + Waste</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">{[...(pythonOrderIntel.parRecommendations || []).map(row => `${row.itemName}: ${row.direction} par from ${row.currentPar} to ${row.suggestedPar}. ${row.reason}`), ...(pythonOrderIntel.wasteInsights || []).map(row => `${row.itemName}: ${row.suggestion} Recent waste ${row.recentWaste}.`)].length ? [...(pythonOrderIntel.parRecommendations || []).map(row => `${row.itemName}: ${row.direction} par from ${row.currentPar} to ${row.suggestedPar}. ${row.reason}`), ...(pythonOrderIntel.wasteInsights || []).map(row => `${row.itemName}: ${row.suggestion} Recent waste ${row.recentWaste}.`)].slice(0, 12).map((line, idx) => <div key={idx} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-xs font-bold text-slate-300">{line}</div>) : <p className="text-xs text-slate-500 font-bold">No par or waste insights yet.</p>}</div>
              </div>
              <div className={`${T.card} p-4`}>
                <h3 className="font-black text-white text-lg mb-3">Python Brief</h3>
                <div className="space-y-2">{pythonManagerBrief.length ? pythonManagerBrief.map((line, idx) => <div key={idx} className="rounded-xl border border-blue-500/20 bg-[#12161A] p-3 text-xs font-bold text-blue-100">{line}</div>) : <p className="text-xs text-slate-500 font-bold">No Python brief yet.</p>}</div>
              </div>
            </div>
          )}


          {false && pythonOpsIntel && (
            <div className="space-y-4">
              <div className={`${T.card} p-4 border-purple-500/30 bg-purple-950/10`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-purple-200">Python Ops Intelligence</div>
                    <h3 className="font-black text-white text-xl mt-1">Invoice watchdog, menu costing, labor warnings, data health, backup checks</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">This scan suggests repairs and reports only. It does not change pars, submit orders, edit schedules, or modify staff records.</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.priceWarningCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Prices</div></div>
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.parRecommendationCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Pars</div></div>
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.wasteInsightCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Waste</div></div>
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.menuCostCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Menu</div></div>
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.laborWarningCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Labor</div></div>
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.dataHealthCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Health</div></div>
                    <div className="rounded-xl border border-purple-500/30 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{pythonOpsSummary?.backupCheckCount || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Backups</div></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <button type="button" onClick={() => copyPythonOpsReport('text')} className="rounded-xl border border-purple-500/40 bg-[#12161A] text-purple-100 py-3 text-xs font-black uppercase tracking-widest">Copy Manager Report</button>
                  <button type="button" onClick={() => copyPythonOpsReport('csv')} className="rounded-xl border border-purple-500/40 bg-[#12161A] text-purple-100 py-3 text-xs font-black uppercase tracking-widest">Copy CSV Findings</button>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className={`${T.card} p-4 xl:col-span-2`}><h3 className="font-black text-white text-lg mb-3">Python Ops Brief</h3><div className="space-y-2">{pythonOpsBrief.length ? pythonOpsBrief.map((line, idx) => <div key={idx} className="rounded-xl border border-purple-500/20 bg-[#12161A] p-3 text-xs font-bold text-purple-100">{line}</div>) : <p className="text-xs text-slate-500 font-bold">No ops brief yet.</p>}</div></div>
                <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Menu Costing</h3><div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">{pythonOpsMenuRows.length ? pythonOpsMenuRows.slice(0, 10).map(row => <div key={row.recipeId || row.recipeName} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="font-black text-white">{row.recipeName}</div><div className="text-[11px] text-slate-400 font-bold mt-1">Cost ${Number(row.estimatedCost || 0).toFixed(2)}{row.foodCostPct ? ` • ${row.foodCostPct}% food cost` : ''}</div><div className="text-[10px] text-slate-500 font-bold mt-1">Missing: {(row.missingIngredients || []).slice(0, 4).join(', ') || 'none flagged'}</div></div>) : <p className="text-xs text-slate-500 font-bold">No menu cost findings yet. Add recipes, menu prices, invoice history, and ingredient links.</p>}</div></div>
                <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Labor + Schedule</h3><div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">{pythonOpsLaborRows.length ? pythonOpsLaborRows.slice(0, 10).map((row, idx) => <div key={idx} className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3"><div className="font-black text-amber-100">{row.title}</div><div className="text-[11px] text-slate-300 font-bold mt-1">{row.detail}</div></div>) : <p className="text-xs text-slate-500 font-bold">No labor warnings in the scan window.</p>}</div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Invoice Watchdog</h3><div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">{[...(pythonOpsIntel.priceWatch || []).map(row => row.summary), ...(pythonOpsIntel.invoiceAnomalies || []).map(row => row.detail)].length ? [...(pythonOpsIntel.priceWatch || []).map(row => row.summary), ...(pythonOpsIntel.invoiceAnomalies || []).map(row => row.detail)].slice(0, 12).map((line, idx) => <div key={idx} className="rounded-xl border border-red-500/30 bg-red-950/10 p-3 text-xs font-bold text-red-100">{line}</div>) : <p className="text-xs text-slate-500 font-bold">No invoice anomalies found.</p>}</div></div>
                <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Data Health Scanner</h3><div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">{pythonOpsHealthRows.length ? pythonOpsHealthRows.slice(0, 12).map((row, idx) => <div key={idx} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="font-black text-white">{row.area}: {row.title}</div><div className="text-[11px] text-slate-400 font-bold mt-1">{(row.issues || []).join(', ')}</div></div>) : <p className="text-xs text-slate-500 font-bold">No major data health issues found.</p>}</div></div>
                <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Backup Checks</h3><div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">{(pythonOpsIntel.backupChecks || []).length ? pythonOpsIntel.backupChecks.map((row, idx) => <div key={idx} className={`rounded-xl border p-3 text-xs font-bold ${row.status === 'attention' ? 'border-amber-500/30 bg-amber-950/10 text-amber-100' : 'border-emerald-500/30 bg-emerald-950/10 text-emerald-100'}`}><div className="font-black">{row.title}</div><div className="mt-1">{row.detail}</div><div className="mt-1 text-slate-400">{row.recommendation}</div></div>) : <p className="text-xs text-slate-500 font-bold">No backup check was returned.</p>}</div></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className={`${T.card} p-4 xl:col-span-2`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3"><h3 className="font-black text-white text-lg">Top Order Suggestions</h3><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={toggleAllAiOrderSelections} className="rounded-lg border border-[#2A353D] bg-[#0B0E11] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">{allVisibleAiSuggestionsSelected ? 'Clear Selection' : 'Select All'}</button><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Review required</span></div></div>
              <div className="space-y-2">
                {aiOrderRecommendations.length ? aiOrderRecommendations.slice(0, 18).map(row => {
                  const rowKey = row.itemId || row.itemName;
                  const applied = isAiSuggestionApplied(row);
                  const selected = !!selectedAiOrderIds[rowKey];
                  const suggestedLabel = `${row.suggestedQty || 0}${row.packSize ? ` ${row.packSize}` : ''}`;
                  return (
                  <div key={rowKey} className={`rounded-xl border ${applied ? 'border-emerald-500/40 bg-emerald-950/10' : selected ? 'border-[#D4A381]/50 bg-[#D4A381]/5' : 'border-[#2A353D] bg-[#12161A]'} p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <input type="checkbox" checked={selected} onChange={() => toggleAiOrderSelection(row)} disabled={Number(row.suggestedQty || 0) <= 0} className="accent-[#D4A381]" /> Select
                        </label>
                        <span className="font-black text-white">{row.itemName}</span>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full border uppercase tracking-widest font-black ${row.priority === 'critical' ? 'text-red-300 border-red-500/50 bg-red-900/20' : row.priority === 'high' ? 'text-amber-300 border-amber-500/50 bg-amber-900/20' : 'text-slate-300 border-[#2A353D] bg-[#0B0E11]'}`}>{row.priority}</span>
                        <span className="text-[10px] text-[#D4A381] font-black">{row.vendorName}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-2"><div className="text-[8px] uppercase tracking-widest font-black text-emerald-300">Suggested</div><div className="text-xl font-black text-emerald-200">{suggestedLabel}</div></div>
                        <div className="rounded-lg border border-[#2A353D] bg-[#0B0E11] p-2"><div className="text-[8px] uppercase tracking-widest font-black text-slate-500">Par</div><div className="font-black text-white">{row.par}</div></div>
                        <div className="rounded-lg border border-[#2A353D] bg-[#0B0E11] p-2"><div className="text-[8px] uppercase tracking-widest font-black text-slate-500">Stock</div><div className="font-black text-white">{row.stock}</div></div>
                        <div className="rounded-lg border border-[#2A353D] bg-[#0B0E11] p-2"><div className="text-[8px] uppercase tracking-widest font-black text-slate-500">Pending</div><div className="font-black text-white">{row.pending}</div></div>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-2 leading-snug">{row.reasons.slice(0, 4).join(' • ') || 'Review item setup, par, and usage history.'}</div>
                      {row.priceWarning && <div className="mt-1 text-[10px] font-black text-red-300">⚠ {row.priceWarning.summary}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button type="button" disabled={applied || Number(row.suggestedQty || 0) <= 0} onClick={() => applyAiOrderRows([row], { label: 'suggested' })} className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase ${applied ? 'border-emerald-500/40 bg-slate-800 text-slate-400 cursor-default' : 'border-[#2A353D] bg-[#0B0E11] text-[#D4A381] hover:border-[#D4A381]/60'}`}>{applied ? 'Applied ✓' : 'Use Suggested Qty'}</button>
                      {applied && <button type="button" onClick={() => undoAiSuggestedQty(row)} className="px-3 py-2 rounded-lg border border-[#2A353D] bg-[#0B0E11] text-slate-300 text-[10px] font-black uppercase">Undo</button>}
                    </div>
                  </div>
                  );
                }) : <SmartEmptyState icon={<Check size={22}/>} title="No order pressure detected" desc="Set par levels, inventory stock, vendors, menu links, events, and invoice history to sharpen the assistant." />}
              </div>
            </div>

            <div className="space-y-4">
              <div className={`${T.card} p-4`}>
                <h3 className="font-black text-white text-lg mb-3">Vendor Drafts</h3>
                <div className="space-y-2">{aiOrderDraftGroups.length ? aiOrderDraftGroups.map(group => <div key={group.vendorId || group.vendorName} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="flex justify-between gap-2"><div><div className="font-black text-white">{group.vendorName}</div><div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{group.items.length} items • est. ${Number(group.total||0).toFixed(2)}</div></div><button type="button" onClick={() => handleReviewAiOrder(group)} className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Review</button></div></div>) : <p className="text-xs text-slate-500 font-bold">No vendor draft yet.</p>}</div>
              </div>
              <div className={`${T.card} p-4`}>
                <h3 className="font-black text-white text-lg mb-3">Manager Brief</h3>
                <div className="space-y-2">{aiOrderAssistant.managerBrief.map((line, idx) => <div key={idx} className="rounded-xl bg-[#12161A] border border-[#2A353D] p-3 text-xs font-bold text-slate-300 leading-snug">{line}</div>)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Event Supply Planning</h3><div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">{aiOrderAssistant.eventNeeds.length ? aiOrderAssistant.eventNeeds.map((row, idx) => <div key={idx} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">{row.date}</div><div className="font-black text-white">{row.event.title || 'Event'}</div><div className="text-[11px] text-slate-400 font-bold mt-1">{[...row.items.map(i => i.itemName), ...row.mentionedItems.map(m => m.item.name)].slice(0, 8).join(', ') || 'Review notes/menu.'}</div></div>) : <p className="text-xs text-slate-500 font-bold">No event supply signals in this window.</p>}</div></div>
            <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Prep Prediction</h3><div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">{aiOrderAssistant.prepSuggestions.length ? aiOrderAssistant.prepSuggestions.map((row, idx) => <div key={idx} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="font-black text-white">{row.text}</div><div className="text-[11px] text-slate-400 font-bold mt-1">{row.reason}</div></div>) : <p className="text-xs text-slate-500 font-bold">Prep suggestions appear when prep, events, or low-stock items line up.</p>}</div></div>
            <div className={`${T.card} p-4`}><h3 className="font-black text-white text-lg mb-3">Warnings</h3><div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">{[...aiOrderAssistant.priceWarnings.map(w => w.summary), ...aiOrderAssistant.wasteWarnings.map(w => w.summary)].length ? [...aiOrderAssistant.priceWarnings.map(w => w.summary), ...aiOrderAssistant.wasteWarnings.map(w => w.summary)].slice(0, 10).map((line, idx) => <div key={idx} className="rounded-xl border border-red-500/30 bg-red-950/10 p-3 text-xs font-bold text-red-100 leading-snug">{line}</div>) : <p className="text-xs text-slate-500 font-bold">No invoice price or waste warnings detected.</p>}</div></div>
          </div>
        </div>
      )}

      {hasInvPerms && invTab === 'order' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          
          {pendingVendors.length > 0 && (
            <div className="mb-6 space-y-4">
              <h3 className="text-sm font-black text-emerald-400 border-b border-[#2A353D] pb-2 uppercase tracking-widest">Inbound Deliveries</h3>
              {pendingVendors.map(vendor => {
                 const vItems = inventoryItems.filter(i => i.supplierId === vendor.id && (i.pendingQty || 0) > 0);
                 return (
                   <div key={`pending-${vendor.id}`} className={`${T.card} overflow-hidden border-emerald-900/50`}>
                     <div className={`p-4 bg-[#12161A] border-b ${T.border} flex justify-between items-center`}>
                       <h3 className="font-black text-lg text-white">{vendor.name} Delivery</h3>
                       <span className={`bg-emerald-900/20 border border-emerald-500/50 text-emerald-400 px-3 py-1 rounded-full font-black text-[10px] uppercase`}>{vItems.length} Pending</span>
                     </div>
                     <div className="p-4 space-y-2">
                       {vItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-sm font-bold text-slate-300">
                            <span className="truncate pr-4">{item.name} <span className="text-[10px] text-slate-500 font-normal">({item.packSize})</span></span>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-black">+</span>
                              <input type="number" min="0" value={item.pendingQty} onChange={(e) => handleUpdatePendingQty(item.id, e.target.value)} className="w-16 bg-[#1A2126] border border-[#2A353D] text-emerald-400 font-black text-center py-1 rounded outline-none" />
                            </div>
                          </div>
                       ))}
                     </div>
                     <div className={`p-4 bg-[#12161A] border-t ${T.border} flex gap-2`}>
                       <button onClick={() => handleReceiveDelivery(vendor.id)} className={`flex-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-black py-2 rounded-xl transition-colors`}>✅ Accept & Add</button>
                       <button onClick={() => handleCancelDelivery(vendor.id)} className={`px-4 bg-red-900/20 hover:bg-red-900 border border-red-500/50 text-red-400 hover:text-white font-black py-2 rounded-xl transition-colors`} title="Cancel Order"><X size={18}/></button>
                     </div>
                   </div>
                 )
              })}
            </div>
          )}

          {vendorsWithDeficits.length === 0 ? <div className={`${T.card} p-8 text-center text-slate-400 font-bold`}>No deficit alerts.</div> : vendorsWithDeficits.map(vendor => {
              const vendorItems = itemsToOrder.filter(i => i.supplierId === vendor.id);
              return (
                <div key={vendor.id} className={`${T.card} overflow-hidden`}>
                  <div className={`p-4 bg-[#12161A] border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-lg text-white">{vendor.name} Order</h3><span className={`bg-[#1A2126] border ${T.border} ${T.copper} px-3 py-1 rounded-full font-black text-[10px] uppercase`}>{vendorItems.length} Items</span></div>
                  <table className="w-full text-left">
                    <tbody className={`divide-y ${T.border}`}>{vendorItems.map(item => {
                      const deficit = Math.max(0, (item.parLevel||0) - (item.currentStock||0));
                      const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.ceil(deficit);
                      return (
                        <tr key={item.id} className={T.row}>
                          <td className="p-3"><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-[9px] font-bold ${T.muted} uppercase`}>Par: {item.parLevel||0}   Case: ${Number(item.price||0).toFixed(2)}</span></td>
                          <td className="p-3"><div className="flex items-center justify-end gap-1"><button onClick={()=>handleOrderChange(item.id, -1, currentOrder)} className={`w-8 h-8 rounded-lg bg-[#12161A] border ${T.border} font-bold text-white`}>-</button><input type="number" min="0" value={currentOrder} onChange={e=>setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))} className={`w-12 h-8 text-center font-black bg-[#12161A] border ${T.border} ${T.copper} rounded-lg outline-none`}/><button onClick={()=>handleOrderChange(item.id, 1, currentOrder)} className={`w-8 h-8 rounded-lg bg-[#12161A] border ${T.border} font-bold text-white`}>+</button></div></td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                  <div className={`p-4 bg-[#12161A] border-t ${T.border} text-right`}><button onClick={()=>handleReviewOrder(vendor.id)} className={`${T.btn} px-4 py-2 flex items-center justify-center gap-2 ml-auto`}><Check size={16}/> Dispatch</button></div>
                </div>
              )
            })
          }
        </div>
      )}

      {hasInvPerms && invTab === 'manage' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">
             {editItem && (
               <form onSubmit={handleSaveEdit} className="space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="col-span-2 sm:col-span-1">
                     <label className={T.label}>Product Number / SKU</label>
                     <input type="text" value={editItem.pfgCode || ''} onChange={e => setEditItem({...editItem, pfgCode: e.target.value})} className={T.input} />
                   </div>
                   <div className="col-span-2 sm:col-span-1">
                     <label className={T.label}>Name</label>
                     <input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className={T.input} required />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className={T.label}>Category</label>
                     <select value={editItem.category || 'Produce'} onChange={e => setEditItem({...editItem, category: e.target.value})} className={T.input}>
                       {['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className={T.label}>Vendor</label>
                     <select value={editItem.supplierId || ''} onChange={e => setEditItem({...editItem, supplierId: e.target.value})} className={T.input} required>
                       <option value="">Select...</option>
                       {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                     </select>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className={T.label}>Case Price ($)</label>
                     <input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className={T.input} />
                   </div>
                   <div>
                     <label className={T.label}>Units per Case / Yield</label>
                     <input type="number" min="0" step="any" value={editItem.yieldQty || 1} onChange={e => setEditItem({...editItem, yieldQty: e.target.value})} className={T.input} required />
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                   <div>
                     <label className={T.label}>Default Burn Mode</label>
                     <select value={editItem.burnDefaultMode || 'count'} onChange={e => setEditItem({...editItem, burnDefaultMode: e.target.value})} className={T.input}>
                       <option value="count">Count / each</option>
                       <option value="weight">Weight / lbs</option>
                       <option value="stock">Whole case/stock unit</option>
                       <option value="recordOnly">Record only</option>
                     </select>
                   </div>
                   <div>
                     <label className={T.label}>Weight per Stock Unit (lbs)</label>
                     <input type="number" min="0" step="any" value={editItem.weightPerStockUnit || ''} onChange={e => setEditItem({...editItem, weightPerStockUnit: e.target.value})} className={T.input} placeholder="Ex: 5" />
                   </div>
                   <div>
                     <label className={T.label}>Burn Unit Label</label>
                     <input type="text" value={editItem.burnUnitLabel || ''} onChange={e => setEditItem({...editItem, burnUnitLabel: e.target.value})} className={T.input} placeholder="breast, patty, lb..." />
                   </div>
                   <div className="sm:col-span-3 text-[10px] text-slate-400 font-bold leading-snug">
                     Burn setup controls how waste deducts stock. For 2/5 lb chicken, set Weight per Stock Unit to 5 and use Weight mode when logging pounds. For 24-count cases, set yield to 24 and use Count mode.
                   </div>
                 </div>
                 <button type="submit" className={`w-full ${T.btn}`}>Save Changes</button>
               </form>
             )}
          </Modal>

          <div className="flex flex-col gap-3 mb-6">
            
            {/* INVOICE SCANNER: Split Camera & Upload */}
            {canUseSmartInventory ? (
              <>
            <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-black text-white">Invoice AI pages: {invoiceUsageSummary.used} / {invoiceUsageSummary.limit} quota · {invoiceUsageSummary.processed} actually processed this month</div>
                <button type="button" onClick={loadInvoiceAiUsage} disabled={invoiceAiUsageLoading} className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] disabled:opacity-50">{invoiceAiUsageLoading ? 'Refreshing…' : 'Refresh'}</button>
              </div>
              {invoiceAiExempt && <div className="mt-1 text-[10px] font-bold text-blue-300">Testing bypass active. Processed pages are logged separately and do not consume the customer quota.</div>}
              {!invoiceAiExempt && invoiceUsageWarning && <div className={`mt-1 text-[10px] font-bold ${invoiceUsageSummary.reached ? 'text-red-300' : 'text-amber-300'}`}>{invoiceUsageWarning}</div>}
            </div>
            <div id="invoice-scanner-panel" className={`flex bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-16 ${(isScanningInvoice || (!invoiceAiExempt && invoiceUsageSummary.reached)) ? 'opacity-60 pointer-events-none' : ''}`}>
               <label className="w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                  {isScanningInvoice ? <span className="text-[11px] font-black tabular-nums">{invoiceScanProgress.percent}%</span> : <Camera size={24} />}
                  <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleScanInvoice} className="hidden" disabled={isScanningInvoice || (!invoiceAiExempt && invoiceUsageSummary.reached)} />
               </label>
               <label className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381] font-black uppercase tracking-widest text-[11px] sm:text-xs" title="Upload Photo or PDF">
                  <span>{isScanningInvoice ? 'Scanning Invoice...' : '📄 Scan Invoice (PDF/Photo)'}</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleScanInvoice} className="hidden" disabled={isScanningInvoice || (!invoiceAiExempt && invoiceUsageSummary.reached)} />
               </label>
            </div>
            {!invoiceAiExempt && invoiceUsageSummary.reached && <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-[11px] font-bold text-red-200">This restaurant has used all invoice AI pages for this month.</div>}
            {(isScanningInvoice || invoiceScanProgress.phase === 'error') && (
              <div className={`bg-[#12161A] border rounded-xl p-3 shadow-sm ${invoiceScanProgress.phase === 'error' ? 'border-red-500/40' : 'border-[#2A353D]'}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${invoiceScanProgress.phase === 'error' ? 'text-red-300' : 'text-[#D4A381]'}`}>
                    {invoiceScanProgress.phase === 'error' ? 'Invoice scan stopped' : 'Invoice scan progress'}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 tabular-nums">{invoiceScanProgress.percent}%</div>
                </div>
                <div className="h-3 bg-[#0B0E11] rounded-full overflow-hidden border border-[#2A353D]">
                  <div className={`h-full transition-all duration-300 ${invoiceScanProgress.phase === 'error' ? 'bg-red-500' : 'bg-[#D4A381]'}`} style={{ width: `${invoiceScanProgress.percent}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-slate-400 font-bold leading-snug">
                  {invoiceScanProgress.label}
                </div>
                {isScanningInvoice && <div className="mt-1 text-[10px] text-slate-500 font-bold">Keep this page open. Upload percentage is exact; large-document AI scanning shows the current stage and elapsed time.</div>}
              </div>
            )}

              </>
            ) : (
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Smart Kitchen Required</div>
                <div className="text-sm font-black text-white mt-1">Invoice AI scanning is locked on this plan.</div>
                <p className="text-xs font-bold text-amber-100/80 mt-1">Operations can still use basic inventory, ordering, vendors, and burn log tools. Smart Kitchen unlocks invoice scanning, invoice totals, COGS, vendor spend, and menu dependency tools.</p>
              </div>
            )}

            {/* CSV IMPORT */}
            <label className={`flex items-center justify-center gap-2 bg-[#12161A] text-slate-300 border border-[#2A353D] hover:bg-[#1A2126] font-black uppercase tracking-widest h-16 rounded-xl shadow-lg transition-all cursor-pointer`}>
              <span className="text-[11px] sm:text-xs">📊 Import CSV</span>
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            </label>

          </div>

          <form onSubmit={handleAddItem} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest">Add New Item</h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <input type="text" placeholder="Prod # / SKU" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)} className={`${T.input} col-span-2 sm:col-span-1 py-1.5 text-xs`} />
              <input type="text" placeholder="Item Name..." value={newItemName} onChange={e=>setNewItemName(e.target.value)} className={`${T.input} col-span-2 py-1.5 text-xs`} required/>
              <select value={newItemCat} onChange={e=>setNewItemCat(e.target.value)} className={`${T.input} col-span-2 sm:col-span-1 py-1.5 text-xs`}><option disabled value="">Category...</option>{['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}</select>
              <select value={newItemSupplier} onChange={e=>setNewItemSupplier(e.target.value)} className={`${T.input} col-span-2 sm:col-span-1 py-1.5 text-xs`} required><option value="">Vendor...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
              <input type="number" step="0.01" placeholder="Case $" value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} className={`${T.input} col-span-1 py-1.5 text-xs`}/>
              <input type="number" min="1" placeholder="Yield" value={newItemYield} onChange={e=>setNewItemYield(e.target.value)} className={`${T.input} col-span-1 py-1.5 text-xs`} required/>
            </div>
            <div className="flex justify-end mt-2">
              <button type="submit" className={`w-full sm:w-auto ${T.btn} py-2 px-6`}><Plus size={18} className="inline mr-2"/> Add to Master List</button>
            </div>
          </form>

          {/* SEARCH BAR */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A381]" size={20}/>
            <input type="text" placeholder="Search master list by name or product number..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className={`${T.input} pl-12`}/>
          </div>

          <div className={`${T.card} divide-y ${T.border}`}>{inventoryItems.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).map(item => (<div key={item.id} className={`${T.row} flex justify-between items-center`}><div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name} <span className="text-[10px] text-slate-500 font-normal">{item.pfgCode ? `[${item.pfgCode}]` : ''}</span></div><div className="text-[10px] text-[#D4A381] font-black uppercase mt-0.5 tracking-widest">Case: ${Number(item.price||0).toFixed(2)}   Yield: {item.yieldQty||1}</div></div><div className="flex gap-2"><button onClick={()=>setEditItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button><button onClick={() => { if(window.confirm(`Are you sure you want to delete ${item.name}?`)) safeInventoryWrite({ action: "delete", collectionName: "inventoryItems", docId: item.id, label: "Inventory item", before: item }); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
        </div>
      )}

      {hasInvPerms && invTab === 'vendors' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleAddVendor} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest">Add Vendor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="text" placeholder="Company Name..." value={vName} onChange={e=>setVName(e.target.value)} className={T.input} required/><input type="text" placeholder="Rep Name..." value={vRep} onChange={e=>setVRep(e.target.value)} className={T.input}/><input type="tel" placeholder="Phone (For SMS Orders)" value={vPhone} onChange={e=>setVPhone(e.target.value)} className={T.input}/><input type="email" placeholder="Email (For PDF Orders)" value={vEmail} onChange={e=>setVEmail(e.target.value)} className={T.input}/></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={T.label}>Cut-Off Time</label><input type="time" value={vTime} onChange={e=>setVTime(e.target.value)} className={T.input}/></div>
              <div><label className={T.label}>Cut-Off Days</label><div className="flex flex-wrap gap-1 mt-1">{weekDays.map(d=><button type="button" key={d} onClick={()=>toggleVendorDay(d)} className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${vDays.includes(d) ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#12161A] text-slate-400 border-[#2A353D]'}`}>{d.substring(0,3)}</button>)}</div></div>
            </div>
            <button type="submit" className={`w-full ${T.btn} py-2`}>Save Vendor</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{vendors.map(v => (<div key={v.id} className={`${T.card} p-4`}><div className="flex justify-between items-start"><h4 className="font-black text-white text-lg">{v.name}</h4><button onClick={()=>setEditVendor(v)} className="text-slate-400 hover:text-white"><Edit size={14}/></button></div><div className={`text-xs font-bold ${T.muted} mt-1 space-y-1`}><p>Rep: {v.rep || 'N/A'}</p><p>Phone: {v.phone || 'N/A'}</p><p>Email: {v.email || 'N/A'}</p><p className="text-[#D4A381] mt-2">Cut-Off: {v.cutOffDays?.length > 0 ? v.cutOffDays.join(', ') : 'None'} {v.cutOffTime ? `@ ${v.cutOffTime}` : ''}</p></div><button onClick={()=>safeInventoryWrite({ action: "delete", collectionName: "vendors", docId: v.id, label: "Vendor", before: v })} className="mt-4 text-[10px] uppercase font-black tracking-widest text-red-500 hover:text-red-400">Remove Vendor</button></div>))}</div>
        </div>
      )}

      {hasInvPerms && invTab === 'invoices' && canUseSmartInventory && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className="font-black text-sm text-white flex items-center gap-2">Invoice History</h3>
              <div className="flex items-center gap-2"><button onClick={printInvoiceHistory} className="bg-[#1A2126] text-[#D4A381] px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">Print</button><span className="bg-[#1A2126] text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">{invoices.length} Total</span></div>
            </div>
            <div className={`divide-y ${T.border} max-h-[60vh] overflow-y-auto custom-scrollbar`}>
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold">No invoices logged yet.</div>
              ) : (
                invoices.sort((a,b) => new Date(b.processedAt || 0) - new Date(a.processedAt || 0)).map(inv => (
                  <div key={inv.id} className={`${T.row} flex justify-between items-center p-4`}>
                    <div>
                      <div className="font-black text-white text-base">{inv.vendorName}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inv Date: {inv.invoiceDate}</div>
                      <div className="text-[9px] text-slate-500 mt-1">Processed by {inv.processedBy} on {new Date(inv.processedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-emerald-400 font-black text-lg">${Number(inv.invoiceTotal || 0).toFixed(2)}</div>
                      <button onClick={() => setViewInvoice(inv)} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">View</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {hasInvPerms && invTab === 'invoices' && !canUseSmartInventory && (
        <div className={`${T.card} p-5 text-center space-y-2 border-amber-900/40`}>
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Smart Kitchen Required</div>
          <h3 className="text-xl font-black text-white">Invoice scanning and invoice history are locked on this plan.</h3>
          <p className="text-sm font-bold text-slate-400">Operations keeps basic inventory and burn log tools. Invoice scanning, invoice totals, COGS, and vendor spend unlock with Smart Kitchen.</p>
        </div>
      )}

      {invTab === 'waste' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          
          <Modal isOpen={!!editWaste} onClose={() => setEditWaste(null)} title="Edit Burn Log">
            {editWaste && (
              <form onSubmit={handleSaveWasteEdit} className="space-y-3">
                <div><label className={T.label}>Item</label><input type="text" value={editWaste.itemName} disabled className={`${T.input} opacity-50 cursor-not-allowed`} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={T.label}>Qty Wasted</label><input type="number" min="1" value={editWaste.qty} onChange={e=>setEditWaste({...editWaste, qty: e.target.value})} className={T.input} required/></div>
                  <div><label className={T.label}>Reason</label><select value={editWaste.reason} onChange={e=>setEditWaste({...editWaste, reason: e.target.value})} className={T.input}><option>Dropped / Spilled</option><option>Expired / Bad Quality</option><option>Cooked Incorrectly</option><option>Comped</option></select></div>
                </div>
                <button type="submit" className={`w-full ${T.btn} mt-2`}>Update & Adjust Stock</button>
              </form>
            )}
          </Modal>

          <form onSubmit={handleLogWaste} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
<h3 className="text-sm font-black uppercase text-red-400 tracking-widest flex items-center gap-2">
              🚨 The Burn Log
              <span className="inventory-preview-badge bg-red-900/30 text-red-300 border border-red-500/50 text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black shadow-[0_0_8px_rgba(239,68,68,0.2)]">Preview</span>
            </h3>            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              
              {/* THE FILTERABLE DROPDOWN */}
              <div className="space-y-2">
                <input type="text" placeholder="Type to filter inventory..." value={wSearchTerm} onChange={e=>setWSearchTerm(e.target.value)} className={`${T.input} py-2 text-xs border-red-900/30 focus:border-red-500`} />
                <select value={wItemId} onChange={e=>handleWasteItemSelect(e.target.value)} className={T.input} required>
                  <option value="">Select Item to Burn...</option>
                  {orderableInventoryItems
                    .filter(i => (i.name||'').toLowerCase().includes((wSearchTerm||'').toLowerCase()) || (i.pfgCode||'').toLowerCase().includes((wSearchTerm||'').toLowerCase()))
                    .map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <select value={wMode} onChange={e=>setWMode(e.target.value)} className={`${T.input} text-xs`}>
                  <option value="count">Count / each / portion</option>
                  <option value="weight">Weight in pounds</option>
                  <option value="stock">Whole stock units / cases</option>
                  <option value="recordOnly">Record only, do not deduct stock</option>
                </select>
                <input type="number" min="0" step="any" placeholder={wMode === 'weight' ? 'Pounds wasted...' : wMode === 'stock' ? 'Cases/stock units wasted...' : 'Items/portions wasted...'} value={wQty} onChange={e=>setWQty(e.target.value)} className={T.input} required/>
                {wMode === 'weight' && <input type="number" min="0" step="any" placeholder="Lbs in one stock unit/case..." value={wWeightPerStockUnit} onChange={e=>setWWeightPerStockUnit(e.target.value)} className={`${T.input} text-xs border-red-900/40`} required/>}
                {wMode === 'count' && <input type="text" placeholder="Unit label, ex: breast, patty, bottle..." value={wUnitLabel} onChange={e=>setWUnitLabel(e.target.value)} className={`${T.input} text-xs border-red-900/40`}/>} 
                {selectedWasteItem && <div className="mt-2 rounded-lg border border-red-900/40 bg-red-950/10 p-2 text-[10px] font-bold text-red-100 leading-snug space-y-1">
                  <div>{selectedWasteItem.name}</div>
                  {wMode === 'count' && <div>{selectedWasteUnitsPerStock > 1 ? `1 stock unit = ${selectedWasteUnitsPerStock} ${wUnitLabel || 'units'}` : '1 stock unit = 1 unit unless you set a yield on the item.'}</div>}
                  {wMode === 'weight' && <div>1 stock unit = {selectedWasteWeightPerStock || '___'} lb. Example: 2 lb burned from a 5 lb pack deducts 0.4 stock units.</div>}
                  {selectedWastePackProfile.notes?.length > 0 && <div className="text-slate-400">Auto-read: {selectedWastePackProfile.notes.join(' • ')}</div>}
                  {wQty && <div className="text-red-300">This burn will deduct {selectedWasteDeductionPreview.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')} from stock.</div>}
                </div>}
              </div>
              
              <div className="space-y-2">
                <select value={wReason} onChange={e=>setWReason(e.target.value)} className={T.input}>
                  <option>Dropped / Spilled</option>
                  <option>Expired / Bad Quality</option>
                  <option>Cooked Incorrectly</option>
                  <option>Comped</option>
                  <option>Trim Loss / Waste</option>
                  <option>No Quantity / Note Only</option>
                </select>
                <div className="text-[10px] text-slate-500 font-bold leading-snug border border-[#2A353D] rounded-lg p-2 bg-[#12161A]">
                  Use <b>Count</b> for bottles, burgers, portions, breasts when the item has a yield. Use <b>Weight</b> for catch-weight items like chicken, beef, cheese, and produce. Use <b>Record only</b> when it should not affect inventory.
                </div>
              </div>
            </div>
            <button type="submit" className={`w-full bg-red-900/50 hover:bg-red-900 border border-red-500/50 text-white font-black tracking-widest uppercase text-sm py-2 rounded-xl transition-colors mt-2`}>
              Log Waste & Deduct Stock
            </button>
          </form>
          
          {/* SEARCH BAR */}
          <div className="relative w-full mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" size={20}/>
            <input type="text" placeholder="Search logs by item, reason, person, or date..." value={wasteSearch} onChange={(e)=>setWasteSearch(e.target.value)} className={`${T.input} pl-12 border-red-900/30 focus:border-red-500/50`}/>
          </div>

          <div className={`${T.card} divide-y ${T.border}`}>
            <div className={T.th}><span>{wasteSearch ? 'Search Results' : "Today's Burn"}</span></div>
            {wasteLogs.filter(w => wasteSearch ? (w.itemName+w.reason+w.loggedBy+w.date).toLowerCase().includes(wasteSearch.toLowerCase()) : w.date === getToday()).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(w => (
              <div key={w.id} className={`${T.row} flex justify-between items-center`}>
                <div className="flex-1"> 
                  <span className="font-bold text-white text-sm block">{w.qty} {w.burnUnitLabel || (w.burnMode === 'weight' ? 'lb' : 'x')} {w.itemName}</span>
                  <span className={`text-[9px] font-bold ${T.muted} uppercase`}>{w.date} • {w.reason} • Stock -{Number(w.stockDeducted || 0).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}   By {w.loggedBy}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-black text-red-400 text-sm">-${w.costLost?.toFixed(2)}</div>
                  <div className="flex gap-1 border-l border-[#2A353D] pl-3 ml-1">
                    <button onClick={() => setEditWaste({...w})} className="p-1.5 text-slate-400 hover:text-white transition-colors"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteWaste(w)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
            {wasteLogs.filter(w => wasteSearch ? (w.itemName+w.reason+w.loggedBy+w.date).toLowerCase().includes(wasteSearch.toLowerCase()) : w.date === getToday()).length === 0 && <div className="p-4 text-center text-slate-400 font-bold text-sm">No waste logs found.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export { TabInventory };
