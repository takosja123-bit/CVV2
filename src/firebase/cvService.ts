import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import {
  ResumeItem,
  CoverLetterItem,
  JobItem,
  PublicJob,
  AdminSubmission,
  TelegramConfig,
  UserAccountProfile,
  ADMIN_EMAIL,
  PlanTier,
  BlockedDevice,
} from '../types';
import { computeExpiryDate, SUBSCRIPTION_DURATION_DAYS, DAILY_CV_LIMITS, todayDateString } from '../utils/planAccess';
import {
  sanitizeResumeList,
  sanitizeCVData,
  INITIAL_PUBLIC_JOBS,
  INITIAL_SUBMISSIONS,
} from '../data/initialData';

const RESUMES_COLLECTION = 'resumes';
const COVER_LETTERS_COLLECTION = 'coverLetters';
const JOBS_COLLECTION = 'jobs';
const PUBLIC_JOBS_COLLECTION = 'publicJobs';
const SUBMISSIONS_COLLECTION = 'submissions';
const USERS_COLLECTION = 'userProfiles';
const TEMPLATE_CONFIG_COLLECTION = 'templateConfig';
const TEMPLATE_CONFIG_DOC_ID = 'planTiers';
const BLOCKED_DEVICES_COLLECTION = 'blockedDevices';
const STORAGE_BLOCKED_DEVICES_KEY = 'jobseeker_blocked_devices_cache_v1';
const STORAGE_PUBLIC_JOBS_KEY = 'jobseeker_public_jobs_cache_v1';
const STORAGE_SUBMISSIONS_KEY = 'jobseeker_submissions_cache_v1';
const STORAGE_USERS_KEY = 'jobseeker_user_accounts_cache_v1';
const STORAGE_TELEGRAM_KEY = 'jobseeker_telegram_config_v1';

/**
 * Fetch all resumes belonging to the authenticated user from Firestore
 */
export async function fetchUserResumes(userId: string): Promise<ResumeItem[]> {
  if (!userId) return [];
  const resumesRef = collection(db, RESUMES_COLLECTION);
  const q = query(resumesRef, where('userId', '==', userId));

  try {
    const snapshot = await getDocs(q);
    const list: ResumeItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId || userId,
        title: data.title || 'Untitled CV',
        templateId: data.templateId || 'template-b',
        primaryColor: data.primaryColor || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        data: sanitizeCVData(data.data || {}),
      });
    });

    // Sort by updatedAt descending
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sanitizeResumeList(list, false);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, RESUMES_COLLECTION);
  }
}

/**
 * Save or update a single resume to Firestore
 */
export async function saveUserResume(userId: string, resume: ResumeItem): Promise<void> {
  if (!userId || !resume.id) return;
  const docRef = doc(db, RESUMES_COLLECTION, resume.id);

  const payload: Record<string, any> = {
    id: resume.id,
    userId: userId,
    title: resume.title || 'Untitled CV',
    templateId: resume.templateId || 'template-b',
    data: sanitizeCVData(resume.data),
    createdAt: resume.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (resume.primaryColor) {
    payload.primaryColor = resume.primaryColor;
  }

  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${RESUMES_COLLECTION}/${resume.id}`);
  }
}

/**
 * Delete a resume from Firestore
 */
export async function deleteUserResume(userId: string, resumeId: string): Promise<void> {
  if (!userId || !resumeId) return;
  const docRef = doc(db, RESUMES_COLLECTION, resumeId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${RESUMES_COLLECTION}/${resumeId}`);
  }
}

/**
 * Batch upload / sync multiple resumes to Firestore (e.g. on first sign-in sync)
 */
