'use client';

import React from 'react';
import {
  Shield, Lock, Eye, FileText, Server, Globe,
  CheckCircle2,
} from 'lucide-react';

const COMPLIANCE_ITEMS = [
  {
    icon: Shield,
    title: 'DPDP Act 2023 Compliance',
    description: 'Immutable clinical audit logs recording every demographic and medical access with operator ID, IP address, and timestamp.',
    badges: ['Audit Trail', 'Data Protection', 'Consent Management'],
  },
  {
    icon: Lock,
    title: 'Role-Based Access Control (RBAC)',
    description: 'Strict separation of clinical notes, pharmacy stock, and financial invoices. Each role sees only what they need.',
    badges: ['6 Distinct Roles', 'Permission Matrix', 'Least Privilege'],
  },
  {
    icon: Server,
    title: 'Secure Medical Storage',
    description: 'Cloudinary medical asset segregation per hospital ID with encrypted transmission and access-controlled retrieval.',
    badges: ['Per-Hospital Isolation', 'Encrypted CDN', 'Access Logs'],
  },
  {
    icon: Globe,
    title: 'Encrypted Sessions & Transport',
    description: 'HttpOnly, SameSite cookies with JSON Web Tokens. All API communication secured with TLS encryption.',
    badges: ['JWT Auth', 'HttpOnly Cookies', 'TLS 1.3'],
  },
];

export default function ComplianceSecuritySection() {
  return (
    <section className="compliance-section" id="compliance">
      <div className="compliance-section__container">
        <div className="compliance-section__header">
          <span className="compliance-section__eyebrow">Security &amp; Compliance</span>
          <h2 className="compliance-section__title">
            Enterprise-Grade <span className="text-[var(--brass)]">Security</span> Built In
          </h2>
          <p className="compliance-section__subtitle">
            Every layer of DermaTrack is designed with healthcare data protection, DPDP compliance,
            and clinical audit requirements as first-class priorities.
          </p>
        </div>

        <div className="compliance-section__grid">
          {COMPLIANCE_ITEMS.map((item, i) => (
            <div key={i} className="compliance-section__card">
              <div className="compliance-section__card-icon">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="compliance-section__card-title">{item.title}</h3>
              <p className="compliance-section__card-desc">{item.description}</p>
              <div className="compliance-section__card-badges">
                {item.badges.map((badge) => (
                  <span key={badge} className="compliance-section__card-badge">
                    <CheckCircle2 className="w-3 h-3" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
