/**
 * Sietch Telegram Mini App
 * 
 * Mobile-friendly interface for Member Directory and Profile management.
 * Built with React and @twa-dev/sdk for Telegram integration.
 */

import React, { useEffect, useState, useCallback } from 'react';
import WebApp from '@twa-dev/sdk';
import { DirectoryPage } from './pages/Directory';
import { ProfilePage } from './pages/Profile';
import { VerifyPage } from './pages/Verify';
import { useTelegramUser } from './hooks/useTelegramUser';
import type { UserProfile, DirectoryEntry } from '@sietch/shared/types';

// =============================================================================
// TYPES
// =============================================================================

type Page = 'directory' | 'profile' | 'verify' | 'settings';

interface AppState {
  page: Page;
  profile: UserProfile | null;
  isVerified: boolean;
  isLoading: boolean;
  error: string | null;
}

// =============================================================================
// API CLIENT
// =============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.sietch.example.com';

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = WebApp.initData;
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

export function App() {
  const { user, isValid } = useTelegramUser();
  const [state, setState] = useState<AppState>({
    page: 'directory',
    profile: null,
    isVerified: false,
    isLoading: true,
    error: null,
  });

  // Initialize the Mini App
  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    
    // Set theme colors
    WebApp.setHeaderColor('#1a1a2e');
    WebApp.setBackgroundColor('#16213e');
    
    // Enable closing confirmation
    WebApp.enableClosingConfirmation();
  }, []);

  // Fetch user profile on mount
  useEffect(() => {
    if (!user?.id) return;

    async function fetchProfile() {
      try {
        const profile = await apiCall<UserProfile>(`/api/profile/telegram/${user!.id}`);
        setState(prev => ({
          ...prev,
          profile,
          isVerified: true,
          isLoading: false,
        }));
      } catch (error) {
        // User not verified yet
        setState(prev => ({
          ...prev,
          isVerified: false,
          isLoading: false,
        }));
      }
    }

    fetchProfile();
  }, [user?.id]);

  // Handle back button
  useEffect(() => {
    const handleBackButton = () => {
      if (state.page !== 'directory') {
        navigate('directory');
      } else {
        WebApp.close();
      }
    };

    WebApp.BackButton.onClick(handleBackButton);
    
    if (state.page !== 'directory') {
      WebApp.BackButton.show();
    } else {
      WebApp.BackButton.hide();
    }

    return () => {
      WebApp.BackButton.offClick(handleBackButton);
    };
  }, [state.page]);

  // Navigation
  const navigate = useCallback((page: Page) => {
    setState(prev => ({ ...prev, page }));
  }, []);

  // Handle verification completion
  const handleVerificationComplete = useCallback((profile: UserProfile) => {
    setState(prev => ({
      ...prev,
      profile,
      isVerified: true,
      page: 'profile',
    }));
    WebApp.showAlert('Verification complete! Welcome to Sietch.');
  }, []);

  // Show loading state
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sietch-dark">
        <div className="animate-pulse text-sietch-gold">Loading...</div>
      </div>
    );
  }

  // Show verification page if not verified
  if (!state.isVerified) {
    return (
      <VerifyPage
        telegramUser={user}
        onComplete={handleVerificationComplete}
      />
    );
  }

  // Render current page
  return (
    <div className="min-h-screen bg-sietch-dark text-sietch-sand">
      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-sietch-darker border-t border-sietch-gold/20">
        <div className="flex justify-around py-3">
          <NavButton
            active={state.page === 'directory'}
            onClick={() => navigate('directory')}
            icon="👥"
            label="Directory"
          />
          <NavButton
            active={state.page === 'profile'}
            onClick={() => navigate('profile')}
            icon="👤"
            label="Profile"
          />
          <NavButton
            active={state.page === 'settings'}
            onClick={() => navigate('settings')}
            icon="⚙️"
            label="Settings"
          />
        </div>
      </nav>

      {/* Page Content */}
      <main className="pb-20">
        {state.page === 'directory' && (
          <DirectoryPage onSelectMember={(nym) => console.log('Selected:', nym)} />
        )}
        {state.page === 'profile' && state.profile && (
          <ProfilePage
            profile={state.profile}
            isOwnProfile={true}
            onUpdate={(updates) => {
              setState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, ...updates } : null,
              }));
            }}
          />
        )}
        {state.page === 'settings' && (
          <SettingsPage profile={state.profile} />
        )}
      </main>
    </div>
  );
}

// =============================================================================
// NAVIGATION BUTTON
// =============================================================================

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
        active
          ? 'text-sietch-gold'
          : 'text-sietch-sand/60 hover:text-sietch-sand'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

// =============================================================================
// SETTINGS PAGE (Inline for simplicity)
// =============================================================================

interface SettingsPageProps {
  profile: UserProfile | null;
}

function SettingsPage({ profile }: SettingsPageProps) {
  const handleDisconnect = useCallback(() => {
    WebApp.showConfirm(
      'Are you sure you want to disconnect your wallet?',
      (confirmed) => {
        if (confirmed) {
          // TODO: Implement disconnect logic
          WebApp.showAlert('Wallet disconnected');
        }
      }
    );
  }, []);

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-sietch-gold">Settings</h1>
      
      {/* Account Section */}
      <section className="bg-sietch-darker rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span>Nym</span>
            <span className="text-sietch-gold">{profile?.nym || 'Not set'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Tier</span>
            <span className="text-sietch-gold capitalize">{profile?.tier || 'None'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Rank</span>
            <span className="text-sietch-gold">#{profile?.rank || 'N/A'}</span>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="bg-sietch-darker rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">Privacy</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span>Profile Visibility</span>
            <select
              className="bg-sietch-dark border border-sietch-gold/30 rounded px-2 py-1"
              defaultValue={profile?.visibility || 'members_only'}
            >
              <option value="public">Public</option>
              <option value="members_only">Members Only</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-900/20 rounded-xl p-4 border border-red-500/30">
        <h2 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h2>
        
        <button
          onClick={handleDisconnect}
          className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Disconnect Wallet
        </button>
      </section>

      {/* Version Info */}
      <div className="text-center text-sietch-sand/40 text-sm">
        <p>Sietch Mini App v1.0.0</p>
        <p>Powered by Collab.Land</p>
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { apiCall };