export async function batchSyncResumes(userId: string, resumes: ResumeItem[]): Promise<void> {
  if (!userId || resumes.length === 0) return;

  try {
    const batch = writeBatch(db);
    resumes.forEach((resume) => {
      const docRef = doc(db, RESUMES_COLLECTION, resume.id);
      const payload: Record<string, any> = {
        id: resume.id,
        userId: userId,
        title: resume.title || 'Untitled CV',
        templateId: resume.templateId || 'template-b',
        data: sanitizeCVData(resume.data),
        createdAt: resume.createdAt || new Date().toISOString(),
        updatedAt: resume.updatedAt || new Date().toISOString(),
      };
      if (resume.primaryColor) {
        payload.primaryColor = resume.primaryColor;
      }
      batch.set(docRef, payload, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, RESUMES_COLLECTION);
  }
}

/**
 * Fetch Cover Letters from Firestore
 */
export async function fetchUserCoverLetters(userId: string): Promise<CoverLetterItem[]> {
  if (!userId) return [];
  const colRef = collection(db, COVER_LETTERS_COLLECTION);
  const q = query(colRef, where('userId', '==', userId));

  try {
    const snapshot = await getDocs(q);
    const list: CoverLetterItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: userId,
        title: data.title || 'Untitled Letter',
        recipientName: data.recipientName || '',
        companyName: data.companyName || '',
        jobTitle: data.jobTitle || '',
        body: data.body || '',
        senderName: data.senderName || '',
        senderEmail: data.senderEmail || '',
        senderPhone: data.senderPhone || '',
        senderAddress: data.senderAddress || '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COVER_LETTERS_COLLECTION);
  }
}

/**
 * Save Cover Letter to Firestore
 */
export async function saveUserCoverLetter(userId: string, letter: CoverLetterItem): Promise<void> {
  if (!userId || !letter.id) return;
  const docRef = doc(db, COVER_LETTERS_COLLECTION, letter.id);
  try {
    await setDoc(
      docRef,
      {
        id: letter.id,
        userId: userId,
        title: letter.title || 'Untitled Letter',
        recipientName: letter.recipientName || '',
        companyName: letter.companyName || '',
        jobTitle: letter.jobTitle || '',
        body: letter.body || '',
        senderName: letter.senderName || '',
        senderEmail: letter.senderEmail || '',
        senderPhone: letter.senderPhone || '',
        senderAddress: letter.senderAddress || '',
        createdAt: letter.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COVER_LETTERS_COLLECTION}/${letter.id}`);
  }
}

/**
 * Delete Cover Letter from Firestore
 */
export async function deleteUserCoverLetter(userId: string, letterId: string): Promise<void> {
  if (!userId || !letterId) return;
  const docRef = doc(db, COVER_LETTERS_COLLECTION, letterId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COVER_LETTERS_COLLECTION}/${letterId}`);
  }
}

/**
 * Fetch Jobs from Firestore
 */
export async function fetchUserJobs(userId: string): Promise<JobItem[]> {
  if (!userId) return [];
  const colRef = collection(db, JOBS_COLLECTION);
  const q = query(colRef, where('userId', '==', userId));

  try {
    const snapshot = await getDocs(q);
    const list: JobItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: userId,
        title: data.title || '',
        company: data.company || '',
        location: data.location || '',
        status: data.status || 'applied',
        salary: data.salary || '',
        notes: data.notes || '',
        appliedDate: data.appliedDate || '',
        jobUrl: data.jobUrl || '',
        resumeUsedId: data.resumeUsedId || '',
        candidateName: data.candidateName || '',
        candidateGmail: data.candidateGmail || '',
        candidatePhone: data.candidatePhone || '',
        candidateTelegram: data.candidateTelegram || '',
        candidateCvName: data.candidateCvName || '',
        candidateCvData: data.candidateCvData || '',
        candidateCvType: data.candidateCvType || 'pdf',
        candidateCvSize: data.candidateCvSize || '',
        imageUrl: data.imageUrl || '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, JOBS_COLLECTION);
  }
}

/**
 * Save Job to Firestore
 */
export async function saveUserJob(userId: string, job: JobItem): Promise<void> {
  if (!userId || !job.id) return;
  const docRef = doc(db, JOBS_COLLECTION, job.id);
  try {
    await setDoc(
      docRef,
      {
        id: job.id,
        userId: userId,
        title: job.title || '',
        company: job.company || '',
        location: job.location || '',
        status: job.status || 'applied',
        salary: job.salary || '',
        notes: job.notes || '',
        appliedDate: job.appliedDate || '',
        jobUrl: job.jobUrl || '',
        resumeUsedId: job.resumeUsedId || '',
        candidateName: job.candidateName || '',
        candidateGmail: job.candidateGmail || '',
        candidatePhone: job.candidatePhone || '',
        candidateTelegram: job.candidateTelegram || '',
        candidateCvName: job.candidateCvName || '',
        candidateCvData: job.candidateCvData || '',
        candidateCvType: job.candidateCvType || 'pdf',
        candidateCvSize: job.candidateCvSize || '',
        imageUrl: job.imageUrl || '',
        createdAt: job.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${JOBS_COLLECTION}/${job.id}`);
  }
}

/**
 * Delete Job from Firestore
 */
export async function deleteUserJob(userId: string, jobId: string): Promise<void> {
  if (!userId || !jobId) return;
  const docRef = doc(db, JOBS_COLLECTION, jobId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${JOBS_COLLECTION}/${jobId}`);
  }
}

/**
 * =======================================================================
 * PUBLIC JOBS SERVICE (Admin posts/edits/deletes; Users view & apply link)
 * =======================================================================
 */

export async function fetchPublicJobs(): Promise<PublicJob[]> {
  try {
    const colRef = collection(db, PUBLIC_JOBS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: PublicJob[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        title: data.title || '',
        company: data.company || '',
        location: data.location || '',
        workType: data.workType || 'Remote',
        employmentType: data.employmentType || 'Full-time',
        salary: data.salary || '',
        description: data.description || '',
        requirements: Array.isArray(data.requirements) ? data.requirements : [],
        applyUrl: data.applyUrl || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        postedBy: data.postedBy || ADMIN_EMAIL,
        postedAt: data.postedAt || new Date().toISOString(),
        status: data.status || 'active',
        featured: !!data.featured,
        imageUrl: data.imageUrl || '',
      });
    });

    if (list.length > 0) {
      // Sort: active first, then newest
      list.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      try {
        localStorage.setItem(STORAGE_PUBLIC_JOBS_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('Failed caching public jobs', e);
      }
      return list;
    }
  } catch (e) {
    console.warn('Could not fetch public jobs from Firestore, falling back to cache/defaults:', e);
  }

  // Fallback to local cache or default initial public jobs
  try {
    const cached = localStorage.getItem(STORAGE_PUBLIC_JOBS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed reading cached public jobs', e);
  }
  return INITIAL_PUBLIC_JOBS;
}

export async function savePublicJob(job: PublicJob): Promise<void> {
  const docRef = doc(db, PUBLIC_JOBS_COLLECTION, job.id);
  try {
    await setDoc(docRef, { ...job }, { merge: true });
  } catch (e) {
    console.warn('Firestore write failed for public job, saving to local cache:', e);
  }

  // Also update local cache
  try {
    const current = await fetchPublicJobs();
    const existingIndex = current.findIndex((j) => j.id === job.id);
    let updated: PublicJob[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = job;
    } else {
      updated = [job, ...current];
    }
    localStorage.setItem(STORAGE_PUBLIC_JOBS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed updating local public jobs cache', e);
  }
}

export async function deletePublicJob(jobId: string): Promise<void> {
  const docRef = doc(db, PUBLIC_JOBS_COLLECTION, jobId);
  try {
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firestore delete failed for public job, updating local cache:', e);
  }

  try {
    const current = await fetchPublicJobs();
    const filtered = current.filter((j) => j.id !== jobId);
    localStorage.setItem(STORAGE_PUBLIC_JOBS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed updating local public jobs cache on delete', e);
  }
}

/**
 * =======================================================================
 * ADMIN SUBMISSIONS SERVICE (User submits -> Admin reviews -> Telegram)
 * =======================================================================
 */

export async function fetchAdminSubmissions(): Promise<AdminSubmission[]> {
  try {
    const colRef = collection(db, SUBMISSIONS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: AdminSubmission[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId || '',
        userEmail: data.userEmail || '',
        userName: data.userName || 'Anonymous User',
        type: data.type || 'pro_upgrade',
        title: data.title || '',
        details: data.details || '',
        data: data.data || null,
        status: data.status || 'pending',
        createdAt: data.createdAt || new Date().toISOString(),
        reviewedAt: data.reviewedAt || undefined,
        telegramSent: !!data.telegramSent,
        telegramSentAt: data.telegramSentAt || undefined,
      });
    });

    if (list.length > 0) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      try {
        localStorage.setItem(STORAGE_SUBMISSIONS_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('Failed caching submissions', e);
      }
      return list;
    }
  } catch (e) {
    console.warn('Firestore fetch failed for submissions, falling back to cache/defaults:', e);
  }

  try {
    const cached = localStorage.getItem(STORAGE_SUBMISSIONS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed reading cached submissions', e);
  }
  return INITIAL_SUBMISSIONS;
}

export async function createAdminSubmission(sub: AdminSubmission): Promise<void> {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, sub.id);
  try {
    await setDoc(docRef, { ...sub }, { merge: true });
  } catch (e) {
    console.warn('Firestore write failed for submission, saving locally:', e);
  }

  try {
    const current = await fetchAdminSubmissions();
    const updated = [sub, ...current.filter((s) => s.id !== sub.id)];
    localStorage.setItem(STORAGE_SUBMISSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed updating local submissions cache', e);
  }
}

export async function updateAdminSubmission(
  subId: string,
  updates: Partial<AdminSubmission>
): Promise<void> {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, subId);
  try {
    await setDoc(docRef, updates, { merge: true });
  } catch (e) {
    console.warn('Firestore update failed for submission:', e);
  }

  try {
    const current = await fetchAdminSubmissions();
    const updated = current.map((s) => (s.id === subId ? { ...s, ...updates } : s));
    localStorage.setItem(STORAGE_SUBMISSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed updating local submissions cache', e);
  }
}

/**
 * =======================================================================
 * TELEGRAM BOT INTEGRATION SERVICE
 * Sends notifications to Admin's Telegram bot directly
 * =======================================================================
 */

export function getStoredTelegramConfig(): TelegramConfig {
  try {
    const saved = localStorage.getItem(STORAGE_TELEGRAM_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed loading telegram config', e);
  }
  return {
    botToken: '',
    chatId: '',
    autoForwardApproved: true,
  };
}

export function saveStoredTelegramConfig(config: TelegramConfig): void {
  try {
    localStorage.setItem(STORAGE_TELEGRAM_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed saving telegram config', e);
  }
}

export async function sendTelegramNotification(
  config: TelegramConfig,
  messageHtml: string
): Promise<{ success: boolean; message?: string }> {
  if (!config.botToken?.trim() || !config.chatId?.trim()) {
    return {
      success: false,
      message: 'Telegram Bot Token and Chat ID are not configured yet. Please configure them in Admin Settings.',
    };
  }

  const cleanToken = config.botToken.trim();
  const cleanChatId = config.chatId.trim();

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();
    if (data && data.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        message: data?.description || 'Telegram API rejected the request. Please check Bot Token and Chat ID.',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Network error while contacting Telegram Bot API.',
    };
  }
}

export function base64DataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } | null {
  try {
    if (!dataUrl) return null;
    if (dataUrl.includes(',')) {
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return { blob: new Blob([array], { type: mimeType }), mimeType };
    }
    return { blob: new Blob([dataUrl], { type: 'text/plain' }), mimeType: 'text/plain' };
  } catch (err) {
    console.warn('Failed converting data URL to Blob:', err);
    return null;
  }
}

export async function sendTelegramDocument(
  config: TelegramConfig,
  fileDataUrl: string,
  fileName: string,
  captionHtml?: string
): Promise<{ success: boolean; message?: string }> {
  if (!config.botToken?.trim() || !config.chatId?.trim()) {
    return {
      success: false,
      message: 'Telegram Bot Token and Chat ID are not configured yet.',
    };
  }

  const cleanToken = config.botToken.trim();
  const cleanChatId = config.chatId.trim();

  try {
    const parsed = base64DataUrlToBlob(fileDataUrl);
    if (!parsed) {
      return {
        success: false,
        message: 'Could not process file attachment for Telegram upload.',
      };
    }

    const formData = new FormData();
    formData.append('chat_id', cleanChatId);
    formData.append('document', parsed.blob, fileName || 'Candidate_CV.pdf');
    if (captionHtml) {
      formData.append('caption', captionHtml.slice(0, 1024));
      formData.append('parse_mode', 'HTML');
    }

    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (data && data.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        message: data?.description || 'Telegram API rejected document upload.',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Network error while sending document to Telegram Bot.',
    };
  }
}

/**
 * =======================================================================
 * USER PROFILES & PLAN TIERS (Admin can grant Pro/Premium)
 * =======================================================================
 */

export async function fetchPlatformUsers(): Promise<UserAccountProfile[]> {
  try {
    const colRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(colRef);
    const list: UserAccountProfile[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        uid: docSnap.id,
        email: data.email || '',
        name: data.name || '',
        role: (data.email === ADMIN_EMAIL || data.role === 'admin') ? 'admin' : 'user',
        planTier: data.planTier || 'Free Plan',
        planExpiresAt: data.planExpiresAt ?? null,
        resumesInitialized: Boolean(data.resumesInitialized),
        avatarUrl: data.avatarUrl || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        deviceIds: Array.isArray(data.deviceIds) ? data.deviceIds : undefined,
        fingerprints: Array.isArray(data.fingerprints) ? data.fingerprints : undefined,
      });
    });

    if (list.length > 0) {
      try {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('Failed caching user list', e);
      }
      return list;
    }
  } catch (e) {
    console.warn('Firestore fetch failed for users, falling back to local cache:', e);
  }

  // Return default platform users for admin demonstration
  try {
    const cached = localStorage.getItem(STORAGE_USERS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed reading cached user list', e);
  }

  const defaultUsers: UserAccountProfile[] = [
    {
      uid: 'admin-tak-001',
      email: ADMIN_EMAIL,
      name: 'Tak Tempest (Admin)',
      role: 'admin',
      planTier: 'Pro Plan',
      planExpiresAt: null, // admins never expire
      createdAt: '2026-08-01',
    },
    {
      uid: 'user-demo-99',
      email: 'charlie.candidate@gmail.com',
      name: 'Charlie Candidate',
      role: 'user',
      planTier: 'Free Plan',
      createdAt: '2026-08-15',
    },
    {
      uid: 'user-demo-88',
      email: 'dev.sarah@gmail.com',
      name: 'Sarah Jenkins',
      role: 'user',
      planTier: 'Pro Plan',
      planExpiresAt: computeExpiryDate(),
      createdAt: '2026-08-20',
    },
    {
      uid: 'user-demo-77',
      email: 'alex.jobcraft@example.com',
      name: 'Alex JobifyCV',
      role: 'user',
      planTier: 'Free Plan',
      createdAt: '2026-08-27',
    },
  ];

  return defaultUsers;
}

export async function saveUserAccountProfile(profile: UserAccountProfile): Promise<void> {
  const docRef = doc(db, USERS_COLLECTION, profile.uid);
  try {
    await setDoc(docRef, { ...profile }, { merge: true });
  } catch (e) {
    console.warn('Firestore save failed for user profile:', e);
  }

  try {
    const current = await fetchPlatformUsers();
    const idx = current.findIndex((u) => u.uid === profile.uid);
    let updated: UserAccountProfile[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = profile;
    } else {
      updated = [profile, ...current];
    }
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed saving user profile to local cache', e);
  }
}

/**
 * Grants (or clears) a user's plan tier. Every paid tier (Basic/Pro/Premium)
 * — whether granted by PayWay checkout success or manually by an admin in
 * the Users tab — is stamped with an expiry exactly SUBSCRIPTION_DURATION_DAYS
 * (30) days from now. Once that date passes, getEffectivePlanTier() treats the
 * account as Free Plan again until it's renewed/re-granted.
 * Downgrading to 'Free Plan' always clears the expiry.
 */
/**
 * Marks that this account has had its resumes "initialized" — either a starter
 * resume was created for them, or their pre-login local resumes were migrated
 * up. Checked before ever auto-seeding a default resume again, so deleting
 * your last resume and refreshing doesn't resurrect a new one.
 */
export async function markResumesInitialized(userId: string): Promise<void> {
  if (!userId) return;
  const docRef = doc(db, USERS_COLLECTION, userId);
  try {
    await setDoc(docRef, { resumesInitialized: true }, { merge: true });
  } catch (e) {
    console.warn('Failed marking resumesInitialized for user:', e);
  }
}

export interface DailyCvQuotaResult {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited (Pro / Premium)
}

/**
 * Enforces the daily "create a new CV" quota per plan tier — Free Plan: 2/day,
 * Basic Plan: 5/day, Pro & Premium: unlimited. Call this right before actually
 * creating a resume (a fresh one OR duplicating an existing one both count).
 * If `allowed` comes back false, block the creation and prompt the user to
 * upgrade or wait until tomorrow (the count resets at midnight UTC).
 */
export async function checkAndIncrementDailyCvQuota(
  userId: string,
  planTier: PlanTier
): Promise<DailyCvQuotaResult> {
  const limit = DAILY_CV_LIMITS[planTier];
  if (limit === null || !userId) {
    return { allowed: true, used: 0, limit: null };
  }

  const today = todayDateString();
  const docRef = doc(db, USERS_COLLECTION, userId);

  try {
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    const used = data.dailyCvCountDate === today ? Number(data.dailyCvCount) || 0 : 0;

    if (used >= limit) {
      return { allowed: false, used, limit };
    }

    await setDoc(docRef, { dailyCvCount: used + 1, dailyCvCountDate: today }, { merge: true });
    return { allowed: true, used: used + 1, limit };
  } catch (e) {
    console.warn('Failed checking daily CV quota — allowing by default:', e);
    return { allowed: true, used: 0, limit };
  }
}

/**
 * Per-template plan-tier overrides set by the admin (Admin Dashboard →
 * "CV Templates & Plans" tab) — lets an admin decide which templates require
 * Free/Basic/Pro/Premium without needing a code change + redeploy. Stored as
 * a single document mapping templateId -> PlanTier.
 */
export async function fetchTemplatePlanOverrides(): Promise<Record<string, PlanTier>> {
  try {
    const snap = await getDoc(doc(db, TEMPLATE_CONFIG_COLLECTION, TEMPLATE_CONFIG_DOC_ID));
    if (snap.exists()) {
      return (snap.data() as Record<string, PlanTier>) || {};
    }
  } catch (e) {
    console.warn('Failed fetching template plan-tier overrides:', e);
  }
  return {};
}

export async function setTemplatePlanTier(templateId: string, planTier: PlanTier): Promise<void> {
  const docRef = doc(db, TEMPLATE_CONFIG_COLLECTION, TEMPLATE_CONFIG_DOC_ID);
  await setDoc(docRef, { [templateId]: planTier }, { merge: true });
}

export async function updateUserPlanTier(
  userId: string,
  planTier: PlanTier,
  days: number = SUBSCRIPTION_DURATION_DAYS
): Promise<{ planTier: PlanTier; planExpiresAt: string | null }> {
  const planExpiresAt = planTier === 'Free Plan' ? null : computeExpiryDate(days);
  const docRef = doc(db, USERS_COLLECTION, userId);
  try {
    await setDoc(
      docRef,
      { planTier, planExpiresAt, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.warn('Firestore update failed for plan tier:', e);
  }

  try {
    const current = await fetchPlatformUsers();
    const updated = current.map((u) => (u.uid === userId ? { ...u, planTier, planExpiresAt } : u));
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed updating local user plan cache', e);
  }

  return { planTier, planExpiresAt };
}

/**
 * Record the device ID + fingerprint seen for a given account on successful login.
 * This lets an admin later look up "which device(s) has this troll account used"
 * so they can block them from the Users tab.
 */
export async function recordUserDevice(
  userId: string,
  deviceId: string,
  fingerprint: string,
  identity?: { email?: string | null; name?: string | null }
): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? (snap.data() as any) : {};
    const deviceIds: string[] = Array.from(
      new Set([...(existing.deviceIds || []), deviceId])
    ).slice(-10); // keep last 10 devices per account
    const fingerprints: string[] = Array.from(
      new Set([...(existing.fingerprints || []), fingerprint])
    ).slice(-10);

    await setDoc(
      docRef,
      {
        deviceIds,
        fingerprints,
        email: identity?.email || existing.email || '',
        name: identity?.name || existing.name || '',
        planTier: existing.planTier || 'Free Plan',
        createdAt: existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to record device for user (non-fatal):', e);
  }
}

/**
 * Checks whether the given device ID or fingerprint is on the block list.
 * Fails "open" (returns false) if Firestore is unreachable, so a network hiccup
 * never locks out a legitimate user.
 */
export async function isDeviceBlocked(
  deviceId: string,
  fingerprint: string
): Promise<boolean> {
  try {
    const [deviceSnap, fingerprintSnap] = await Promise.all([
      getDoc(doc(db, BLOCKED_DEVICES_COLLECTION, deviceId)),
      getDoc(doc(db, BLOCKED_DEVICES_COLLECTION, fingerprint)),
    ]);
    return deviceSnap.exists() || fingerprintSnap.exists();
  } catch (e) {
    console.warn('Device block check failed (allowing access):', e);
    return false;
  }
}

/**
 * Admin action: block one or more device IDs / fingerprints so that logins from
 * those browsers are rejected regardless of which account is used to sign in.
 */
export async function blockDevice(
  idsToBlockInput: string[],
  opts: { reason?: string; blockedByEmail?: string; relatedUserEmail?: string; deviceIds?: string[] }
): Promise<void> {
  const createdAt = new Date().toISOString();
  const idsToBlock = Array.from(new Set(idsToBlockInput.filter(Boolean)));
  const knownDeviceIds = new Set(opts.deviceIds || idsToBlock);

  await Promise.all(
    idsToBlock.map((id) =>
      setDoc(doc(db, BLOCKED_DEVICES_COLLECTION, id), {
        id,
        type: knownDeviceIds.has(id) ? 'deviceId' : 'fingerprint',
        reason: opts.reason || 'Blocked by admin',
        blockedByEmail: opts.blockedByEmail || ADMIN_EMAIL,
        relatedUserEmail: opts.relatedUserEmail || '',
        createdAt,
      } as BlockedDevice)
    )
  );

  try {
    const cached = localStorage.getItem(STORAGE_BLOCKED_DEVICES_KEY);
    const list: BlockedDevice[] = cached ? JSON.parse(cached) : [];
    const additions: BlockedDevice[] = idsToBlock.map((id) => ({
      id,
      type: knownDeviceIds.has(id) ? 'deviceId' : 'fingerprint',
      reason: opts.reason || 'Blocked by admin',
      blockedByEmail: opts.blockedByEmail || ADMIN_EMAIL,
      relatedUserEmail: opts.relatedUserEmail || '',
      createdAt,
    }));
    localStorage.setItem(
      STORAGE_BLOCKED_DEVICES_KEY,
      JSON.stringify([...additions, ...list.filter((d) => !idsToBlock.includes(d.id))])
    );
  } catch (e) {
    console.warn('Failed updating local blocked-device cache', e);
  }
}

export async function unblockDevice(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, BLOCKED_DEVICES_COLLECTION, id));
  } catch (e) {
    console.warn('Failed to unblock device:', e);
  }
  try {
    const cached = localStorage.getItem(STORAGE_BLOCKED_DEVICES_KEY);
    const list: BlockedDevice[] = cached ? JSON.parse(cached) : [];
    localStorage.setItem(
      STORAGE_BLOCKED_DEVICES_KEY,
      JSON.stringify(list.filter((d) => d.id !== id))
    );
  } catch (e) {
    console.warn('Failed updating local blocked-device cache', e);
  }
}

export async function fetchBlockedDevices(): Promise<BlockedDevice[]> {
  try {
    const snapshot = await getDocs(collection(db, BLOCKED_DEVICES_COLLECTION));
    const list: BlockedDevice[] = [];
    snapshot.forEach((d) => list.push(d.data() as BlockedDevice));
    localStorage.setItem(STORAGE_BLOCKED_DEVICES_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn('Firestore fetch failed for blocked devices, using local cache:', e);
    try {
      const cached = localStorage.getItem(STORAGE_BLOCKED_DEVICES_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}
