"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { usernameToAuthEmail } from "@/lib/auth/usernames";
import { auth, firebaseClientConfigured } from "@/lib/firebase/client";
import type { UserRole } from "@/types/User";

type SessionProfile = {
  uid: string;
  username: string;
  email: string;
  displayName?: string | null;
  role: UserRole;
  active: boolean;
};

type AuthContextValue = {
  user: User | null;
  profile: SessionProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signInWithToken: (customToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(user: User) {
  const token = await user.getIdToken();
  const response = await fetch("/api/auth/session", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to load Timer session.");
  }

  return (await response.json()) as SessionProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setProfile(null);
      return;
    }

    const nextProfile = await loadProfile(currentUser);
    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setError(null);
      setUser(nextUser);

      try {
        if (nextUser) {
          setProfile(await loadProfile(nextUser));
        } else {
          setProfile(null);
        }
      } catch (sessionError) {
        setProfile(null);
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to establish a Timer session."
        );
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setError(null);

    if (!firebaseClientConfigured) {
      throw new Error("Firebase client environment variables are not configured.");
    }

    await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
  }, []);

  const signInWithToken = useCallback(async (customToken: string) => {
    if (!firebaseClientConfigured) {
      throw new Error("Firebase client environment variables are not configured.");
    }
    await signInWithCustomToken(auth, customToken);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const getToken = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("You must be signed in.");
    }

    return currentUser.getIdToken();
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      signIn,
      signInWithToken,
      signOut,
      getToken,
      refreshProfile
    }),
    [error, getToken, loading, profile, refreshProfile, signIn, signInWithToken, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
