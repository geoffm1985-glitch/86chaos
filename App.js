import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  X,
  BookOpen,
  Camera,
  Loader2,
  Printer,
  Image as ImageIcon,
  Package,
  ShoppingCart,
  ClipboardList,
  Filter,
  Menu,
  Settings,
} from "lucide-react";

// --- Firebase Initialization ---
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA",
  authDomain: "cheers-34b8d.firebaseapp.com",
  projectId: "cheers-34b8d",
  storageBucket: "cheers-34b8d.firebasestorage.app",
  messagingSenderId: "762225019248",
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5",
  measurementId: "G-JFZ6EZB0E3",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Helper Functions ---
const formatDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
};
const getToday = () => formatDate(new Date());
const addDays = (dateStr, days) => {
  if (!dateStr) return getToday();
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return formatDate(d);
};
const getMonthStr = (dateStr) => (dateStr || getToday()).substring(0, 7);
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const options = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", options);
};
const formatDisplayMonth = (monthStr) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};
const getDaysInMonth = (monthStr) => {
  if (!monthStr) return 30;
  const [year, month] = monthStr.split("-");
  const date = new Date(year, month, 0);
  return date.getDate();
};
const getShiftHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [h1, m1] = startTime.split(":").map(Number);
  const [h2, m2] = endTime.split(":").map(Number);
  let diff = h2 + m2 / 60 - (h1 + m1 / 60);
  if (diff < 0) diff += 24;
  return diff;
};
const getWeekRange = (dateStr) => {
  if (!dateStr) return { start: "", end: "" };
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return { start: "", end: "" };
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
};
const formatTime12Hour = (time24) => {
  if (!time24 || typeof time24 !== "string" || !time24.includes(":"))
    return String(time24 || "");
  let [hours, minutes] = time24.split(":");
  hours = parseInt(hours, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

// --- SVG Logo ---
const CheersLogo = () => (
  <svg
    viewBox="0 0 400 120"
    className="h-10 sm:h-12 w-auto"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M190,20 C70,0 0,35 0,65 C0,95 100,110 270,110 L270,105 C100,105 30,95 30,65 C30,40 80,25 190,20 Z"
      className="text-zinc-900 print:text-black"
    />
    <text
      x="95"
      y="85"
      fontFamily="'Brush Script MT', 'Great Vibes', cursive, serif"
      fontStyle="italic"
      fontSize="90"
      fontWeight="900"
      className="text-zinc-900 print:text-black"
      letterSpacing="-1"
    >
      Cheers
    </text>
    <text
      x="275"
      y="110"
      fontFamily="'Times New Roman', Georgia, serif"
      fontSize="28"
      className="text-zinc-900 print:text-black"
    >
      Chilton
    </text>
  </svg>
);

// --- Custom Modal ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
        <div className="flex justify-between items-center p-4 border-b border-zinc-200 bg-zinc-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-zinc-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-200 rounded-full text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// --- Navigation Drawer Component ---
const DrawerMenu = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  appUser,
  setAppUser,
  unread,
}) => {
  if (!isOpen) return null;

  const tabs = [
    { id: "schedule", label: "Schedule", icon: <Calendar size={20} /> },
    { id: "month", label: "Month View", icon: <Calendar size={20} /> },
    { id: "timeoff", label: "Time Off", icon: <Clock size={20} /> },
  ];

  if (appUser?.isAdmin || appUser?.role === "Kitchen") {
    tabs.push({
      id: "prep",
      label: "Prep List",
      icon: <ClipboardList size={20} />,
    });
    tabs.push({
      id: "recipes",
      label: "Recipes",
      icon: <BookOpen size={20} />,
    });
  }

  if (appUser?.isAdmin) {
    tabs.push({
      id: "inventory",
      label: "Inventory",
      icon: <Package size={20} />,
    });
  }

  tabs.push({
    id: "messages",
    label: "Messages",
    badge: unread > 0,
    icon: <MessageSquare size={20} />,
  });
  tabs.push({ id: "team", label: "Team", icon: <Users size={20} /> });
  tabs.push({
    id: "settings",
    label: "Settings",
    icon: <Settings size={20} />,
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      <div className="w-72 sm:w-80 bg-white h-full shadow-2xl flex flex-col relative border-l border-zinc-200 animate-slide-in">
        <div className="p-6 border-b border-zinc-200 flex justify-between items-start bg-zinc-50">
          <div>
            <div className="text-sm text-zinc-500 mb-1">Signed in as</div>
            <div className="text-zinc-900 font-bold text-lg leading-tight">
              {appUser.name}
            </div>
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-1">
              {appUser.role} {appUser.isAdmin && "• Admin"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-200 rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-300 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white shadow-md"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {tab.icon}
                {tab.label}
              </div>
              {tab.badge && (
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-md"></span>
              )}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={() => {
              setAppUser(null);
              onClose();
            }}
            className="w-full py-3 text-red-600 font-bold rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Application ---
export default function App() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [prepItems, setPrepItems] = useState([
    {
      id: "mock1",
      date: getToday(),
      text: "Bacon jam",
      qty: "2",
      unit: "qts",
      isCompleted: false,
      notifyStaff: true,
    },
    {
      id: "mock2",
      date: getToday(),
      text: "Chili base",
      qty: "4",
      unit: "qts",
      isCompleted: true,
      notifyStaff: false,
    },
  ]);
  const [recipes, setRecipes] = useState([
    {
      id: "r1",
      title: "House Bacon Jam",
      ingredients: [
        { text: "2 lbs Bacon", isDone: false },
        { text: "1 Onion", isDone: false },
        { text: "1/2 cup Sugar", isDone: false },
      ],
      steps: [
        { text: "Render bacon.", isDone: false },
        { text: "Sauté onions.", isDone: false },
        { text: "Simmer 20 mins.", isDone: false },
      ],
    },
  ]);

  // Inventory State
  const [vendors, setVendors] = useState([
    {
      id: "v1",
      name: "Sysco",
      cutoffDays: ["Tuesday", "Friday"],
      cutoffTime: "16:00",
    },
    {
      id: "v2",
      name: "Local Farms Produce",
      cutoffDays: ["Monday", "Thursday"],
      cutoffTime: "14:00",
    },
  ]);
  const [inventoryItems, setInventoryItems] = useState([
    {
      id: "i1",
      name: "Chicken Breast",
      category: "Meat",
      vendorId: "v1",
      parLevel: 40,
      currentStock: 12,
      unit: "lbs",
    },
    {
      id: "i2",
      name: "Romaine Lettuce",
      category: "Produce",
      vendorId: "v2",
      parLevel: 15,
      currentStock: 4,
      unit: "cases",
    },
    {
      id: "i3",
      name: "Frying Oil",
      category: "Dry Goods",
      vendorId: "v1",
      parLevel: 10,
      currentStock: 2,
      unit: "jugs",
    },
  ]);

  const [timeOff, setTimeOff] = useState([]);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [meta, setMeta] = useState({});
  const [appUser, setAppUser] = useState(null);

  // Sync users with live Firestore database
  useEffect(() => {
    let unsubscribe = () => {};
    const initFirebase = async () => {
      try {
        await signInAnonymously(auth);
        unsubscribe = onSnapshot(
          collection(db, "users"),
          (snapshot) => {
            const usersData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setUsers(usersData);
          },
          (error) => {
            console.error("Firebase sync error:", error);
          }
        );
      } catch (err) {
        console.error("Firebase Auth error:", err);
      }
    };
    initFirebase();
    return () => unsubscribe();
  }, []);

  const mockDB = {
    users,
    setUsers,
    shifts,
    setShifts,
    prepItems,
    setPrepItems,
    recipes,
    setRecipes,
    timeOff,
    setTimeOff,
    messages,
    setMessages,
    templates,
    setTemplates,
    meta,
    setMeta,
    vendors,
    setVendors,
    inventoryItems,
    setInventoryItems,
  };

  const [activeTab, setActiveTab] = useState("schedule");
  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [settings, setSettings] = useState({
    notifPub: true,
    notifChanges: true,
    notifMsg: true,
    notifShift: true,
    notifInv: true,
    shiftReminderTime: 60,
  });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const liveAppUser = appUser
    ? users.find((u) => u.id === appUser.id) || appUser
    : null;

  // Access control redirect
  useEffect(() => {
    if (liveAppUser && !liveAppUser.isAdmin) {
      if (activeTab === "inventory") setActiveTab("schedule");
      if (
        liveAppUser.role !== "Kitchen" &&
        (activeTab === "prep" || activeTab === "recipes")
      ) {
        setActiveTab("schedule");
      }
    }
  }, [liveAppUser, activeTab]);

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      8000
    );
  };

  const prevMessagesRef = useRef(messages.length);
  useEffect(() => {
    if (
      messages.length > prevMessagesRef.current &&
      liveAppUser &&
      settings.notifMsg
    ) {
      const newMsg = messages[messages.length - 1];
      if (newMsg && newMsg.senderId !== liveAppUser.id) {
        const role = liveAppUser.role || "";
        const isRelevant =
          newMsg.threadId === "everyone" ||
          newMsg.threadId === role.toLowerCase() ||
          (liveAppUser.isAdmin && newMsg.threadId === "management") ||
          (newMsg.threadId || "").includes(liveAppUser.id);
        if (isRelevant) {
          const sender =
            users.find((u) => u.id === newMsg.senderId)?.name || "System";
          addToast(
            newMsg.threadId === "management" &&
              (newMsg.text || "").includes("shift swap")
              ? "Shift Swap Approval Needed"
              : `New Message from ${sender}`,
            newMsg.text || "📷 Sent an image"
          );
        }
      }
    }
    prevMessagesRef.current = messages.length;
  }, [messages, liveAppUser, users, settings.notifMsg]);

  if (!liveAppUser) {
    return <LoginScreen users={users} setAppUser={setAppUser} />;
  }

  const unreadMessagesCount = (messages || []).filter((m) => {
    if (m.senderId === liveAppUser.id) return false;
    const role = liveAppUser.role || "";
    const isRelevant =
      m.threadId === "everyone" ||
      m.threadId === role.toLowerCase() ||
      (liveAppUser.isAdmin && m.threadId === "management") ||
      (m.threadId || "").includes(liveAppUser.id);
    if (!isRelevant) return false;
    const lastRead = liveAppUser.readReceipts?.[m.threadId] || 0;
    return m.timestamp > lastRead;
  }).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col print:bg-white print:text-black">
      <style>{`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @media print {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        @page { size: landscape; margin: 0.5in; }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; color: black !important; }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            .print-full-width { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @keyframes slideIn {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      from { transform: translateX(100%); }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                to { transform: translateX(0); }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                .animate-slide-in { animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      `}</style>

      {/* Simplified Sticky Header */}
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-zinc-200 print:hidden h-20 flex items-center px-4 md:px-8">
        <CheersLogo />
      </header>

      {/* Floating Hamburger Menu Button */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="fixed top-4 right-4 md:top-4 md:right-8 z-40 p-3.5 bg-white border border-zinc-200 text-zinc-900 rounded-full shadow-lg hover:bg-zinc-50 hover:scale-105 active:scale-95 transition-all print:hidden flex items-center justify-center"
        title="Open Navigation Menu"
      >
        <Menu size={26} />
        {unreadMessagesCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-[3px] border-white rounded-full animate-pulse shadow-md"></span>
        )}
      </button>

      {/* The Drawer Overlay Component */}
      <DrawerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        appUser={liveAppUser}
        setAppUser={setAppUser}
        unread={unreadMessagesCount}
      />

      {/* Date Navigator Bar for Date-specific Tabs */}
      {["schedule", "prep", "month"].includes(activeTab) && (
        <div className="bg-white text-zinc-900 py-6 px-4 shadow-sm z-20 border-b border-zinc-200 relative overflow-hidden print:hidden">
          <div className="max-w-4xl mx-auto flex items-center justify-between relative z-10">
            <button
              onClick={() =>
                activeTab === "month"
                  ? setCurrentDate(addDays(currentDate, -30))
                  : setCurrentDate(addDays(currentDate, -1))
              }
              className="p-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors backdrop-blur-sm text-zinc-600 hover:text-zinc-900"
            >
              <ChevronLeft size={28} />
            </button>
            <h2
              onClick={() => setIsDateModalOpen(true)}
              className="text-3xl md:text-4xl font-extrabold tracking-tight text-center cursor-pointer hover:text-zinc-600 transition-colors"
              title="Click to jump to a specific date"
            >
              {activeTab === "month"
                ? formatDisplayMonth(getMonthStr(currentDate))
                : formatDisplayDate(currentDate)}
            </h2>
            <button
              onClick={() =>
                activeTab === "month"
                  ? setCurrentDate(addDays(currentDate, 30))
                  : setCurrentDate(addDays(currentDate, 1))
              }
              className="p-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors backdrop-blur-sm text-zinc-600 hover:text-zinc-900"
            >
              <ChevronRight size={28} />
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        title="Jump to Date"
      >
        <div className="space-y-4">
          <input
            type="date"
            value={currentDate || ""}
            onChange={(e) => {
              if (e.target.value) {
                setCurrentDate(e.target.value);
                setIsDateModalOpen(false);
              }
            }}
            className="w-full p-4 bg-white border border-zinc-300 text-zinc-900 rounded-xl text-lg font-bold outline-none focus:border-zinc-500 shadow-inner"
          />
          <button
            onClick={() => setIsDateModalOpen(false)}
            className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors"
          >
            Close Calendar
          </button>
        </div>
      </Modal>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 print-full-width mt-4">
        {activeTab === "schedule" && (
          <TabSchedule
            currentDate={currentDate}
            appUser={liveAppUser}
            mockDB={mockDB}
          />
        )}
        {activeTab === "month" && (
          <TabMonth
            currentDate={currentDate}
            appUser={liveAppUser}
            mockDB={mockDB}
            setCurrentDate={(d) => {
              setCurrentDate(d);
              setActiveTab("schedule");
            }}
          />
        )}
        {activeTab === "timeoff" && (
          <TabTimeOff appUser={liveAppUser} mockDB={mockDB} />
        )}
        {activeTab === "prep" && (
          <TabPrep
            currentDate={currentDate}
            appUser={liveAppUser}
            mockDB={mockDB}
          />
        )}
        {activeTab === "recipes" && (
          <TabRecipes appUser={liveAppUser} mockDB={mockDB} />
        )}
        {activeTab === "inventory" && (
          <TabInventory
            appUser={liveAppUser}
            mockDB={mockDB}
            addToast={addToast}
          />
        )}
        {activeTab === "messages" && (
          <TabMessages appUser={liveAppUser} mockDB={mockDB} />
        )}
        {activeTab === "team" && (
          <TabTeam appUser={liveAppUser} mockDB={mockDB} />
        )}
        {activeTab === "settings" && (
          <TabSettings
            settings={settings}
            setSettings={setSettings}
            addToast={addToast}
            appUser={liveAppUser}
            mockDB={mockDB}
            currentDate={currentDate}
          />
        )}
      </main>

      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-zinc-200 text-zinc-900 p-4 rounded-xl shadow-xl min-w-[250px] animate-fade-in pointer-events-auto flex items-start gap-3 border-l-4 border-l-amber-500"
          >
            <Bell className="text-amber-500 mt-0.5" size={18} />
            <div>
              <h4 className="font-bold text-sm">{t.title}</h4>
              <p className="text-sm text-zinc-600">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Live Firebase Login Screen ---
const LoginScreen = ({ users, setAppUser }) => {
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const usersRef = collection(db, "users");

      // If database is completely empty, bootstrap the first Admin account
      if (users.length === 0) {
        const trimmedName = name.trim();
        const newUser = {
          name: trimmedName,
          role: "Kitchen",
          isAdmin: true,
          phone: "",
          readReceipts: {},
          isActive: true,
        };
        const docRef = await addDoc(usersRef, newUser);
        setAppUser({ id: docRef.id, ...newUser });
        setIsLoading(false);
        return;
      }

      // If database has users, require a valid 6-digit invite code
      if (!inviteCode.trim()) {
        setError("An invite code is required to join this team.");
        setIsLoading(false);
        return;
      }

      const q = query(
        usersRef,
        where("inviteCode", "==", inviteCode.trim().toUpperCase())
      );
      const codeSnapshot = await getDocs(q);

      if (codeSnapshot.empty) {
        setError("Invalid invite code. Please check with management.");
        setIsLoading(false);
        return;
      }

      // Consume the invite code and log the user in securely
      const userDoc = codeSnapshot.docs[0];
      await updateDoc(doc(db, "users", userDoc.id), {
        inviteCode: null, // Delete code so it can't be reused
        isActive: true,
        name: name.trim() || userDoc.data().name,
      });

      setAppUser({
        id: userDoc.id,
        ...userDoc.data(),
        name: name.trim() || userDoc.data().name,
        isActive: true,
      });
    } catch (err) {
      setError(
        "Connection error. Ensure Firestore rules are set to Test Mode."
      );
      console.error(err);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 p-8 max-w-md w-full">
        <div className="flex justify-center mb-8">
          <CheersLogo />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-zinc-900">
          Welcome to Cheers employee portal
        </h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 outline-none text-zinc-900 placeholder-zinc-400"
              placeholder="e.g. Geoffrey"
              required
            />
          </div>

          {users.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-zinc-600 mb-1">
                6-Digit Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full p-3 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 outline-none text-zinc-900 font-mono tracking-widest uppercase"
                placeholder="A7X9P2"
                required
              />
            </div>
          ) : (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-200">
              You are the first user to access the database. This account will
              automatically be set as an Administrator.
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors mt-2 disabled:opacity-50"
          >
            {isLoading ? "Connecting..." : "Log In / Register"}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Tab: Team (Live Firestore Version) ---
const TabTeam = ({ appUser, mockDB }) => {
  const { users = [] } = mockDB || {};
  const [name, setName] = useState("");
  const [role, setRole] = useState("Bartender");
  const [phone, setPhone] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsAdding(true);
    setInviteResult(null);

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      await addDoc(collection(db, "users"), {
        name: name.trim(),
        role,
        isAdmin,
        phone: phone.trim(),
        readReceipts: {},
        inviteCode: inviteCode,
        isActive: false,
      });
      setInviteResult({ name: name.trim(), code: inviteCode });
      setName("");
      setPhone("");
      setIsAdmin(false);
    } catch (err) {
      console.error("Error adding document: ", err);
      setInviteResult({
        error: "Failed to add user. Ensure Firebase database is active.",
      });
    }
    setIsAdding(false);
  };

  const updateRole = async (id, newRole) => {
    await updateDoc(doc(db, "users", id), { role: newRole });
  };
  const updatePhone = async (id, newPhone) => {
    await updateDoc(doc(db, "users", id), { phone: newPhone });
  };
  const toggleAdmin = async (id, currentAdmin) => {
    await updateDoc(doc(db, "users", id), { isAdmin: !currentAdmin });
  };
  const deleteUser = async (id) => {
    if (window.confirm("Remove this user permanently?")) {
      await import("firebase/firestore").then((module) =>
        module.deleteDoc(doc(db, "users", id))
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {appUser?.isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <form
            onSubmit={handleAdd}
            className="flex flex-col sm:flex-row gap-4 items-end"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                New Team Member Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 bg-zinc-50 border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 shadow-inner"
                required
              />
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 bg-zinc-50 border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 shadow-inner"
                placeholder="555-0123"
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-3 bg-zinc-50 border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 shadow-inner"
              >
                <option value="Bartender">Bartender</option>
                <option value="Kitchen">Kitchen</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 pb-3 hover:text-zinc-900 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="rounded bg-white border-zinc-300 focus:ring-zinc-500"
              />{" "}
              Admin
            </label>
            <button
              type="submit"
              disabled={isAdding}
              className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 w-full sm:w-auto transition-colors shadow-sm disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add"}
            </button>
          </form>

          {inviteResult && inviteResult.code && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl animate-fade-in flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <strong className="text-green-800 block text-lg">
                  Success! {inviteResult.name} added.
                </strong>
                <span className="text-green-700 text-sm">
                  Send them the link to this app and their unique code:
                </span>
              </div>
              <div className="bg-white border-2 border-green-300 text-green-900 text-2xl font-mono font-black tracking-widest px-6 py-3 rounded-xl shadow-inner">
                {inviteResult.code}
              </div>
            </div>
          )}
          {inviteResult && inviteResult.error && (
            <div className="mt-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl">
              {inviteResult.error}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-600">
                <th className="p-4 font-bold">Name</th>
                <th className="p-4 font-bold">Role</th>
                {appUser?.isAdmin && (
                  <th className="p-4 font-bold text-center">Admin Access</th>
                )}
                <th className="p-4 font-bold text-right whitespace-nowrap">
                  Phone
                </th>
                {appUser?.isAdmin && <th className="p-4 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="p-4 font-medium text-zinc-900">
                    {u.name}
                    {u.inviteCode && (
                      <span
                        className="ml-2 bg-amber-100 text-amber-800 text-xs font-mono font-bold px-2 py-1 rounded border border-amber-200"
                        title="Give this code to the employee to log in"
                      >
                        Code: {u.inviteCode}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {appUser?.isAdmin ? (
                      <select
                        value={u.role || "Bartender"}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="bg-zinc-50 border border-zinc-300 text-zinc-900 rounded p-1 text-sm outline-none cursor-pointer focus:border-zinc-500 shadow-inner"
                      >
                        <option value="Bartender">Bartender</option>
                        <option value="Kitchen">Kitchen</option>
                      </select>
                    ) : (
                      <span className="text-sm text-zinc-600">
                        {u.role || "Bartender"}
                      </span>
                    )}
                  </td>
                  {appUser?.isAdmin && (
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleAdmin(u.id, u.isAdmin)}
                        disabled={u.id === appUser?.id}
                        className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${
                          u.isAdmin
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {u.isAdmin ? "Admin" : "Make Admin"}
                      </button>
                    </td>
                  )}
                  <td className="p-4 text-right font-medium text-sm text-zinc-600">
                    {appUser?.isAdmin ? (
                      <input
                        type="tel"
                        value={u.phone || ""}
                        onChange={(e) => updatePhone(u.id, e.target.value)}
                        placeholder="Add phone"
                        className="bg-zinc-50 border border-zinc-300 text-zinc-900 rounded p-1 text-sm outline-none w-32 text-right focus:border-zinc-500 shadow-inner"
                      />
                    ) : (
                      <span className="text-zinc-500">{u.phone || "-"}</span>
                    )}
                  </td>
                  {appUser?.isAdmin && (
                    <td className="p-4 text-center">
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={u.id === appUser?.id}
                        className="text-zinc-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Tab: Inventory & Purchasing ---
const TabInventory = ({ appUser, mockDB, addToast }) => {
  const {
    vendors = [],
    setVendors,
    inventoryItems = [],
    setInventoryItems,
  } = mockDB || {};
  const [invTab, setInvTab] = useState("count");
  const [groupBy, setGroupBy] = useState("category");
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorDays, setNewVendorDays] = useState(["Monday", "Thursday"]);
  const [newVendorTime, setNewVendorTime] = useState("14:00");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCat, setNewItemCat] = useState("Produce");
  const [newItemVendor, setNewItemVendor] = useState(vendors[0]?.id || "");
  const [newItemPar, setNewItemPar] = useState(10);
  const [newItemUnit, setNewItemUnit] = useState("lbs");
  const [orderVendorId, setOrderVendorId] = useState(vendors[0]?.id || "");
  const [vendorToDelete, setVendorToDelete] = useState(null);

  const updateStock = (id, newStock) => {
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, currentStock: Math.max(0, parseInt(newStock) || 0) }
          : item
      )
    );
  };

  const handleAddVendor = (e) => {
    e.preventDefault();
    if (!newVendorName || newVendorDays.length === 0) return;
    setVendors((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newVendorName,
        cutoffDays: newVendorDays,
        cutoffTime: newVendorTime,
      },
    ]);
    setNewVendorName("");
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName || !newItemVendor) return;
    setInventoryItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newItemName,
        category: newItemCat,
        vendorId: newItemVendor,
        parLevel: newItemPar,
        currentStock: 0,
        unit: newItemUnit,
      },
    ]);
    setNewItemName("");
  };

  const deleteVendor = (id) =>
    setVendors((prev) => prev.filter((v) => v.id !== id));
  const deleteItem = (id) =>
    setInventoryItems((prev) => prev.filter((i) => i.id !== id));

  const itemsToOrder = inventoryItems.filter(
    (i) => i.vendorId === orderVendorId && i.currentStock < i.parLevel
  );

  const groupedItems = useMemo(() => {
    const groups = {};
    inventoryItems.forEach((item) => {
      const key =
        groupBy === "vendor"
          ? vendors.find((v) => v.id === item.vendorId)?.name ||
            "Unknown Vendor"
          : item.category;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [inventoryItems, vendors, groupBy]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-zinc-200 pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-900">
          <Package size={24} /> Inventory & Purchasing
        </h2>
        <div className="bg-zinc-100 p-1 rounded-xl flex inline-flex shadow-inner border border-zinc-200">
          <button
            onClick={() => setInvTab("count")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              invTab === "count"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <ClipboardList size={16} /> Count
          </button>
          <button
            onClick={() => setInvTab("order")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              invTab === "order"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <ShoppingCart size={16} /> Order
          </button>
          <button
            onClick={() => setInvTab("manage")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              invTab === "manage"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Manage
          </button>
        </div>
      </div>

      {invTab === "count" && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div>
              <h3 className="font-bold text-zinc-900">Inventory Walkthrough</h3>
              <p className="text-sm text-zinc-500">
                Update current stock levels for all items.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-zinc-400" />
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="bg-white border border-zinc-300 text-zinc-900 rounded-lg p-2 text-sm outline-none focus:border-zinc-500"
              >
                <option value="category">Group by Category</option>
                <option value="vendor">Group by Vendor</option>
              </select>
            </div>
          </div>

          <div className="space-y-8">
            {Object.entries(groupedItems)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, items]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-lg font-bold text-zinc-700 border-b border-zinc-200 pb-2 uppercase tracking-wider">
                    {groupName}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between hover:border-zinc-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-bold text-zinc-900">
                            {item.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Par Level: {item.parLevel} {item.unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              updateStock(item.id, item.currentStock - 1)
                            }
                            className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 transition-colors font-bold text-xl"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.currentStock}
                            onChange={(e) =>
                              updateStock(item.id, e.target.value)
                            }
                            className="w-16 h-10 text-center bg-white border border-zinc-300 text-zinc-900 font-bold rounded-lg outline-none focus:border-zinc-500 shadow-inner"
                          />
                          <button
                            onClick={() =>
                              updateStock(item.id, item.currentStock + 1)
                            }
                            className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 transition-colors font-bold text-xl"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {invTab === "order" && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm gap-4">
            <div>
              <h3 className="font-bold text-zinc-900">
                Purchase Order Generator
              </h3>
              <p className="text-sm text-zinc-500">
                Calculates needed quantities based on par levels.
              </p>
            </div>
            <select
              value={orderVendorId}
              onChange={(e) => setOrderVendorId(e.target.value)}
              className="w-full sm:w-64 bg-white border border-zinc-300 text-zinc-900 rounded-lg p-3 outline-none focus:border-zinc-500 font-bold"
            >
              <option value="" disabled>
                Select Vendor to Order
              </option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {orderVendorId && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-zinc-50 p-4 border-b border-zinc-200 flex justify-between items-center">
                <h4 className="font-bold text-zinc-900 text-lg">
                  {vendors.find((v) => v.id === orderVendorId)?.name} Order
                </h4>
                <div className="text-sm text-zinc-600 flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-zinc-200 shadow-sm">
                  <AlertTriangle size={14} className="text-amber-500" /> Cutoff:{" "}
                  {vendors
                    .find((v) => v.id === orderVendorId)
                    ?.cutoffDays?.join(", ")}{" "}
                  @{" "}
                  {formatTime12Hour(
                    vendors.find((v) => v.id === orderVendorId)?.cutoffTime
                  )}
                </div>
              </div>
              {itemsToOrder.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 flex flex-col items-center bg-zinc-50/50">
                  <Check size={48} className="text-green-500 mb-4 opacity-80" />
                  <span className="font-bold text-lg text-zinc-800">
                    Stock Looks Good!
                  </span>
                </div>
              ) : (
                <>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-100/50 border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500">
                        <th className="p-4 font-bold">Item</th>
                        <th className="p-4 font-bold text-center">On Hand</th>
                        <th className="p-4 font-bold text-center">Par Level</th>
                        <th className="p-4 font-bold text-right text-blue-600">
                          Order Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {itemsToOrder.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50 transition-colors"
                        >
                          <td className="p-4 font-bold text-zinc-900">
                            {item.name}
                          </td>
                          <td className="p-4 text-center font-medium text-zinc-500">
                            {item.currentStock}
                          </td>
                          <td className="p-4 text-center font-medium text-zinc-500">
                            {item.parLevel}
                          </td>
                          <td className="p-4 text-right font-black text-blue-600 text-lg">
                            {item.parLevel - item.currentStock}{" "}
                            <span className="text-sm font-normal">
                              {item.unit}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4 bg-zinc-50 border-t border-zinc-200 text-right">
                    <button
                      onClick={() =>
                        addToast(
                          "Order Status",
                          `Purchase Order generated for ${
                            vendors.find((v) => v.id === orderVendorId)?.name
                          }. (Mock action)`
                        )
                      }
                      className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-md"
                    >
                      Mark as Ordered
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {invTab === "manage" && (
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
          <div className="space-y-6">
            <h3 className="text-xl font-bold border-b border-zinc-200 pb-2 text-zinc-900">
              Vendors
            </h3>
            <form
              onSubmit={handleAddVendor}
              className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Vendor Name
                </label>
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                  required
                  placeholder="e.g. Sysco"
                />
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                    Order Cutoff Days
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((d) => (
                      <label
                        key={d}
                        className="flex items-center gap-1.5 text-sm text-zinc-700 cursor-pointer hover:text-zinc-900 transition-colors bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200"
                      >
                        <input
                          type="checkbox"
                          checked={newVendorDays.includes(d)}
                          onChange={(e) => {
                            if (e.target.checked)
                              setNewVendorDays((prev) => [...prev, d]);
                            else
                              setNewVendorDays((prev) =>
                                prev.filter((day) => day !== d)
                              );
                          }}
                          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 w-4 h-4"
                        />
                        {d.substring(0, 3)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Cutoff Time
                  </label>
                  <input
                    type="time"
                    value={newVendorTime}
                    onChange={(e) => setNewVendorTime(e.target.value)}
                    className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={newVendorDays.length === 0}
                className="w-full bg-zinc-900 text-white border border-zinc-800 p-3 rounded-lg font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add Vendor
              </button>
            </form>
            <div className="space-y-3">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex justify-between items-center group hover:border-zinc-300 transition-colors"
                >
                  <div>
                    <div className="font-bold text-zinc-900">{v.name}</div>
                    <div className="text-xs text-amber-600 font-medium mt-0.5 bg-amber-50 inline-block px-2 py-0.5 rounded border border-amber-200">
                      Cutoff: {v.cutoffDays?.join(", ")} @{" "}
                      {formatTime12Hour(v.cutoffTime)}
                    </div>
                  </div>
                  <button
                    onClick={() => setVendorToDelete(v)}
                    className="text-zinc-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            <Modal
              isOpen={!!vendorToDelete}
              onClose={() => setVendorToDelete(null)}
              title="Delete Vendor?"
            >
              <div className="space-y-4">
                <p className="text-zinc-700">
                  Are you sure you want to delete{" "}
                  <strong className="text-zinc-900">
                    {vendorToDelete?.name}
                  </strong>
                  ?
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      deleteVendor(vendorToDelete?.id);
                      setVendorToDelete(null);
                    }}
                    className="flex-1 bg-red-600 text-white p-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setVendorToDelete(null)}
                    className="flex-1 bg-zinc-100 text-zinc-700 p-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors border border-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Modal>
          </div>
          <div className="space-y-6">
            <h3 className="text-xl font-bold border-b border-zinc-200 pb-2 text-zinc-900">
              Master Product List
            </h3>
            <form
              onSubmit={handleAddItem}
              className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm space-y-4"
            >
              <div className="flex gap-4">
                <div className="flex-[2]">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={newItemCat}
                    onChange={(e) => setNewItemCat(e.target.value)}
                    className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                  >
                    <option value="Produce">Produce</option>
                    <option value="Meat">Meat</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Dry Goods">Dry Goods</option>
                    <option value="Alcohol">Alcohol</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  Assign Vendor
                </label>
                <select
                  value={newItemVendor}
                  onChange={(e) => setNewItemVendor(e.target.value)}
                  className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                  required
                >
                  <option value="" disabled>
                    Select Vendor
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Target Par Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItemPar}
                    onChange={(e) => setNewItemPar(e.target.value)}
                    className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Unit
                  </label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-lg outline-none focus:border-zinc-500"
                  >
                    <option value="lbs">lbs</option>
                    <option value="cases">cases</option>
                    <option value="boxes">boxes</option>
                    <option value="jugs">jugs</option>
                    <option value="qts">qts</option>
                    <option value="each">each</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={!vendors.length}
                className="w-full bg-zinc-900 text-white border border-zinc-800 p-3 rounded-lg font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus size={18} /> Add Item
              </button>
            </form>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {inventoryItems.map((i) => (
                <div
                  key={i.id}
                  className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm flex justify-between items-center group hover:border-zinc-300 transition-colors"
                >
                  <div>
                    <div className="font-bold text-zinc-900">
                      {i.name}{" "}
                      <span className="text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full ml-1 border border-zinc-200">
                        {i.category}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Vendor:{" "}
                      {vendors.find((v) => v.id === i.vendorId)?.name ||
                        "Unknown"}{" "}
                      | Par: {i.parLevel} {i.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteItem(i.id)}
                    className="text-zinc-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Tab: Recipes ---
const TabRecipes = ({ appUser, mockDB }) => {
  const { recipes = [], setRecipes } = mockDB || {};
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState([{ text: "", isDone: false }]);
  const [steps, setSteps] = useState([{ text: "", isDone: false }]);

  const handleScanPhoto = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsScanning(true);
      setTimeout(() => {
        setTitle("Roasted Garlic Aioli (Scanned)");
        setIngredients([
          { text: "3 whole heads of garlic", isDone: false },
          { text: "1 cup mayonnaise", isDone: false },
          { text: "1 tbsp lemon juice", isDone: false },
        ]);
        setSteps([
          { text: "Preheat oven to 400°F (200°C).", isDone: false },
          {
            text: "Cut top off garlic, drizzle with oil, wrap in foil, and roast for 40 mins.",
            isDone: false,
          },
          { text: "Whisk in mayonnaise, lemon juice.", isDone: false },
        ]);
        setIsScanning(false);
      }, 2000);
    }
  };

  const handleSaveRecipe = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setRecipes((prev) => [
      ...(prev || []),
      {
        id: Date.now().toString(),
        title,
        ingredients: ingredients.filter((i) => i.text.trim()),
        steps: steps.filter((s) => s.text.trim()),
      },
    ]);
    setIsCreating(false);
    setTitle("");
    setIngredients([{ text: "", isDone: false }]);
    setSteps([{ text: "", isDone: false }]);
  };

  const toggleCheck = (type, index) => {
    if (!activeRecipe) return;
    const updatedRecipe = { ...activeRecipe };
    updatedRecipe[type][index].isDone = !updatedRecipe[type][index].isDone;
    setRecipes((prev) =>
      (prev || []).map((r) => (r.id === activeRecipe.id ? updatedRecipe : r))
    );
    setActiveRecipe(updatedRecipe);
  };

  const deleteRecipe = (id) => {
    setRecipes((prev) => (prev || []).filter((r) => r.id !== id));
    setActiveRecipe(null);
  };

  if (activeRecipe) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="bg-zinc-50 p-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveRecipe(null)}
              className="p-2 -ml-2 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-900"
            >
              <ChevronLeft />
            </button>
            <h2 className="font-bold text-xl text-zinc-900">
              {activeRecipe.title}
            </h2>
          </div>
          {appUser?.isAdmin && (
            <button
              onClick={() => deleteRecipe(activeRecipe.id)}
              className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
        <div className="p-6 space-y-8">
          <div>
            <h3 className="font-bold text-zinc-900 uppercase tracking-wider text-xs mb-3 border-b border-zinc-200 pb-2">
              Ingredients
            </h3>
            <div className="space-y-2">
              {(activeRecipe.ingredients || []).map((ing, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleCheck("ingredients", idx)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border shadow-sm ${
                    ing.isDone
                      ? "bg-zinc-50 border-zinc-200"
                      : "hover:bg-zinc-50 border-zinc-200 bg-white"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      ing.isDone
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-zinc-300 text-transparent"
                    }`}
                  >
                    <Check size={16} />
                  </div>
                  <span
                    className={`${
                      ing.isDone
                        ? "text-zinc-400 line-through"
                        : "text-zinc-900 font-medium"
                    }`}
                  >
                    {ing.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 uppercase tracking-wider text-xs mb-3 border-b border-zinc-200 pb-2">
              Steps
            </h3>
            <div className="space-y-3">
              {(activeRecipe.steps || []).map((step, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleCheck("steps", idx)}
                  className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors border shadow-sm ${
                    step.isDone
                      ? "bg-zinc-50 border-zinc-200"
                      : "bg-white border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      step.isDone
                        ? "bg-green-600 border-green-600 text-white"
                        : "border-zinc-300 text-zinc-500 text-xs font-bold"
                    }`}
                  >
                    {step.isDone ? <Check size={14} /> : idx + 1}
                  </div>
                  <p
                    className={`leading-relaxed ${
                      step.isDone
                        ? "text-zinc-400 line-through"
                        : "text-zinc-900"
                    }`}
                  >
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="bg-zinc-50 p-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreating(false)}
              className="p-2 -ml-2 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-900"
            >
              <ChevronLeft />
            </button>
            <h2 className="font-bold text-xl text-zinc-900">New Recipe</h2>
          </div>
        </div>
        <form onSubmit={handleSaveRecipe} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-3 shadow-sm">
            <h4 className="font-bold text-blue-800 flex justify-center items-center gap-2">
              <BookOpen size={18} /> Smart Recipe Scanner
            </h4>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto mx-auto relative overflow-hidden">
              {isScanning ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Camera size={18} /> Scan Recipe from Photo
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="camera"
                onChange={handleScanPhoto}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isScanning}
              />
            </label>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
              Recipe Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-white border border-zinc-300 rounded-xl outline-none focus:border-zinc-500 text-zinc-900 shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
              Ingredients
            </label>
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ing.text}
                  onChange={(e) => {
                    const newArr = [...ingredients];
                    newArr[idx].text = e.target.value;
                    setIngredients(newArr);
                  }}
                  className="flex-1 p-2 bg-white border border-zinc-300 rounded-lg outline-none text-zinc-900 shadow-inner"
                />
                {idx === ingredients.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setIngredients([
                        ...ingredients,
                        { text: "", isDone: false },
                      ])
                    }
                    className="bg-zinc-100 text-zinc-600 p-2 rounded-lg hover:bg-zinc-200 border border-zinc-200"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
              Steps
            </label>
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <textarea
                  value={step.text}
                  onChange={(e) => {
                    const newArr = [...steps];
                    newArr[idx].text = e.target.value;
                    setSteps(newArr);
                  }}
                  className="flex-1 p-2 bg-white border border-zinc-300 rounded-lg outline-none text-zinc-900 resize-none h-16 shadow-inner"
                />
                {idx === steps.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSteps([...steps, { text: "", isDone: false }])
                    }
                    className="bg-zinc-100 text-zinc-600 p-2 rounded-lg hover:bg-zinc-200 border border-zinc-200"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-md"
          >
            Save Recipe
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-900">
          <BookOpen size={24} /> Kitchen Recipe Book
        </h2>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-zinc-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-zinc-800 shadow-md"
        >
          <Plus size={18} /> New Recipe
        </button>
      </div>
      {recipes.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-zinc-300 text-zinc-500 font-medium">
          No recipes saved yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRecipe(r)}
              className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-zinc-400 hover:shadow-md transition-all text-left group"
            >
              <h3 className="font-bold text-lg text-zinc-900 mb-2 group-hover:text-blue-600 transition-colors">
                {r.title}
              </h3>
              <p className="text-sm text-zinc-500">
                {(r.ingredients || []).length} ingredients •{" "}
                {(r.steps || []).length} steps
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
// --- Tab: Schedule ---
const TabSchedule = ({ currentDate, appUser, mockDB }) => {
  const {
    users = [],
    shifts = [],
    setShifts,
    timeOff = [],
    templates = [],
    setTemplates,
    meta = {},
    setMessages,
  } = mockDB || {};
  const [selectedEmp, setSelectedEmp] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [selectedDates, setSelectedDates] = useState([]);

  const monthStr = getMonthStr(currentDate);
  const isMonthPublished = meta[`month_${monthStr}`]?.isPublished;
  const weekRange = getWeekRange(currentDate);
  const weeklyShifts = shifts.filter(
    (s) => s.date >= weekRange.start && s.date <= weekRange.end
  );
  const displayShifts = shifts.filter(
    (s) => s.date === currentDate && (appUser?.isAdmin || isMonthPublished)
  );
  const bartenderShifts = displayShifts
    .filter((s) => s.role === "Bartender")
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  const kitchenShifts = displayShifts
    .filter((s) => s.role === "Kitchen")
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const getAvailability = (uid, date, checkStart, checkEnd) => {
    if (!uid) return "available";
    const to = timeOff.filter(
      (t) =>
        t.employeeId === uid &&
        date >= t.startDate &&
        (t.endDate ? date <= t.endDate : date === t.startDate)
    );
    if (to.length === 0) return "available";
    if (to.some((t) => !t.isPartial)) return "unavailable";
    if (checkStart && checkEnd) {
      if (
        to.some(
          (t) =>
            t.isPartial &&
            checkStart < (t.endTime || "24:00") &&
            checkEnd > (t.startTime || "00:00")
        )
      )
        return "unavailable";
    }
    return "partial";
  };

  const daysInMonth = getDaysInMonth(monthStr);
  const monthDates = Array.from(
    { length: daysInMonth },
    (_, i) => `${monthStr}-${String(i + 1).padStart(2, "0")}`
  );

  const handleSaveShift = () => {
    if (!selectedEmp || selectedDates.length === 0) return;
    const emp = users.find((u) => u.id === selectedEmp);
    if (!emp) return;
    const newShifts = [];
    for (const date of selectedDates) {
      if (
        getAvailability(emp.id, date, startTime, endTime) === "unavailable" ||
        shifts.some((s) => s.date === date && s.employeeId === emp.id)
      )
        continue;
      newShifts.push({
        id: Date.now().toString() + Math.random(),
        date,
        employeeId: emp.id,
        role: emp.role || "Bartender",
        startTime,
        endTime,
        swapStatus: "none",
      });
    }
    setShifts((prev) => [...(prev || []), ...newShifts]);
    setSelectedDates([]);
    setSelectedEmp("");
  };

  const handleSaveTemplate = () => {
    const emp = users.find((u) => u.id === selectedEmp);
    if (emp)
      setTemplates((prev) => [
        ...(prev || []),
        {
          id: Date.now().toString(),
          role: emp.role || "Bartender",
          startTime,
          endTime,
        },
      ]);
  };

  const loadTemplate = (id) => {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setStartTime(t.startTime || "09:00");
      setEndTime(t.endTime || "17:00");
    }
  };
  const deleteShift = (id) => {
    setShifts((prev) => (prev || []).filter((s) => s.id !== id));
  };

  const handleSwapRequest = (shiftId, targetUid) => {
    setShifts((prev) =>
      (prev || []).map((s) =>
        s.id === shiftId
          ? {
              ...s,
              swapStatus: "pending",
              swapTargetId: targetUid,
              swapRequestedBy: appUser.id,
            }
          : s
      )
    );
    setMessages((prev) => [
      ...(prev || []),
      {
        id: Date.now().toString(),
        threadId: [appUser.id, targetUid].sort().join("_"),
        senderId: appUser.id,
        text: `Swap requested for shift on ${formatDisplayDate(
          shifts.find((s) => s.id === shiftId)?.date
        )}`,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleSwapResolve = (shiftId, accept) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    if (accept) {
      setShifts((prev) =>
        (prev || []).map((s) =>
          s.id === shiftId ? { ...s, swapStatus: "pending_admin" } : s
        )
      );
      setMessages((prev) => [
        ...(prev || []),
        {
          id: Date.now().toString(),
          threadId: "management",
          senderId: appUser.id,
          text: `I accepted a shift swap for ${formatDisplayDate(
            shift.date
          )}. Please approve.`,
          timestamp: Date.now(),
        },
      ]);
    } else {
      setShifts((prev) =>
        (prev || []).map((s) =>
          s.id === shiftId
            ? {
                ...s,
                swapStatus: "none",
                swapTargetId: null,
                swapRequestedBy: null,
              }
            : s
        )
      );
    }
  };

  const handleAdminSwapResolve = (shiftId, approve) => {
    setShifts((prev) =>
      (prev || []).map((s) =>
        s.id === shiftId
          ? approve
            ? {
                ...s,
                swapStatus: "none",
                employeeId: s.swapTargetId,
                swapTargetId: null,
                swapRequestedBy: null,
              }
            : {
                ...s,
                swapStatus: "none",
                swapTargetId: null,
                swapRequestedBy: null,
              }
          : s
      )
    );
  };

  const ShiftCard = ({ shift }) => {
    const emp = users.find((u) => u.id === shift.employeeId);
    const [swapModalOpen, setSwapModalOpen] = useState(false);
    const [swapTarget, setSwapTarget] = useState("");
    const amTarget = shift.swapTargetId === appUser?.id;
    const amOwner = shift.employeeId === appUser?.id;
    const canViewHours = appUser?.isAdmin || amOwner;
    const dailyHours = getShiftHours(shift.startTime, shift.endTime);
    const weeklyHours = weeklyShifts
      .filter((s) => s.employeeId === shift.employeeId)
      .reduce((sum, s) => sum + getShiftHours(s.startTime, s.endTime), 0);

    return (
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col gap-2 relative group">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-lg text-zinc-900">
              {emp?.name || "Unknown"}
            </div>
            <div className="text-zinc-500 text-sm flex items-center gap-1">
              <Clock size={14} /> {formatTime12Hour(shift.startTime)} -{" "}
              {formatTime12Hour(shift.endTime)}
            </div>
            {canViewHours && (
              <div className="mt-2 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 inline-flex rounded-lg px-2 py-1 items-center">
                <span>
                  Daily:{" "}
                  <strong className="text-zinc-900">
                    {dailyHours.toFixed(1)}h
                  </strong>
                </span>
                <span className="mx-2 text-zinc-300">|</span>
                <span>
                  Weekly:{" "}
                  <strong className="text-zinc-900">
                    {weeklyHours.toFixed(1)}h
                  </strong>
                </span>
              </div>
            )}
          </div>
          {appUser?.isAdmin && (
            <button
              onClick={() => deleteShift(shift.id)}
              className="text-zinc-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {isMonthPublished && (
          <div className="mt-2 pt-2 border-t border-zinc-200 print:hidden">
            {shift.swapStatus === "pending" &&
              (amTarget ? (
                <div className="flex gap-2">
                  <span className="text-xs font-semibold flex-1 flex items-center text-amber-600">
                    <AlertTriangle size={12} className="mr-1" /> Swap Request
                  </span>
                  <button
                    onClick={() => handleSwapResolve(shift.id, true)}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleSwapResolve(shift.id, false)}
                    className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded border border-zinc-200"
                  >
                    Decline
                  </button>
                </div>
              ) : amOwner ? (
                <span className="text-xs text-amber-600 font-medium">
                  Waiting for Coworker...
                </span>
              ) : appUser?.isAdmin ? (
                <span className="text-xs text-zinc-500">
                  Swap Pending Coworker
                </span>
              ) : null)}
            {shift.swapStatus === "pending_admin" &&
              (appUser?.isAdmin ? (
                <div className="flex gap-2">
                  <span className="text-xs font-semibold flex-1 flex items-center text-amber-600">
                    <AlertTriangle size={12} className="mr-1" /> Admin Approval
                    Needed
                  </span>
                  <button
                    onClick={() => handleAdminSwapResolve(shift.id, true)}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAdminSwapResolve(shift.id, false)}
                    className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                  >
                    Deny
                  </button>
                </div>
              ) : amTarget || amOwner ? (
                <span className="text-xs text-amber-600 font-medium">
                  Waiting for Admin...
                </span>
              ) : null)}
            {shift.swapStatus === "none" &&
              !appUser?.isAdmin &&
              amOwner &&
              new Date(shift.date) >= new Date(getToday()) && (
                <button
                  onClick={() => setSwapModalOpen(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-900 border border-zinc-300 rounded px-2 py-1 transition-colors hover:bg-zinc-50"
                >
                  Request Swap
                </button>
              )}
          </div>
        )}

        <Modal
          isOpen={swapModalOpen}
          onClose={() => setSwapModalOpen(false)}
          title="Request Shift Swap"
        >
          <div className="space-y-4">
            <select
              value={swapTarget}
              onChange={(e) => setSwapTarget(e.target.value)}
              className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500"
            >
              <option value="">Select Coworker...</option>
              {users
                .filter((u) => u.id !== appUser?.id && u.role === shift.role)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <button
              onClick={() => {
                handleSwapRequest(shift.id, swapTarget);
                setSwapModalOpen(false);
              }}
              disabled={!swapTarget}
              className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-50"
            >
              Send Request
            </button>
          </div>
        </Modal>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {appUser?.isAdmin && !isMonthPublished && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 mb-2 flex items-center gap-2 font-medium print:hidden">
          <AlertTriangle size={20} /> Draft Mode - Not visible to staff.
        </div>
      )}
      {appUser?.isAdmin && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4 mb-6 print:hidden">
          <h3 className="font-bold text-lg text-zinc-900 border-b border-zinc-200 pb-2">
            Schedule Shift
          </h3>
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Load Template
              </label>
              <select
                onChange={(e) => loadTemplate(e.target.value)}
                defaultValue=""
                className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 text-sm shadow-inner"
              >
                <option value="" disabled>
                  Select...
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.role}: {formatTime12Hour(t.startTime)} -{" "}
                    {formatTime12Hour(t.endTime)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Employee
            </label>
            <select
              value={selectedEmp}
              onChange={(e) => {
                setSelectedEmp(e.target.value);
                setSelectedDates([]);
              }}
              className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 shadow-inner"
            >
              <option value="">Select an employee...</option>
              {users
                .filter(
                  (u) =>
                    getAvailability(u.id, currentDate, startTime, endTime) !==
                    "unavailable"
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role || "Bartender"})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 shadow-inner"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 bg-white border border-zinc-300 text-zinc-900 rounded-xl outline-none focus:border-zinc-500 shadow-inner"
              />
            </div>
          </div>
          {selectedEmp && (
            <div className="pt-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Select Dates for {formatDisplayMonth(monthStr)}
              </label>
              <div className="grid grid-cols-7 gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-bold text-zinc-500 py-1"
                  >
                    {d}
                  </div>
                ))}
                {Array.from({
                  length: new Date(monthDates[0] + "T12:00:00").getDay(),
                }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {monthDates.map((date) => {
                  const avail = getAvailability(
                    selectedEmp,
                    date,
                    startTime,
                    endTime
                  );
                  if (avail === "unavailable")
                    return (
                      <div
                        key={date}
                        className="aspect-square rounded-md bg-zinc-100 text-zinc-400 border border-zinc-200 flex items-center justify-center text-sm line-through"
                      >
                        {parseInt(date.slice(-2))}
                      </div>
                    );
                  const isSelected = selectedDates.includes(date);
                  return (
                    <button
                      key={date}
                      onClick={() =>
                        setSelectedDates((prev) =>
                          isSelected
                            ? prev.filter((d) => d !== date)
                            : [...prev, date]
                        )
                      }
                      className={`relative aspect-square rounded-md flex items-center justify-center text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-zinc-900 text-white shadow-md scale-105"
                          : "bg-white border border-zinc-300 text-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      {parseInt(date.slice(-2))}
                      {avail === "partial" && (
                        <span className="absolute bottom-1 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-sm border border-white"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="pt-4 flex gap-2 border-t border-zinc-200">
            <button
              onClick={handleSaveShift}
              disabled={!selectedEmp || selectedDates.length === 0}
              className="flex-1 bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-sm"
            >
              Assign to {selectedDates.length} Dates
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={!selectedEmp}
              className="bg-zinc-100 text-zinc-700 px-4 rounded-xl hover:bg-zinc-200 text-sm font-medium border border-zinc-200"
            >
              <Plus size={16} /> Save Tpl
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 border-zinc-200 pb-2 flex justify-between items-end text-zinc-900">
            Bartenders{" "}
            <span className="text-sm font-normal text-zinc-500">
              {bartenderShifts.length} shifts
            </span>
          </h3>
          {bartenderShifts.length === 0 ? (
            <p className="text-zinc-500 italic bg-white p-4 rounded-xl border border-dashed border-zinc-300 text-center">
              No shifts.
            </p>
          ) : (
            <div className="space-y-3">
              {bartenderShifts.map((s) => (
                <ShiftCard key={s.id} shift={s} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 border-zinc-200 pb-2 flex justify-between items-end text-zinc-900">
            Kitchen{" "}
            <span className="text-sm font-normal text-zinc-500">
              {kitchenShifts.length} shifts
            </span>
          </h3>
          {kitchenShifts.length === 0 ? (
            <p className="text-zinc-500 italic bg-white p-4 rounded-xl border border-dashed border-zinc-300 text-center">
              No shifts.
            </p>
          ) : (
            <div className="space-y-3">
              {kitchenShifts.map((s) => (
                <ShiftCard key={s.id} shift={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Tab: Month View ---
const TabMonth = ({ currentDate, appUser, mockDB, setCurrentDate }) => {
  const {
    users = [],
    shifts = [],
    timeOff = [],
    meta = {},
    setMeta,
  } = mockDB || {};
  const [viewMode, setViewMode] = useState("scheduled");
  const monthStr = getMonthStr(currentDate);
  const isMonthPublished = meta[`month_${monthStr}`]?.isPublished;

  const actualViewMode = appUser?.isAdmin ? viewMode : "scheduled";
  if (!appUser?.isAdmin && !isMonthPublished)
    return (
      <div className="text-center p-12 text-zinc-500 font-medium">
        This month's schedule has not been published yet.
      </div>
    );

  const daysInMonth = getDaysInMonth(monthStr);
  const monthDates = Array.from(
    { length: daysInMonth },
    (_, i) => `${monthStr}-${String(i + 1).padStart(2, "0")}`
  );
  const firstDayOfWeek = new Date(monthDates[0] + "T12:00:00").getDay();

  return (
    <div className="space-y-4" id="printable-schedule">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm print:hidden">
        {appUser?.isAdmin ? (
          <div className="bg-zinc-100 p-1 rounded-lg flex inline-flex shadow-inner border border-zinc-200">
            <button
              onClick={() => setViewMode("availability")}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
                viewMode === "availability"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Availability
            </button>
            <button
              onClick={() => setViewMode("scheduled")}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${
                viewMode === "scheduled"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Scheduled
            </button>
          </div>
        ) : (
          <div className="font-bold text-lg text-zinc-900">
            Published Schedule
          </div>
        )}
        <div className="flex gap-2 w-full sm:w-auto">
          {actualViewMode === "scheduled" && (
            <button
              onClick={() => window.print()}
              className="bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold shadow-sm flex items-center justify-center gap-2"
            >
              <Printer size={18} /> Print
            </button>
          )}
          {appUser?.isAdmin &&
            (!isMonthPublished ? (
              <button
                onClick={() =>
                  setMeta((prev) => ({
                    ...(prev || {}),
                    [`month_${monthStr}`]: { isPublished: true },
                  }))
                }
                className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold shadow-sm"
              >
                Publish Month
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-green-600 font-bold flex items-center gap-1">
                  <Check size={18} /> Published
                </span>
                <button
                  onClick={() =>
                    setMeta((prev) => ({
                      ...(prev || {}),
                      [`month_${monthStr}`]: { isPublished: true },
                    }))
                  }
                  className="bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold shadow-sm"
                >
                  Republish
                </button>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm print:shadow-none print:border-2 print:border-black print:rounded-none">
        <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200 print:border-black print:bg-zinc-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="p-1 sm:p-3 text-center text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-t border-zinc-200 print:border-black -mt-[1px] -ml-[1px]">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[100px] border-r border-b border-zinc-200 print:border-black bg-zinc-50 print:bg-white"
            />
          ))}
          {monthDates.map((date) => {
            const dayShifts = shifts.filter((s) => s.date === date);
            const dayTimeOff = timeOff.filter(
              (t) =>
                date >= t.startDate &&
                (t.endDate ? date <= t.endDate : date === t.startDate)
            );
            return (
              <div
                key={date}
                onClick={() => setCurrentDate(date)}
                className="min-h-[100px] sm:min-h-[120px] print:min-h-[80px] p-1 sm:p-2 border-r border-b border-zinc-200 print:border-black hover:bg-zinc-50 cursor-pointer group flex flex-col"
              >
                <div
                  className={`text-right text-xs sm:text-sm font-medium mb-1 ${
                    date === getToday()
                      ? "text-blue-600 font-bold"
                      : "text-zinc-500 group-hover:text-zinc-900"
                  }`}
                >
                  {parseInt(date.slice(-2))}
                </div>
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {actualViewMode === "scheduled"
                    ? dayShifts.map((s) => {
                        const emp = users.find((u) => u.id === s.employeeId);
                        return (
                          <div
                            key={s.id}
                            className={`text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded font-medium ${
                              s.role === "Bartender"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                            } truncate`}
                          >
                            {(emp?.name || "Unknown").split(" ")[0]}{" "}
                            {formatTime12Hour(s.startTime)
                              .replace(":00", "")
                              .replace(" ", "")}
                          </div>
                        );
                      })
                    : users.map((u) => {
                        const to = dayTimeOff.find(
                          (t) => t.employeeId === u.id
                        );
                        if (!to)
                          return (
                            <div
                              key={u.id}
                              className="text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded bg-green-100 text-green-800 truncate"
                            >
                              {(u.name || "Unknown").split(" ")[0]}
                            </div>
                          );
                        if (to.isPartial)
                          return (
                            <div
                              key={u.id}
                              className="text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 truncate"
                            >
                              {(u.name || "Unknown").split(" ")[0]} (P)
                            </div>
                          );
                        return null;
                      })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Tab: Time Off ---
const TabTimeOff = ({ appUser, mockDB }) => {
  const { users = [], timeOff = [], setTimeOff, setMessages } = mockDB || {};
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState("");
  const [isMultiple, setIsMultiple] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    const reqStart = startDate;
    const reqEnd = isMultiple && endDate ? endDate : startDate;
    if (reqEnd < reqStart) {
      setErrorMsg("End date cannot be before the start date.");
      return;
    }
    if (
      timeOff.some(
        (t) =>
          t.employeeId === appUser?.id &&
          reqStart <= (t.endDate || t.startDate) &&
          reqEnd >= t.startDate
      )
    ) {
      setErrorMsg(
        "You have already requested time off overlapping with these dates."
      );
      return;
    }
    setTimeOff((prev) => [
      ...(prev || []),
      {
        id: Date.now().toString(),
        employeeId: appUser.id,
        startDate,
        endDate: isMultiple ? endDate : null,
        isPartial: !isMultiple && isPartial,
        startTime: !isMultiple && isPartial ? startTime : null,
        endTime: !isMultiple && isPartial ? endTime : null,
      },
    ]);
    setStartDate(getToday());
    setEndDate("");
    setIsMultiple(false);
    setIsPartial(false);
  };

  const deleteRequest = (t) => {
    setTimeOff((prev) => (prev || []).filter((req) => req.id !== t.id));
    if (appUser?.isAdmin && t.employeeId !== appUser.id) {
      setMessages((prev) => [
        ...(prev || []),
        {
          id: Date.now().toString(),
          threadId: [appUser.id, t.employeeId].sort().join("_"),
          senderId: appUser.id,
          text: `System Alert: Your time off request for ${formatDisplayDate(
            t.startDate
          )} has been declined/deleted by management.`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const visibleRequests = appUser?.isAdmin
    ? timeOff
    : timeOff.filter((t) => t.employeeId === appUser?.id);

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
          <Calendar size={24} /> Request Time Off
        </h3>
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 space-y-4"
        >
          {errorMsg && (
            <div className="bg-red-50 text-red-800 p-3 rounded-xl border border-red-200 text-sm font-medium flex items-center gap-2">
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
              <input
                type="checkbox"
                checked={isMultiple}
                onChange={(e) => {
                  setIsMultiple(e.target.checked);
                  if (e.target.checked) setIsPartial(false);
                }}
                className="rounded"
              />{" "}
              Multiple days
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
              <input
                type="checkbox"
                checked={isPartial}
                onChange={(e) => {
                  setIsPartial(e.target.checked);
                  if (e.target.checked) setIsMultiple(false);
                }}
                disabled={isMultiple}
                className="rounded disabled:opacity-50"
              />{" "}
              Partial Day
            </label>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                {isMultiple ? "Start Date" : "Date"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 bg-white border border-zinc-300 rounded-xl"
                required
              />
            </div>
            {isMultiple && (
              <div className="flex-1">
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 bg-white border border-zinc-300 rounded-xl"
                  required
                />
              </div>
            )}
          </div>
          {isPartial && !isMultiple && (
            <div className="flex gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex-1">
                <label className="block text-xs font-bold text-amber-800 uppercase mb-1">
                  From
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-amber-800 uppercase mb-1">
                  Until
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg"
                  required
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold"
          >
            Submit Request
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
          <Clock size={24} />{" "}
          {appUser?.isAdmin
            ? "All Logged Unavailability"
            : "Your Logged Unavailability"}
        </h3>
        <div className="space-y-3">
          {visibleRequests.length === 0 ? (
            <p className="text-zinc-500 italic bg-white p-4 rounded-xl border border-zinc-200 text-center">
              No time off logged.
            </p>
          ) : (
            [...visibleRequests]
              .sort((a, b) =>
                (a.startDate || "").localeCompare(b.startDate || "")
              )
              .map((t) => {
                const emp = users.find((u) => u.id === t.employeeId);
                return (
                  <div
                    key={t.id}
                    className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex justify-between items-center group"
                  >
                    <div>
                      {appUser?.isAdmin && (
                        <div className="font-bold text-zinc-900">
                          {emp?.name || "Unknown"}
                        </div>
                      )}
                      <div
                        className={`text-sm ${
                          appUser?.isAdmin
                            ? "text-zinc-500"
                            : "font-bold text-zinc-900"
                        }`}
                      >
                        {formatDisplayDate(t.startDate)}{" "}
                        {t.endDate && `- ${formatDisplayDate(t.endDate)}`}
                      </div>
                      <div className="text-xs font-medium mt-1">
                        {t.isPartial ? (
                          <span className="text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                            {formatTime12Hour(t.startTime)} to{" "}
                            {formatTime12Hour(t.endTime)}
                          </span>
                        ) : (
                          <span className="text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                            (All Day)
                          </span>
                        )}
                      </div>
                    </div>
                    {(appUser?.isAdmin || t.employeeId === appUser?.id) && (
                      <button
                        onClick={() => deleteRequest(t)}
                        className="text-zinc-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};
// --- Tab: Prep List ---
const TabPrep = ({ currentDate, appUser, mockDB }) => {
  const { prepItems = [], setPrepItems } = mockDB || {};
  const [newItemText, setNewItemText] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("batch");
  const [notifyStaff, setNotifyStaff] = useState(false);

  const todayItems = prepItems.filter((p) => p.date === currentDate);
  const todo = todayItems.filter((p) => !p.isCompleted);
  const completed = todayItems.filter((p) => p.isCompleted);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    setPrepItems((prev) => [
      ...(prev || []),
      {
        id: Date.now().toString(),
        date: currentDate,
        text: newItemText,
        qty,
        unit,
        isCompleted: false,
        notifyStaff,
      },
    ]);
    setNewItemText("");
    setQty("1");
    setNotifyStaff(false);
  };

  const toggleStatus = (item) => {
    setPrepItems((prev) =>
      (prev || []).map((p) =>
        p.id === item.id ? { ...p, isCompleted: !p.isCompleted } : p
      )
    );
  };
  const deleteItem = (id) => {
    setPrepItems((prev) => (prev || []).filter((p) => p.id !== id));
  };

  const ItemRow = ({ item }) => (
    <div
      className={`flex items-center justify-between p-3 border-b border-zinc-200 last:border-0 group ${
        item.isCompleted ? "bg-zinc-50" : "bg-white hover:bg-zinc-50"
      }`}
    >
      <div
        className="flex items-center gap-3 cursor-pointer flex-1"
        onClick={() => toggleStatus(item)}
      >
        <div
          className={`w-6 h-6 rounded border flex items-center justify-center ${
            item.isCompleted
              ? "bg-green-600 border-green-600 text-white"
              : "border-zinc-300 text-transparent"
          }`}
        >
          <Check size={16} />
        </div>
        <span
          className={`font-medium ${
            item.isCompleted ? "text-zinc-400 line-through" : "text-zinc-900"
          }`}
        >
          {item.text}
        </span>
        <span
          className={`text-sm px-2 py-0.5 rounded-full ${
            item.isCompleted
              ? "bg-white text-zinc-400 border border-zinc-200"
              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
          }`}
        >
          {item.qty} {item.unit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {item.notifyStaff && !item.isCompleted && (
          <Bell size={14} className="text-amber-500 opacity-70" />
        )}
        <button
          onClick={() => deleteItem(item.id)}
          className="text-zinc-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form
        onSubmit={handleAdd}
        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Prep Item (e.g. Diced Onions)"
            className="flex-1 p-3 bg-zinc-50 border border-zinc-300 rounded-xl"
            required
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-20 p-3 bg-zinc-50 border border-zinc-300 rounded-xl"
              min="1"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-24 p-3 bg-zinc-50 border border-zinc-300 rounded-xl"
            >
              <option value="batch">batch</option>
              <option value="lbs">lbs</option>
              <option value="pans">pans</option>
              <option value="qts">qts</option>
            </select>
            <button
              type="submit"
              className="bg-zinc-900 text-white px-4 rounded-xl hover:bg-zinc-800 font-bold"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-zinc-200">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
            <input
              type="checkbox"
              checked={notifyStaff}
              onChange={(e) => setNotifyStaff(e.target.checked)}
              className="rounded bg-white border-zinc-300"
            />
            <Bell size={14} /> Require push notifications for this item
          </label>
        </div>
      </form>
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="bg-zinc-50 p-3 font-bold text-zinc-500 uppercase text-xs tracking-wider border-b border-zinc-200">
          To Do ({todo.length})
        </div>
        {todo.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 italic">
            All caught up!
          </div>
        ) : (
          todo.map((item) => <ItemRow key={item.id} item={item} />)
        )}
        {completed.length > 0 && (
          <>
            <div className="bg-zinc-50 p-3 font-bold text-zinc-500 uppercase text-xs tracking-wider border-t border-b border-zinc-200">
              Completed ({completed.length})
            </div>
            {completed.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// --- Tab: Messages ---
const TabMessages = ({ appUser, mockDB }) => {
  const { users = [], messages = [], setMessages } = mockDB || {};
  const [activeThread, setActiveThread] = useState(null);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const getThreadId = (targetId) =>
    targetId === "everyone" ||
    targetId === "bartender" ||
    targetId === "kitchen"
      ? targetId
      : [appUser.id, targetId].sort().join("_");

  const threads = [
    { id: "everyone", label: "Everyone", icon: <Users size={18} /> },
    {
      id: "bartender",
      label: "All Bartenders",
      icon: <MessageSquare size={18} />,
    },
    {
      id: "kitchen",
      label: "All Kitchen Staff",
      icon: <MessageSquare size={18} />,
    },
    ...users
      .filter((u) => u.id !== appUser.id)
      .map((u) => ({
        id: getThreadId(u.id),
        label: u.name || "Unknown",
        targetId: u.id,
      })),
  ];

  const threadMsgs = activeThread
    ? messages
        .filter((m) => m.threadId === activeThread.id)
        .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  useEffect(() => {
    if (activeThread) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      const unreadExists = threadMsgs.some(
        (m) =>
          m.senderId !== appUser.id &&
          m.timestamp > (appUser.readReceipts?.[activeThread.id] || 0)
      );
      if (unreadExists) {
        updateDoc(doc(db, "users", appUser.id), {
          [`readReceipts.${activeThread.id}`]:
            threadMsgs[threadMsgs.length - 1].timestamp,
        }).catch((err) => console.error(err));
      }
    }
  }, [threadMsgs, activeThread, appUser.id, appUser.readReceipts]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim() || !activeThread) return;
    setMessages((prev) => [
      ...(prev || []),
      {
        id: Date.now().toString(),
        threadId: activeThread.id,
        senderId: appUser.id,
        text: text.trim(),
        timestamp: Date.now(),
      },
    ]);
    setText("");
  };

  if (activeThread) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-zinc-200 rounded-2xl shadow-sm h-[70vh] flex flex-col overflow-hidden">
        <div className="bg-zinc-50 p-4 border-b border-zinc-200 flex items-center gap-3">
          <button
            onClick={() => setActiveThread(null)}
            className="p-2 -ml-2 hover:bg-zinc-200 rounded-lg text-zinc-500"
          >
            <ChevronLeft />
          </button>
          <div className="font-bold text-lg text-zinc-900">
            {activeThread.label}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {threadMsgs.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 italic">
              No messages yet. Start the conversation!
            </div>
          ) : null}
          {threadMsgs.map((m) => {
            const isMe = m.senderId === appUser.id;
            const sender = users.find((u) => u.id === m.senderId);
            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                <div className="text-[10px] text-zinc-500 mb-1 px-1">
                  {isMe ? "You" : sender?.name || "System"} •{" "}
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </div>
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                    isMe
                      ? "bg-zinc-900 text-white rounded-tr-sm"
                      : "bg-zinc-100 text-zinc-900 rounded-tl-sm"
                  }`}
                >
                  {m.text && <p>{m.text}</p>}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={handleSend}
          className="p-3 bg-zinc-50 border-t border-zinc-200 flex gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 bg-white border border-zinc-300 rounded-full"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="bg-zinc-900 text-white p-3 rounded-full disabled:opacity-50"
          >
            <MessageSquare size={20} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-zinc-50 p-4 border-b border-zinc-200 font-bold text-lg text-zinc-900">
        Inbox
      </div>
      <div className="divide-y divide-zinc-200">
        {threads.map((t) => {
          const unread = messages.filter(
            (m) =>
              m.threadId === t.id &&
              m.senderId !== appUser.id &&
              m.timestamp > (appUser.readReceipts?.[t.id] || 0)
          ).length;
          const tMsgs = messages.filter((m) => m.threadId === t.id);
          const lastMsg =
            tMsgs.length > 0
              ? tMsgs.sort((a, b) => a.timestamp - b.timestamp)[
                  tMsgs.length - 1
                ]
              : null;
          return (
            <button
              key={t.id}
              onClick={() => setActiveThread(t)}
              className="w-full flex items-center p-4 hover:bg-zinc-50 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 flex items-center justify-center mr-4">
                {t.icon || t.label.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <div className="font-bold text-zinc-900 truncate">
                    {t.label}
                  </div>
                  {lastMsg && (
                    <div className="text-xs text-zinc-500 ml-2">
                      {new Date(lastMsg.timestamp).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="text-sm text-zinc-500 truncate">
                  {lastMsg
                    ? `${lastMsg.senderId === appUser.id ? "You: " : ""}${
                        lastMsg.text
                      }`
                    : "No messages"}
                </div>
              </div>
              {unread > 0 && (
                <div className="ml-4 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unread} New
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Tab: Settings ---
const TabSettings = ({
  settings,
  setSettings,
  addToast,
  appUser,
  mockDB,
  currentDate,
}) => {
  const { prepItems = [], vendors = [] } = mockDB || {};
  const toggle = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 font-bold text-zinc-900">
          Push Notification Settings
        </div>
        <div className="p-2">
          {[
            {
              id: "notifPub",
              label: "Schedule Published",
              desc: "Notify me when management publishes a new schedule.",
            },
            {
              id: "notifChanges",
              label: "Schedule Changes",
              desc: "Notify me of shift swaps or admin changes to my shifts.",
            },
            {
              id: "notifMsg",
              label: "New Messages",
              desc: "Notify me when I receive a new inbox message.",
            },
            {
              id: "notifShift",
              label: "Shift Reminders",
              desc: "Notify me before my scheduled shift begins.",
            },
            ...(appUser.isAdmin
              ? [
                  {
                    id: "notifInv",
                    label: "Vendor Order Reminders",
                    desc: "Admin Only: Alerts you 3 hours before vendor ordering cutoffs.",
                  },
                ]
              : []),
          ].map((s, i, arr) => (
            <div
              key={s.id}
              className={`p-4 ${
                i !== arr.length - 1 ? "border-b border-zinc-200" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900 mb-1">{s.label}</div>
                  <div className="text-sm text-zinc-500">{s.desc}</div>
                </div>
                <button
                  onClick={() => toggle(s.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 border ${
                    settings[s.id]
                      ? "bg-zinc-900 border-zinc-900"
                      : "bg-zinc-300 border-zinc-300"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform shadow-sm bg-white ${
                      settings[s.id] ? "translate-x-6" : "translate-x-0"
                    }`}
                  ></div>
                </button>
              </div>
              {s.id === "notifShift" && settings.notifShift && (
                <div className="mt-4 pt-4 border-t border-zinc-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-700">
                    Reminder Time:
                  </span>
                  <select
                    value={
                      settings.shiftReminderTime !== undefined
                        ? settings.shiftReminderTime
                        : 60
                    }
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        shiftReminderTime: Number(e.target.value),
                      }))
                    }
                    className="p-2 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900"
                  >
                    <option value={0}>At start of shift</option>
                    <option value={15}>15 mins before</option>
                    <option value={30}>30 mins before</option>
                    <option value={60}>1 hour before</option>
                    <option value={120}>2 hours before</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 text-center space-y-4 shadow-sm">
        <h4 className="font-bold text-zinc-900">Test Your Notifications</h4>
        <div className="flex flex-col sm:flex-row justify-center gap-4 flex-wrap">
          <button
            onClick={() =>
              addToast(
                "Shift Reminder",
                "Your shift starts in 60 minutes. Have a great shift!"
              )
            }
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg font-bold"
          >
            Test Shift Alert
          </button>
          <button
            onClick={() =>
              addToast(
                `New Message from ${appUser.name}`,
                "Hey! Can anyone cover my shift tomorrow night?"
              )
            }
            className="bg-zinc-100 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-lg font-bold"
          >
            Simulate Message
          </button>
          {appUser.isAdmin && (
            <button
              onClick={() =>
                vendors.length > 0
                  ? addToast(
                      "Inventory Reminder",
                      `Warning: ${vendors[0].name} order due in 3 hours.`
                    )
                  : addToast("Error", "Add a vendor first.")
              }
              className="bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg font-bold"
            >
              Simulate Vendor Alert
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
