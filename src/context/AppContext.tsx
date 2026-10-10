import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role, WorkflowConfig, Department, DDO } from '../types';
import { api } from '../server/api';
import { db } from '../server/db';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  departments: Department[];
  ddos: DDO[];
  activeRole: Role;
  switchRole: (role: Role) => void;
  switchUser: (userId: string) => void;
  refreshData: () => Promise<void>;
  resetDemoData: () => void;
  workflowConfig: WorkflowConfig | null;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [ddos, setDdos] = useState<DDO[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const state = db.getState();
      setUsers(state.users);
      setDepartments(state.departments);
      setDdos(state.ddos);
      setWorkflowConfig(state.workflowConfig);

      // Keep currentUser synced
      if (currentUser) {
        const updated = state.users.find((u) => u.id === currentUser.id);
        if (updated) setCurrentUser(updated);
      } else if (state.users.length > 0) {
        // Default to Super Admin for initial load
        const admin = state.users.find((u) => u.role === 'Super Admin') || state.users[0];
        setCurrentUser(admin);
      }
    } catch (e: any) {
      console.error('Failed to load app data:', e);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshData();
  }, []);

  const switchRole = useCallback((role: Role) => {
    const state = db.getState();
    const candidate = state.users.find((u) => u.role === role);
    if (candidate) {
      setCurrentUser(candidate);
      addToast({
        type: 'info',
        title: `Switched Role to ${role}`,
        message: `Acting as ${candidate.name} (${candidate.email})`,
      });
    }
  }, [addToast]);

  const switchUser = useCallback((userId: string) => {
    const state = db.getState();
    const target = state.users.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      addToast({
        type: 'info',
        title: `Logged in as ${target.name}`,
        message: `Role: ${target.role} | DDOs: ${target.ddoIds.join(', ') || 'N/A'}`,
      });
    }
  }, [addToast]);

  const resetDemoData = useCallback(() => {
    api.resetDemo();
    const state = db.getState();
    setUsers(state.users);
    setDepartments(state.departments);
    setDdos(state.ddos);
    setWorkflowConfig(state.workflowConfig);
    const admin = state.users.find((u) => u.role === 'Super Admin') || state.users[0];
    setCurrentUser(admin);
    addToast({
      type: 'success',
      title: 'Demo Data Reset',
      message: 'All departments, grants, DDOs, bills and audit trails have been restored to initial seed state.',
    });
  }, [addToast]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center p-8">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-tight">Loading GBA DC-BMS...</h2>
          <p className="text-sm text-slate-400 mt-1">Initializing database and security policies</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        departments,
        ddos,
        activeRole: currentUser.role,
        switchRole,
        switchUser,
        refreshData,
        resetDemoData,
        workflowConfig,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
