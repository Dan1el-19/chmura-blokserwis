import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { UserRole } from "@/types";

interface StorageAuthState {
  user: ReturnType<typeof useAuthState>[0];
  loading: boolean;
  userRole: UserRole;
  isAuthenticated: boolean;
  getAuthToken: () => Promise<string | undefined>;
  refreshIdToken: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useStorageAuth(): StorageAuthState {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<UserRole>("basic");
  const router = useRouter();

  const getAuthToken = useCallback(async () => {
    return await user?.getIdToken();
  }, [user]);

  const refreshIdToken = useCallback(async () => {
    try {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      await refreshIdToken();
      const response = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${await getAuthToken()}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUserRole(userData.role);
      }
    } catch {
      // Silent fail
    }
  }, [getAuthToken, refreshIdToken]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch user data when user changes
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user, fetchUserData]);

  const logout = useCallback(async () => {
    try {
      await auth.signOut();
      router.push("/");
    } catch {
      throw new Error("Błąd podczas wylogowywania");
    }
  }, [router]);

  return {
    user,
    loading,
    userRole,
    isAuthenticated: !!user,
    getAuthToken,
    refreshIdToken,
    logout,
  };
}
