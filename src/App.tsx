import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CVData,
  TemplateId,
  ActivePage,
  ResumeItem,
  CoverLetterItem,
  JobItem,
  PlanTier,
  UserAccountProfile,
} from './types';
import { getEffectivePlanTier } from './utils/planAccess';
import {
  INITIAL_CV_DATA,
  TEMPLATES,
  sanitizeResumeList,
  createDefaultResumeForUser,
  applyTemplatePlanOverrides,
} from './data/initialData';
import { sanitizeCVData } from './utils/sanitizeData';
import { LandingPage } from './components/landing/LandingPage';
import { CVBuilderPage } from './components/builder/CVBuilderPage';
import { JobseekerDashboard } from './components/dashboard/JobseekerDashboard';
import { LoginModal } from './components/dashboard/LoginModal';
import {
  subscribeToAuth,
  logoutUser,
  AuthUserState,
} from './firebase/authService';
import {
  fetchUserResumes,
  saveUserResume,
  deleteUserResume,
  batchSyncResumes,
  fetchUserCoverLetters,
  saveUserCoverLetter,
  deleteUserCoverLetter,
  fetchUserJobs,
  saveUserJob,
  deleteUserJob,
  isDeviceBlocked,
  fetchPlatformUsers,
  markResumesInitialized,
  checkAndIncrementDailyCvQuota,
  fetchTemplatePlanOverrides,
  setTemplatePlanTier,
} from './firebase/cvService';
import { getDeviceId, getBrowserFingerprint } from './utils/deviceId';

// Account-specific local storage keys to ensure each user account stores only its own data
const getAccountResumesKey = (uid?: string | null) =>
  uid ? `jobseeker_resumes_uid_${uid}` : 'jobseeker_resumes_guest';

const getAccountCoverLettersKey = (uid?: string | null) =>
  uid ? `jobseeker_cover_letters_uid_${uid}` : 'jobseeker_cover_letters_guest';

const getAccountJobsKey = (uid?: string | null) =>
  uid ? `jobseeker_jobs_uid_${uid}` : 'jobseeker_jobs_guest';

const STORAGE_USER_KEY = 'jobseeker_user_v1';

const sanitizeTrackedJobs = (list: any): JobItem[] => {
  if (!Array.isArray(list)) return [];
  return list.filter((j: any) => {
    if (!j || !j.id) return false;
    // Exclude mock seed jobs
    if (['job-1', 'job-2', 'job-3'].includes(j.id)) return false;
    // Only show jobs the user actually applied to
    if (j.status === 'saved') return false;
    return true;
  });
};

