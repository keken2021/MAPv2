/* 
  file summary: split-screen authentication login page component matching exact mockup design.
  responsibilities: presents marine assurance platform value proposition and a credentials + mock MFA sign-in flow.
  role in system: login screen rendered when user is unauthenticated; role switching happens after login via the header.
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';

/**
  what: renders the split-screen login page with value proposition on left and sign-in form on right.
  how: credentials advance to a mock MFA step styled like authenticator 2FA; any 6-digit code completes login.
  with what file: src/views/LoginView.tsx loaded by App.tsx.
*/
export const LoginView: React.FC = () => {
  const { login } = useMapStore();
  const [username, setUsername] = useState('k.osei@northwindmarine.com');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(false);
  const [authStep, setAuthStep] = useState<'credentials' | 'mfa'>('credentials');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [pendingRole, setPendingRole] = useState<'Administrator' | 'C Admin'>('Administrator');

  const handleCredentialsSubmit = (e: React.FormEvent, role: 'Administrator' | 'C Admin' = 'Administrator') => {
    e.preventDefault();
    setPendingRole(role);
    setMfaCode('');
    setMfaError('');
    setAuthStep('mfa');
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setMfaError('Please enter a valid 6-digit verification code.');
      return;
    }
    setMfaError('');
    login(pendingRole);
  };

  const formatMfaDisplay = (digits: string) => {
    const clean = digits.replace(/\D/g, '').slice(0, 6);
    if (clean.length <= 3) return clean;
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  };

  return (
    <div className="d-flex w-100 min-vh-100 overflow-hidden">
      {/* left column: dark navy pitch & standards footer */}
      <div
        className="d-flex flex-column justify-content-between p-5 text-white"
        style={{
          width: '45%',
          minWidth: '450px',
          backgroundColor: 'rgb(11, 27, 43)',
        }}
      >
        {/* top brand header */}
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center fw-bold text-white shadow-sm"
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#0d9488',
              borderRadius: '6px',
              fontSize: '1.1rem',
            }}
          >
            M
          </div>
          <div className="d-flex flex-column">
            <span className="fw-bold text-white" style={{ fontSize: '1.15rem', letterSpacing: '0.02em', lineHeight: '1.2' }}>
              Marine Assurance Platform
            </span>
            <span className="font-mono-code text-uppercase" style={{ fontSize: '0.675rem', color: '#64748b', letterSpacing: '0.08em' }}>
              OSV COMPLIANCE
            </span>
          </div>
        </div>

        {/* center main headline & body */}
        <div className="my-auto py-5" style={{ maxWidth: '520px' }}>
          <div className="font-mono-code text-uppercase fw-semibold mb-3" style={{ fontSize: '0.75rem', color: '#38bdf8', letterSpacing: '0.12em' }}>
            SINGLE SOURCE OF TRUTH
          </div>
          <h1 className="fw-bold text-white mb-4" style={{ fontSize: '2.5rem', lineHeight: '1.18', letterSpacing: '-0.02em' }}>
            Vessel and crew certification, verified end to end.
          </h1>
          <p className="lh-lg mb-0" style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
            Statutory, class and crew certificates in one auditable workflow — extraction, validation, verification, inspection and approval across the Client, the Provider and appointed third parties.
          </p>
        </div>

        {/* bottom maritime standards footer */}
        <div className="d-flex align-items-center gap-5 pt-4 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div>
            <div className="fw-bold text-white font-mono-code" style={{ fontSize: '1.1rem' }}>IMO</div>
            <div className="small" style={{ fontSize: '0.75rem', color: '#64748b' }}>SOLAS · ISM</div>
          </div>
          <div>
            <div className="fw-bold text-white font-mono-code" style={{ fontSize: '1.1rem' }}>STCW</div>
            <div className="small" style={{ fontSize: '0.75rem', color: '#64748b' }}>Crew competency</div>
          </div>
          <div>
            <div className="fw-bold text-white font-mono-code" style={{ fontSize: '1.1rem' }}>AMSA</div>
            <div className="small" style={{ fontSize: '0.75rem', color: '#64748b' }}>Australian standards</div>
          </div>
        </div>
      </div>

      {/* right column: credentials or MFA */}
      <div
        className="d-flex flex-column justify-content-center align-items-center p-5 grow position-relative"
        style={{ backgroundColor: authStep === 'mfa' ? '#ffffff' : '#f1f5f9' }}
      >
        <div style={{ width: '100%', maxWidth: authStep === 'mfa' ? '420px' : '540px' }}>
          {authStep === 'credentials' ? (
            <>
              <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1" style={{ fontSize: '2rem', color: '#0f172a' }}>
                  Sign In
                </h2>
                <div className="font-mono-code small" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Access is based on your role.
                </div>
              </div>

              <form
                className="card border-0 shadow-sm p-4 p-md-5 mb-4"
                style={{ borderRadius: '12px', backgroundColor: '#ffffff' }}
                onSubmit={(e) => handleCredentialsSubmit(e, 'Administrator')}
              >
                <div className="mb-3">
                  <label className="form-label font-mono-code text-uppercase fw-semibold" style={{ fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.05em' }}>
                    USER NAME
                  </label>
                  <input
                    type="text"
                    className="form-control font-mono-code py-2 px-3 border-secondary-subtle"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ fontSize: '0.9rem', color: '#0f172a', borderRadius: '6px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label font-mono-code text-uppercase fw-semibold" style={{ fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.05em' }}>
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    className="form-control font-mono-code py-2 px-3 border-secondary-subtle"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ fontSize: '0.9rem', color: '#0f172a', borderRadius: '6px' }}
                  />
                </div>

                <div className="d-flex align-items-center justify-content-between mb-4">
                  <label className="d-flex align-items-center gap-2 mb-0" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem', color: '#475569' }}>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    style={{ fontSize: '0.875rem', color: '#64748b' }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn w-100 py-2 fw-semibold text-white border-0"
                  style={{ backgroundColor: 'rgb(11, 27, 43)', borderRadius: '6px', fontSize: '0.95rem' }}
                >
                  Sign In
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleMfaSubmit} data-testid="login-mfa-step" className="d-flex flex-column">
              <h2 className="fw-bold mb-3" style={{ fontSize: '1.75rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                Two-factor Authentication
              </h2>
              <p className="mb-1" style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.5 }}>
                You have turned on 2-factor authentication for extra security.
              </p>
              <p className="mb-4" style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.5 }}>
                Log in with the code from your authenticator app.
              </p>
              <p className="small mb-4" style={{ color: '#94a3b8' }}>
                Prototype: any 6 digits pass.
              </p>

              <label className="form-label fw-semibold mb-2" style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                Enter authentication code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="form-control py-3 px-3 mb-2"
                value={formatMfaDisplay(mfaCode)}
                onChange={(e) => {
                  setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setMfaError('');
                }}
                placeholder="XXX XXX"
                aria-label="6-digit verification code"
                style={{
                  fontSize: '1.15rem',
                  color: '#0f172a',
                  borderRadius: '8px',
                  letterSpacing: '0.18em',
                  borderColor: '#cbd5e1',
                  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.06)',
                }}
              />
              {mfaError && (
                <div className="text-danger small mb-3" data-testid="login-mfa-error">
                  {mfaError}
                </div>
              )}

              <button
                type="submit"
                className="btn w-100 py-2.5 fw-semibold text-white border-0 mt-2"
                style={{
                  backgroundColor: 'rgb(11, 27, 43)',
                  borderRadius: '999px',
                  fontSize: '1rem',
                }}
              >
                Verify
              </button>

              <button
                type="button"
                className="btn btn-link p-0 mt-3 text-decoration-none align-self-start"
                style={{ fontSize: '0.875rem', color: '#64748b' }}
                onClick={() => {
                  setAuthStep('credentials');
                  setMfaCode('');
                  setMfaError('');
                }}
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>

        {authStep === 'mfa' && (
          <div className="position-absolute bottom-0 end-0 p-4">
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-underline d-inline-flex align-items-center gap-2"
              style={{ fontSize: '0.875rem', color: '#0f172a' }}
            >
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-circle text-white"
                style={{ width: '18px', height: '18px', backgroundColor: '#0f172a', fontSize: '0.7rem' }}
                aria-hidden
              >
                ?
              </span>
              Get help
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
