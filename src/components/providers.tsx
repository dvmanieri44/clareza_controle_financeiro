"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { firebase, firebaseConfigured } from "@/lib/firebase/client";
import { errorMessage, initializeUser, userCollection } from "@/lib/firebase/repository";
import { collections, emptyData, type FinanceData } from "@/lib/domain/types";
interface Session { user: User | null; loading: boolean; data: FinanceData; dataLoading: boolean; error: string; deletionPending: boolean; revision: number; refresh: () => void; logout: () => Promise<void>; }
const Context = createContext<Session | null>(null);
export function useFinance() { const value = useContext(Context); if (!value) throw new Error("Provider ausente."); return value; }
function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [data, setData] = useState<FinanceData>(emptyData);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletionPending, setDeletionPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [refresh]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    let cleanup = () => {}; let generation = 0;
    const unsubscribe = onAuthStateChanged(firebase().auth, async current => {
      const token = ++generation; cleanup(); setUser(current); setData(emptyData); setError(""); setDeletionPending(false); setLoading(false); setDataLoading(!!current);
      if (!current) return;
      try {
        const pendingDeletion = await initializeUser(current.uid); if (generation !== token) return;
        setDeletionPending(pendingDeletion);
        const coreCollections = collections.filter(key => !["entries", "goalMovements", "snapshots"].includes(key));
        const pending = new Set(coreCollections);
        const stops = coreCollections.map(key => onSnapshot(userCollection(current.uid, key), snapshot => {
          if (generation !== token) return;
          setData(old => ({ ...old, [key]: snapshot.docs.map(d => ({ ...d.data(), id: d.id })) }));
          pending.delete(key); if (!pending.size) setDataLoading(false);
        }, err => { if (generation === token) { setError(errorMessage(err)); setDataLoading(false); } }));
        stops.push(onSnapshot(doc(firebase().db, "users", current.uid), snapshot => {
          if (generation === token && snapshot.exists()) setDeletionPending(!!snapshot.data().deletionStartedAt);
        }, err => { if (generation === token) setError(errorMessage(err)); }));
        cleanup = () => stops.forEach(stop => stop());
      } catch (err) { if (generation === token) { setError(errorMessage(err)); setDataLoading(false); } }
    }, err => { setError(errorMessage(err)); setLoading(false); });
    return () => { generation++; cleanup(); unsubscribe(); };
  }, []);
  return <Context.Provider value={{ user, loading, data, dataLoading, error, deletionPending, revision, refresh, logout: () => signOut(firebase().auth) }}>{children}</Context.Provider>;
}
export function Providers({ children }: { children: ReactNode }) { return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><SessionProvider>{children}<Toaster richColors position="top-right" /></SessionProvider></ThemeProvider>; }