export default function App() {
  // Firebase Auth user state
  const [authUser, setAuthUser] = useState<AuthUserState | null>(null);

  // User display profile state (synced with Firebase or Local Storage)
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USER_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load user', e);
    }
    return null;
  });

  // Cloud sync status: 'saved' | 'saving' | 'error' | 'offline'
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'saved' | 'saving' | 'error' | 'offline'
  >('offline');

  // Resumes list state (loaded from account storage or guest storage)
  // Guests (not signed in) start with an empty list rather than demo resumes.
  const [resumes, setResumes] = useState<ResumeItem[]>(() => {
    try {
      const guestSaved = localStorage.getItem(getAccountResumesKey(null));
      if (guestSaved) {
        return sanitizeResumeList(JSON.parse(guestSaved), false);
      }
    } catch (e) {
      console.warn('Failed to load resumes', e);
    }
    return [];
  });

  // Cover letters state
  const [coverLetters, setCoverLetters] = useState<CoverLetterItem[]>(() => {
    try {
      const guestSaved = localStorage.getItem(getAccountCoverLettersKey(null));
      if (guestSaved) return JSON.parse(guestSaved);
    } catch (e) {
      console.warn('Failed to load cover letters', e);
    }
    return [];
  });

  // Jobs pipeline state (only jobs the user applied to)
  const [jobs, setJobs] = useState<JobItem[]>(() => {
    try {
      const guestSaved = localStorage.getItem(getAccountJobsKey(null));
      if (guestSaved) return sanitizeTrackedJobs(JSON.parse(guestSaved));
    } catch (e) {
      console.warn('Failed to load jobs', e);
    }
    return [];
  });

  // Currently active resume being edited
  const [activeResumeId, setActiveResumeId] = useState<string>(() => {
    return resumes[0]?.id || 'resume-sample-1';
  });

  // Navigation page
   const [currentPage, setCurrentPage] = useState<ActivePage>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('upgrade=success')) {
        const saved = localStorage.getItem('jobifycv_return_page');
        if (saved === 'builder' || saved === 'landing' || saved === 'dashboard') {
          window.location.hash = `#${saved}`;
          return saved as ActivePage;
        }
        window.location.hash = '#dashboard';
        return 'dashboard';
      }
      if (window.location.hash === '#builder') return 'builder';
      if (window.location.hash === '#dashboard') return 'dashboard';
    }
    return 'landing';
  });

  // Global Login Modal state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Set when this browser is on the admin's block list; shown as a persistent banner
  const [deviceBlockedMessage, setDeviceBlockedMessage] = useState<string | null>(null);

  // The current user's EFFECTIVE plan tier (Free Plan if their paid
  // subscription's 30-day window has lapsed) — drives which CV templates
  // they're allowed to use in the Landing page carousel & the Builder.
  const [userPlanTier, setUserPlanTier] = useState<PlanTier>('Free Plan');

  // When a locked template is clicked from the Landing page or Builder, we
  // navigate to the Dashboard and ask it to pop open the Pricing page.
  const [pendingOpenPricing, setPendingOpenPricing] = useState(false);
  // Shown as a transient top banner when a user hits their plan's daily
  // "create a new CV" limit (Free: 2/day, Basic: 5/day, Pro/Premium: unlimited).
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  // Bumped after admin-set template plan-tier overrides are applied to the
  // (mutable, shared) TEMPLATES array, purely to trigger a re-render so
  // components re-read the updated values.
  const [, forceTemplatesRerender] = useState(0);
  // Remembers which page (landing / builder) to return to after the user
  // finishes with the Pricing page they were routed to from a locked
  // template click — so "back"/close doesn't strand them on the dashboard.
  const [returnToPageAfterPricing, setReturnToPageAfterPricing] = useState<ActivePage | null>(null);
    // Mirror that into localStorage too, since a real PayWay redirect wipes
  // all in-memory React state — this is what survives the round trip.
  useEffect(() => {
    if (returnToPageAfterPricing) {
      localStorage.setItem('jobifycv_return_page', returnToPageAfterPricing);
    }
  }, [returnToPageAfterPricing]);
  // If the upgrade prompt came from the in-builder "Browse Designs" modal
  // specifically, reopen that modal too when we land back on the builder.
  const [reopenBuilderDesignModal, setReopenBuilderDesignModal] = useState(false);

  // Debounce timer reference for autosaving to Firestore
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen to Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (firebaseUser) {
        const blocked = await isDeviceBlocked(getDeviceId(), getBrowserFingerprint());
        if (blocked) {
          await logoutUser();
          setAuthUser(null);
          setDeviceBlockedMessage(
            'This device has been blocked from accessing JobifyCV. If you believe this is a mistake, please contact support.'
          );
          return;
        }
      }

      setAuthUser(firebaseUser);

      if (firebaseUser) {
        const profile = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
        };
        setUser(profile);
        setCloudSyncStatus('saving');

        // Look up this account's plan tier (and whether it has expired) so
        // the Landing page & Builder can lock templates above their tier —
        // also doubles as our lookup for `resumesInitialized` below.
        let ownProfile: UserAccountProfile | undefined;
        try {
          const platformUsers = await fetchPlatformUsers();
          ownProfile = platformUsers.find(
            (u) => u.email.toLowerCase() === (firebaseUser.email || '').toLowerCase()
          );
          setUserPlanTier(getEffectivePlanTier(ownProfile));
        } catch (e) {
          console.warn('Failed to resolve plan tier for user', e);
          setUserPlanTier('Free Plan');
        }

        try {
          // Fetch user's saved CVs from Firestore strictly for their own UID
          const remoteResumes = await fetchUserResumes(firebaseUser.uid);
          const resumesKey = getAccountResumesKey(firebaseUser.uid);

          if (remoteResumes && remoteResumes.length > 0) {
            // User has their own resumes in Firestore
            setResumes(remoteResumes);
            setActiveResumeId(remoteResumes[0].id);
            try {
              localStorage.setItem(resumesKey, JSON.stringify(remoteResumes));
            } catch (e) {
              console.warn('Failed caching user resumes locally', e);
            }
            // Backfill the flag for accounts that already had resumes before
            // this flag existed, so a future delete-everything is respected.
            if (!ownProfile?.resumesInitialized) {
              markResumesInitialized(firebaseUser.uid).catch(() => {});
            }
          } else {
            // Firestore has zero resumes for this account. That's either a
            // brand-new account, OR an existing account that intentionally
            // deleted everything — `resumesInitialized` on their profile
            // (set once, the first time we ever seed/migrate a resume for
            // them) is the source of truth that tells the two apart, so we
            // never resurrect a deleted resume just because the page refreshed.
            const localAccountData = localStorage.getItem(resumesKey);
            const localResumes = localAccountData
              ? sanitizeResumeList(JSON.parse(localAccountData), false)
              : [];

            if (localResumes.length > 0 && !ownProfile?.resumesInitialized) {
              // Unsynced local resumes from before this account existed on the
              // server — migrate them up (only applies pre-first-initialization).
              setResumes(localResumes);
              setActiveResumeId(localResumes[0].id);
              await batchSyncResumes(firebaseUser.uid, localResumes);
              await markResumesInitialized(firebaseUser.uid);
            } else if (ownProfile?.resumesInitialized) {
              // Genuinely 0 resumes on purpose — respect it, don't auto-create.
              setResumes([]);
              setActiveResumeId('');
              try {
                localStorage.setItem(resumesKey, JSON.stringify([]));
              } catch (e) {
                console.warn('Failed clearing local resume cache', e);
              }
            } else {
              // Truly first-ever session for this account: seed one starter resume.
              const defaultResume = createDefaultResumeForUser(firebaseUser.uid, profile.name, profile.email);
              setResumes([defaultResume]);
              setActiveResumeId(defaultResume.id);
              await saveUserResume(firebaseUser.uid, defaultResume);
              await markResumesInitialized(firebaseUser.uid);
            }
          }

          // Fetch Cover letters strictly for this user
          const remoteLetters = await fetchUserCoverLetters(firebaseUser.uid);
          if (remoteLetters && remoteLetters.length > 0) {
            setCoverLetters(remoteLetters);
          } else {
            const cachedLetters = localStorage.getItem(getAccountCoverLettersKey(firebaseUser.uid));
            setCoverLetters(cachedLetters ? JSON.parse(cachedLetters) : []);
          }

          // Fetch Jobs strictly for this user (only jobs applied to)
          const remoteJobs = await fetchUserJobs(firebaseUser.uid);
          if (remoteJobs && remoteJobs.length > 0) {
            setJobs(sanitizeTrackedJobs(remoteJobs));
          } else {
            const cachedJobs = localStorage.getItem(getAccountJobsKey(firebaseUser.uid));
            setJobs(cachedJobs ? sanitizeTrackedJobs(JSON.parse(cachedJobs)) : []);
          }

          setCloudSyncStatus('saved');
        } catch (err) {
          console.error('Error synchronizing user data with Firestore:', err);
          setCloudSyncStatus('error');
        }
      } else {
        // User logged out: load guest account state ONLY, never retain previous user's data
        setCloudSyncStatus('offline');
        setUser(null);
        setUserPlanTier('Free Plan');

        try {
          const guestResumes = localStorage.getItem(getAccountResumesKey(null));
          if (guestResumes) {
            const parsed = sanitizeResumeList(JSON.parse(guestResumes), false);
            setResumes(parsed);
            setActiveResumeId(parsed[0]?.id || '');
          } else {
            setResumes([]);
            setActiveResumeId('');
          }

          const guestLetters = localStorage.getItem(getAccountCoverLettersKey(null));
          setCoverLetters(guestLetters ? JSON.parse(guestLetters) : []);

          const guestJobs = localStorage.getItem(getAccountJobsKey(null));
          setJobs(guestJobs ? sanitizeTrackedJobs(JSON.parse(guestJobs)) : []);
        } catch (e) {
          console.warn('Failed restoring guest state on logout', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-dismiss the daily-quota banner after a few seconds.
  useEffect(() => {
    if (!quotaMessage) return;
    const timer = setTimeout(() => setQuotaMessage(null), 8000);
    return () => clearTimeout(timer);
  }, [quotaMessage]);

  // Load any admin-set template plan-tier overrides (Admin Dashboard → "CV
  // Templates & Plans") and apply them to the shared TEMPLATES array so
  // locking reflects the admin's choices everywhere — runs once, regardless
  // of login state, so guests browsing the Landing page see it too.
  useEffect(() => {
    (async () => {
      try {
        const overrides = await fetchTemplatePlanOverrides();
        applyTemplatePlanOverrides(overrides);
        forceTemplatesRerender((n) => n + 1);
      } catch (e) {
        console.warn('Failed applying template plan-tier overrides', e);
      }
    })();
  }, []);

  // 2. Local storage persistence (isolated by user ID)
  useEffect(() => {
    try {
      const key = getAccountResumesKey(authUser?.uid);
      localStorage.setItem(key, JSON.stringify(resumes));
    } catch (e) {
      console.warn('Failed saving resumes to local storage', e);
    }
  }, [resumes, authUser?.uid]);

  useEffect(() => {
    try {
      const key = getAccountCoverLettersKey(authUser?.uid);
      localStorage.setItem(key, JSON.stringify(coverLetters));
    } catch (e) {
      console.warn('Failed saving cover letters to local storage', e);
    }
  }, [coverLetters, authUser?.uid]);

  useEffect(() => {
    try {
      const key = getAccountJobsKey(authUser?.uid);
      localStorage.setItem(key, JSON.stringify(jobs));
    } catch (e) {
      console.warn('Failed saving jobs to local storage', e);
    }
  }, [jobs, authUser?.uid]);

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_USER_KEY);
      }
    } catch (e) {
      console.warn('Failed saving user to local storage', e);
    }
  }, [user]);

  // 3. URL Hash navigation listener
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#builder') setCurrentPage('builder');
      else if (hash === '#landing') setCurrentPage('landing');
      else setCurrentPage('dashboard');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Find currently active resume
  const currentResume = resumes.find((r) => r.id === activeResumeId) || resumes[0] || {
    id: 'resume-1',
    title: 'Untitled Resume',
    templateId: 'template-b' as TemplateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: INITIAL_CV_DATA,
  };

  // 4. Debounced Autosave to Firestore when currentResume data changes
  const debouncedAutosaveResume = useCallback(
    (resumeToSave: ResumeItem) => {
      if (!authUser) {
        setCloudSyncStatus('offline');
        return;
      }

      setCloudSyncStatus('saving');

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(async () => {
        try {
          await saveUserResume(authUser.uid, resumeToSave);
          setCloudSyncStatus('saved');
        } catch (err) {
          console.error('Debounced autosave failed:', err);
          setCloudSyncStatus('error');
        }
      }, 900); // Debounce duration: ~900ms
    },
    [authUser]
  );

  // Handlers for CV Builder
  const handleOpenResumeInBuilder = (resume: ResumeItem) => {
    setActiveResumeId(resume.id);
    window.location.hash = '#builder';
    setCurrentPage('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateActiveResumeData = (updatedData: CVData) => {
    const sanitized = sanitizeCVData(updatedData);
    const updatedResume: ResumeItem = {
      ...currentResume,
      data: sanitized,
      updatedAt: new Date().toISOString(),
    };

    setResumes((prev) =>
      prev.map((r) => (r.id === currentResume.id ? updatedResume : r))
    );

    // Trigger debounced Firestore save
    debouncedAutosaveResume(updatedResume);
  };

  const handleUpdateActiveResumeTemplate = (templateId: TemplateId) => {
    const tmplObj = TEMPLATES.find((t) => t.id === templateId);
    const updatedResume: ResumeItem = {
      ...currentResume,
      templateId,
      primaryColor: tmplObj?.primaryColor || currentResume.primaryColor,
      updatedAt: new Date().toISOString(),
    };

    setResumes((prev) =>
      prev.map((r) => (r.id === currentResume.id ? updatedResume : r))
    );

    // Trigger debounced Firestore save
    debouncedAutosaveResume(updatedResume);
  };

  const handleUpdateResumesList = (newResumes: ResumeItem[]) => {
    const listWithUid = authUser
      ? newResumes.map((r) => ({ ...r, userId: authUser.uid }))
      : newResumes;
    setResumes(listWithUid);
  };

  const handleNavigateToLanding = () => {
    window.location.hash = '#landing';
    setCurrentPage('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToDashboard = () => {
    window.location.hash = '#dashboard';
    setCurrentPage('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateFromLanding = async (templateId?: TemplateId) => {
    if (!authUser) {
      setIsLoginModalOpen(true);
      return;
    }

    const quota = await checkAndIncrementDailyCvQuota(authUser.uid, userPlanTier);
    if (!quota.allowed) {
      setQuotaMessage(
        `You've reached today's limit of ${quota.limit} CV${quota.limit === 1 ? '' : 's'} on the ${userPlanTier}. Upgrade for more, or try again tomorrow.`
      );
      setReturnToPageAfterPricing('landing');
      handleNavigateToDashboard();
      setPendingOpenPricing(true);
      return;
    }

    const chosenTemplateId = templateId || 'template-ats-classic';
    const chosenTmpl = TEMPLATES.find((t) => t.id === chosenTemplateId) || TEMPLATES[0];
    const newResume: ResumeItem = {
      id: `resume-${Date.now()}`,
      userId: authUser?.uid,
      title: `${chosenTmpl.name} Resume`,
      templateId: chosenTemplateId,
      primaryColor: chosenTmpl?.primaryColor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        ...INITIAL_CV_DATA,
        personal: {
          ...INITIAL_CV_DATA.personal,
          fullName: user?.name || INITIAL_CV_DATA.personal.fullName,
          email: user?.email || INITIAL_CV_DATA.personal.email,
        },
      },
    };

    setResumes((prev) => [newResume, ...prev]);
    setActiveResumeId(newResume.id);

    if (authUser) {
      setCloudSyncStatus('saving');
      try {
        await saveUserResume(authUser.uid, newResume);
        setCloudSyncStatus('saved');
      } catch (e) {
        console.error('Failed to create resume in cloud:', e);
        setCloudSyncStatus('error');
      }
    }

    window.location.hash = '#builder';
    setCurrentPage('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSingleResume = async (resumeToSave: ResumeItem) => {
    if (authUser) {
      const itemWithUid: ResumeItem = {
        ...resumeToSave,
        userId: authUser.uid,
      };
      setCloudSyncStatus('saving');
      try {
        await saveUserResume(authUser.uid, itemWithUid);
        setCloudSyncStatus('saved');
      } catch (e) {
        console.error('Failed saving single resume to cloud:', e);
        setCloudSyncStatus('error');
      }
    }
  };

  const handleDeleteSingleResume = async (id: string) => {
    if (authUser) {
      try {
        await deleteUserResume(authUser.uid, id);
      } catch (e) {
        console.error('Failed deleting resume from cloud:', e);
      }
    }
  };

  const handleSaveSingleCoverLetter = async (letterToSave: CoverLetterItem) => {
    if (authUser) {
      const itemWithUid = { ...letterToSave, userId: authUser.uid };
      try {
        await saveUserCoverLetter(authUser.uid, itemWithUid);
      } catch (e) {
        console.error('Failed saving cover letter to cloud:', e);
      }
    }
  };

  const handleDeleteSingleCoverLetter = async (id: string) => {
    if (authUser) {
      try {
        await deleteUserCoverLetter(authUser.uid, id);
      } catch (e) {
        console.error('Failed deleting cover letter from cloud:', e);
      }
    }
  };

  const handleSaveSingleJob = async (jobToSave: JobItem) => {
    if (authUser) {
      const itemWithUid = { ...jobToSave, userId: authUser.uid };
      try {
        await saveUserJob(authUser.uid, itemWithUid);
      } catch (e) {
        console.error('Failed saving job to cloud:', e);
      }
    }
  };

  const handleDeleteSingleJob = async (id: string) => {
    if (authUser) {
      try {
        await deleteUserJob(authUser.uid, id);
      } catch (e) {
        console.error('Failed deleting job from cloud:', e);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setAuthUser(null);
      setUser(null);
      setCloudSyncStatus('offline');

      // Reset in-memory state to guest profile
      const guestResumes = localStorage.getItem(getAccountResumesKey(null));
      if (guestResumes) {
        const parsed = sanitizeResumeList(JSON.parse(guestResumes), false);
        setResumes(parsed);
        setActiveResumeId(parsed[0]?.id || '');
      } else {
        setResumes([]);
        setActiveResumeId('');
      }

      const guestLetters = localStorage.getItem(getAccountCoverLettersKey(null));
      setCoverLetters(guestLetters ? JSON.parse(guestLetters) : []);

      const guestJobs = localStorage.getItem(getAccountJobsKey(null));
      setJobs(guestJobs ? sanitizeTrackedJobs(JSON.parse(guestJobs)) : []);
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  return (
    <main className="min-h-screen bg-[#F6F5F2]">
      {deviceBlockedMessage && (
        <div className="fixed inset-x-0 top-0 z-[100] bg-red-600 text-white text-xs sm:text-sm font-semibold text-center py-2.5 px-4 shadow-lg">
          {deviceBlockedMessage}
        </div>
      )}
      {quotaMessage && (
        <div className="fixed inset-x-0 top-0 z-[100] bg-amber-500 text-white text-xs sm:text-sm font-semibold text-center py-2.5 px-4 shadow-lg flex items-center justify-center gap-3">
          <span>{quotaMessage}</span>
          <button
            onClick={() => setQuotaMessage(null)}
            className="underline underline-offset-2 hover:no-underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      {currentPage === 'dashboard' && (
        <JobseekerDashboard
          resumes={resumes}
          coverLetters={coverLetters}
          jobs={jobs}
          user={user}
          onUpdateResumes={handleUpdateResumesList}
          onUpdateCoverLetters={setCoverLetters}
          onUpdateJobs={setJobs}
          onUpdateUser={setUser}
          onOpenResumeInBuilder={handleOpenResumeInBuilder}
          onGoToLanding={handleNavigateToLanding}
          onLogoutUser={handleLogout}
          cloudSyncStatus={cloudSyncStatus}
          onSaveResumeItem={handleSaveSingleResume}
          onDeleteResumeItem={handleDeleteSingleResume}
          onSaveCoverLetterItem={handleSaveSingleCoverLetter}
          onDeleteCoverLetterItem={handleDeleteSingleCoverLetter}
          onSaveJobItem={handleSaveSingleJob}
          onDeleteJobItem={handleDeleteSingleJob}
          openPricingOnMount={pendingOpenPricing}
          onPricingOpened={() => setPendingOpenPricing(false)}
          onPricingClose={() => {
            if (returnToPageAfterPricing) {
              const target = returnToPageAfterPricing;
              setReturnToPageAfterPricing(null);
              window.location.hash = `#${target}`;
              setCurrentPage(target);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
                onTemplatesChanged={() => forceTemplatesRerender((n) => n + 1)}
          />
      )}

      {currentPage === 'landing' && (
        <LandingPage
          data={currentResume.data}
          selectedTemplate={currentResume.templateId}
          onSelectTemplate={handleUpdateActiveResumeTemplate}
          onCreateCV={handleCreateFromLanding}
          onGoToDashboard={handleNavigateToDashboard}
          userPlanTier={userPlanTier}
          onRequireUpgrade={() => {
            setReturnToPageAfterPricing('landing');
            handleNavigateToDashboard();
            setPendingOpenPricing(true);
          }}
        />
      )}

      {currentPage === 'builder' && (
        <CVBuilderPage
          data={currentResume.data}
          selectedTemplate={currentResume.templateId}
          resumeTitle={currentResume.title}
          onChangeData={handleUpdateActiveResumeData}
          onSelectTemplate={handleUpdateActiveResumeTemplate}
          onBackToLanding={handleNavigateToLanding}
          onBackToDashboard={handleNavigateToDashboard}
          cloudSyncStatus={cloudSyncStatus}
          allResumes={resumes}
          activeResumeId={currentResume.id}
          onSwitchResume={handleOpenResumeInBuilder}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          userEmail={user?.email}
          userPlanTier={userPlanTier}
          onRequireUpgrade={(fromDesignModal) => {
            setReturnToPageAfterPricing('builder');
            setReopenBuilderDesignModal(Boolean(fromDesignModal));
            handleNavigateToDashboard();
            setPendingOpenPricing(true);
          }}
          openDesignModalOnMount={reopenBuilderDesignModal}
          onDesignModalOpened={() => setReopenBuilderDesignModal(false)}
        />
      )}

      {/* Global Login & Sign Up Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={authUser}
        onAuthSuccess={(loggedInUser) => {
          setUser({
            name: loggedInUser.displayName || loggedInUser.email?.split('@')[0] || 'User',
            email: loggedInUser.email || '',
          });
          setIsLoginModalOpen(false);
        }}
      />
    </main>
  );
}
