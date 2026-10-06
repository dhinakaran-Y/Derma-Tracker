'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/AppShell';
import { Panel } from '../../../../components/Panel';
import { Badge, BadgeVariant } from '../../../../components/Badge';
import { KpiCard } from '../../../../components/KpiCard';
import { api } from '../../../../lib/api';
import { Patient, Visit } from '../../../../types';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Activity,
  TrendingUp,
  Scale,
  Ruler,
  Calendar,
  User,
  Heart,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface VitalsDataPoint {
  visitId: string;
  date: string;
  formattedDate: string;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bmiCategory: string | null;
  visitType: string;
  doctorName: string;
  notes: string;
}

export default function PatientVitalsHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params?.patientId as string;

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [chartMetric, setChartMetric] = useState<'all' | 'weight' | 'bmi'>('all');

  useEffect(() => {
    if (!patientId) return;

    const fetchVitals = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/doctor/patient/${patientId}/vitals`);
        setPatient(res.data.data.patient);
        setVisits(res.data.data.visits || []);
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to load patient vitals history');
      } finally {
        setLoading(false);
      }
    };

    fetchVitals();
  }, [patientId]);

  // Process visits into chronological chart & table data
  const vitalsHistory: VitalsDataPoint[] = React.useMemo(() => {
    if (!visits.length && !patient) return [];

    const baselineHeight = patient?.heightCm || null;

    return visits.map((v) => {
      const vDate = new Date(v.visitDate);
      const formattedDate = vDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const weight = v.weightKg ?? null;
      const height = v.heightCm ?? baselineHeight;
      let bmi: number | null = null;
      let bmiCategory: string | null = null;

      if (weight && height && height > 0) {
        const hM = height / 100;
        bmi = Number((weight / (hM * hM)).toFixed(1));
        if (bmi < 18.5) bmiCategory = 'Underweight';
        else if (bmi < 25) bmiCategory = 'Normal';
        else if (bmi < 30) bmiCategory = 'Overweight';
        else bmiCategory = 'Obese';
      }

      const docName = typeof v.doctorId === 'object' ? (v.doctorId as any)?.fullName : 'Doctor';

      return {
        visitId: v._id,
        date: v.visitDate,
        formattedDate,
        weightKg: weight,
        heightCm: height,
        bmi,
        bmiCategory,
        visitType: v.visitType === 'FirstVisit' ? 'Initial Visit' : 'Follow-up',
        doctorName: docName || 'Doctor',
        notes: v.chiefComplaint || v.diagnosis || '—',
      };
    });
  }, [visits, patient]);

  // Vitals summary calculations
  const visitsWithWeight = vitalsHistory.filter((vh) => vh.weightKg !== null);
  const latestVitals = visitsWithWeight.length > 0 ? visitsWithWeight[visitsWithWeight.length - 1] : null;
  const firstVitals = visitsWithWeight.length > 0 ? visitsWithWeight[0] : null;

  const weightDelta =
    latestVitals && firstVitals && latestVitals.weightKg !== null && firstVitals.weightKg !== null
      ? Number((latestVitals.weightKg - firstVitals.weightKg).toFixed(1))
      : 0;

  const latestHeight = latestVitals?.heightCm || patient?.heightCm || null;
  const latestBmi = latestVitals?.bmi || null;

  const getBmiBadgeVariant = (category: string | null): BadgeVariant => {
    switch (category) {
      case 'Normal':
        return 'success';
      case 'Underweight':
      case 'Overweight':
        return 'warn';
      case 'Obese':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const diff = new Date().getTime() - new Date(dobString).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  };

  const patientAge = calculateAge(patient?.dateOfBirth);

  const navGroups = [
    {
      title: 'Clinical Suite',
      items: [
        { id: 'workbench', label: 'Doctor Workbench', icon: Stethoscope },
        { id: 'vitals', label: 'Patient Vitals Analytics', icon: Activity },
      ],
    },
  ];

  if (loading) {
    return (
      <AppShell
        navGroups={navGroups}
        activeTab="vitals"
        onTabChange={() => router.push('/doctor')}
        pageTitle="Patient Vitals Analytics"
      >
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brass)]" />
          <span className="font-mono text-sm text-[var(--text-dim)]">Loading vitals analytics...</span>
        </div>
      </AppShell>
    );
  }

  if (!patient) {
    return (
      <AppShell
        navGroups={navGroups}
        activeTab="vitals"
        onTabChange={() => router.push('/doctor')}
        pageTitle="Patient Vitals Analytics"
      >
        <div className="surface-card p-8 text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">Patient Not Found</h2>
          <p className="text-sm text-[var(--text-dim)]">The requested patient record could not be loaded.</p>
          <button
            onClick={() => router.push('/doctor')}
            className="btn-brass px-4 py-2 rounded text-xs font-mono inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workbench</span>
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      navGroups={navGroups}
      activeTab="vitals"
      onTabChange={() => router.push('/doctor')}
      pageTitle="Patient Vitals Analytics"
    >
      <div className="space-y-6">
        {/* Top Navigation & Patient Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/doctor')}
              className="p-2 rounded-md bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all flex items-center gap-1.5 text-xs font-mono cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Workbench</span>
            </button>
            <div className="h-5 w-px bg-[var(--border)]" />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display font-bold text-xl text-[var(--text)]">{patient.name}</h1>
                <Badge variant="brass">
                  {patient.gender || 'Patient'}
                  {patientAge ? ` • ${patientAge} yrs` : ''}
                </Badge>
                {patient.maritalStatus && (
                  <Badge variant="neutral">{patient.maritalStatus}</Badge>
                )}
                {patient.bloodGroup && (
                  <Badge variant="info">Blood: {patient.bloodGroup}</Badge>
                )}
              </div>
              <span className="font-mono text-xs text-[var(--text-dim)]">
                Patient ID: {patient.patientId} • Phone: +91 {patient.phone}
                {patient.location ? ` • ${patient.location}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* KPI Metrics Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Current Weight"
            value={latestVitals?.weightKg ? `${latestVitals.weightKg} kg` : 'N/A'}
            delta={
              weightDelta !== 0
                ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg`
                : 'Baseline'
            }
            deltaType={weightDelta <= 0 ? 'positive' : 'warn'}
            subtext={weightDelta !== 0 ? 'Change since initial consultation' : 'Initial baseline consultation'}
            icon={<Scale className="w-4 h-4" />}
          />
          <KpiCard
            label="Recorded Height"
            value={latestHeight ? `${latestHeight} cm` : 'N/A'}
            subtext="Baseline anatomical record"
            icon={<Ruler className="w-4 h-4" />}
          />
          <KpiCard
            label="Body Mass Index (BMI)"
            value={latestBmi ? `${latestBmi} kg/m²` : 'N/A'}
            delta={latestVitals?.bmiCategory || undefined}
            deltaType={
              latestVitals?.bmiCategory === 'Normal'
                ? 'positive'
                : latestVitals?.bmiCategory === 'Obese'
                ? 'negative'
                : 'warn'
            }
            subtext="Calculated from weight & height"
            icon={<Heart className="w-4 h-4" />}
          />
          <KpiCard
            label="Total Clinic Visits"
            value={visits.length}
            subtext={`${visitsWithWeight.length} with recorded vitals`}
            icon={<Calendar className="w-4 h-4" />}
          />
        </div>

        {/* Interactive Recharts Graph Section */}
        <Panel
          title="Vitals Progression & Trend Graph"
          subtitle="Chronological trajectory of patient weight, height, and computed BMI across clinic consultations"
        >
          <div className="space-y-4">
            {/* Metric Selector Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChartMetric('all')}
                  className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
                    chartMetric === 'all'
                      ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold'
                      : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  All Metrics (Dual Axis)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('weight')}
                  className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
                    chartMetric === 'weight'
                      ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold'
                      : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  Weight Only (kg)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('bmi')}
                  className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
                    chartMetric === 'bmi'
                      ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold'
                      : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                  }`}
                >
                  BMI Only (kg/m²)
                </button>
              </div>

              {latestVitals?.bmiCategory && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[var(--text-dim)]">Current Status:</span>
                  <Badge variant={getBmiBadgeVariant(latestVitals.bmiCategory)}>
                    {latestVitals.bmiCategory} ({latestBmi} kg/m²)
                  </Badge>
                </div>
              )}
            </div>

            {/* Graph Display */}
            {vitalsHistory.length > 0 ? (
              <div className="h-[340px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalsHistory} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="formattedDate"
                      stroke="var(--text-dim)"
                      tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
                      tickLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis
                      yAxisId="weight"
                      domain={['dataMin - 5', 'dataMax + 5']}
                      stroke="#d4af37"
                      tick={{ fill: '#d4af37', fontSize: 11 }}
                      tickLine={{ stroke: '#d4af37' }}
                      unit=" kg"
                    />
                    <YAxis
                      yAxisId="bmi"
                      orientation="right"
                      domain={[15, 35]}
                      stroke="#10b981"
                      tick={{ fill: '#10b981', fontSize: 11 }}
                      tickLine={{ stroke: '#10b981' }}
                      unit=" BMI"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161616',
                        borderColor: 'rgba(212,175,55,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}
                      formatter={(val: any, name: any) => {
                        if (name === 'Weight') return [`${val} kg`, 'Weight'];
                        if (name === 'BMI') return [`${val} kg/m²`, 'BMI'];
                        if (name === 'Height') return [`${val} cm`, 'Height'];
                        return [val, name];
                      }}
                      labelFormatter={(lbl) => `Visit Date: ${lbl}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                    {(chartMetric === 'all' || chartMetric === 'weight') && (
                      <Line
                        yAxisId="weight"
                        type="monotone"
                        dataKey="weightKg"
                        name="Weight"
                        stroke="#d4af37"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#d4af37', stroke: '#161616', strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    )}

                    {(chartMetric === 'all' || chartMetric === 'bmi') && (
                      <Line
                        yAxisId="bmi"
                        type="monotone"
                        dataKey="bmi"
                        name="BMI"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: '#10b981', stroke: '#161616', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-12 text-center text-sm font-mono text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded-md">
                No vitals records available for chart plotting.
              </div>
            )}
          </div>
        </Panel>

        {/* Detailed Chronological Table */}
        <Panel
          title="Vitals Consultation Log"
          subtitle="Full record of patient measurements captured across all registered visits"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-dim)] uppercase tracking-wider bg-[var(--surface-2)]">
                  <th className="py-3 px-4">Visit Date</th>
                  <th className="py-3 px-4">Visit Type</th>
                  <th className="py-3 px-4">Weight (kg)</th>
                  <th className="py-3 px-4">Height (cm)</th>
                  <th className="py-3 px-4">BMI (kg/m²)</th>
                  <th className="py-3 px-4">BMI Classification</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Clinical Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {vitalsHistory.length > 0 ? (
                  vitalsHistory
                    .slice()
                    .reverse()
                    .map((vh) => (
                      <tr key={vh.visitId} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-3 px-4 font-semibold text-[var(--text)]">{vh.formattedDate}</td>
                        <td className="py-3 px-4">
                          <Badge variant={vh.visitType === 'Initial Visit' ? 'warn' : 'neutral'}>
                            {vh.visitType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[var(--brass)]">
                          {vh.weightKg !== null ? `${vh.weightKg} kg` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {vh.heightCm !== null ? `${vh.heightCm} cm` : '—'}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {vh.bmi !== null ? `${vh.bmi}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {vh.bmiCategory ? (
                            <Badge variant={getBmiBadgeVariant(vh.bmiCategory)}>
                              {vh.bmiCategory}
                            </Badge>
                          ) : (
                            <span className="text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-dim)]">{vh.doctorName}</td>
                        <td className="py-3 px-4 text-[var(--text-dim)] max-w-xs truncate">{vh.notes}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--text-dim)]">
                      No visits recorded yet for this patient.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
