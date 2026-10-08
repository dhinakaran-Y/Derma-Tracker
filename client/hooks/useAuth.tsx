'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { User, Patient, Hospital } from '../types';
import { getSocket, disconnectSocket } from '../lib/socket';

interface AuthContextType {
  user: User | null;
  patient: Patient | null;
  hospital: Hospital | null;
  userType: 'staff' | 'patient' | null;
  loading: boolean;
  loginStaff: (username: string, password: string) => Promise<void>;
  sendPatientOtp: (phone: string, channel?: 'sms' | 'whatsapp') => Promise<{ devOtp?: string; channel?: string; fallback?: boolean }>;
  verifyPatientOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  patient: null,
  hospital: null,
  userType: null,
  loading: true,
  loginStaff: async () => {},
  sendPatientOtp: async () => ({}),
  verifyPatientOtp: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [userType, setUserType] = useState<'staff' | 'patient' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.data?.type === 'staff') {
        setUser(res.data.data.user);
        setHospital(res.data.data.hospital || null);
        setUserType('staff');
        setPatient(null);
      } else if (res.data?.data?.type === 'patient') {
        setPatient(res.data.data.patient);
        setHospital(res.data.data.hospital || null);
        setUserType('patient');
        setUser(null);
      }
    } catch {
      setUser(null);
      setPatient(null);
      setHospital(null);
      setUserType(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginStaff = async (email: string, password: string) => {
    const res = await api.post('/auth/staff/login', { email, username: email, password });
    const { user: userData, hospital: hospitalData, token } = res.data.data;
    if (token) localStorage.setItem('token', token);
    setUser(userData);
    setHospital(hospitalData || null);
    setUserType('staff');
    setPatient(null);
    getSocket(token);

    // Navigate to role-specific dashboard
    switch (userData.role) {
      case 'Admin':
        router.push('/admin');
        break;
      case 'Doctor':
        router.push('/doctor');
        break;
      case 'Receptionist':
        router.push('/receptionist');
        break;
      case 'MedicationGiver':
        router.push('/medication-giver');
        break;
      case 'StockManager':
        router.push('/stock-manager');
        break;
      default:
        router.push('/admin');
    }
  };

  const sendPatientOtp = async (phone: string, channel: 'sms' | 'whatsapp' = 'sms') => {
    const res = await api.post('/auth/otp/send', { phone, channel });
    return res.data;
  };

  const verifyPatientOtp = async (phone: string, otp: string) => {
    const res = await api.post('/auth/otp/verify', { phone, otp });
    const { patient: patientData, hospital: hospitalData, token } = res.data.data;
    if (token) localStorage.setItem('token', token);
    setPatient(patientData);
    setHospital(hospitalData || null);
    setUserType('patient');
    setUser(null);
    getSocket(token);
    router.push('/patient');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('token');
    disconnectSocket();
    setUser(null);
    setPatient(null);
    setHospital(null);
    setUserType(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        patient,
        hospital,
        userType,
        loading,
        loginStaff,
        sendPatientOtp,
        verifyPatientOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
