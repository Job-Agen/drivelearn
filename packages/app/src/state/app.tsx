import { randomUUID } from "expo-crypto";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { applyAnswers, questionsToReview, type Mastery } from "../domain/mistakes";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { AppError, isOffline } from "../lib/http";
import { kv } from "../lib/storage";
import type { Answer, ContentBundle, Me, PendingSession, Progress, SessionKind } from "../lib/types";

// État partagé de l'app : compte, contenu hors ligne, progrès et séances en attente d'envoi.
// Tout ce qui est utile hors ligne est gardé sur le téléphone ; le serveur reste la référence.

const K = {
  me: "me",
  content: "content",
  progress: "progress",
  pending: "pending_sessions",
  completed: "completed_lessons",
  mastery: "mastery",
} as const;

export type Status = "loading" | "signedOut" | "signedIn";

export type FinishedSession = {
  kind: SessionKind;
  lessonId?: string | null;
  unitId?: string | null;
  startedAt: number;
  answers: (Answer & { correct: boolean })[];
};

type AppContextValue = {
  status: Status;
  me: Me | null;
  bundle: ContentBundle | null;
  progress: Progress | null;
  completed: ReadonlySet<string>;
  mastery: Mastery;
  pendingCount: number;
  syncing: boolean;
  lastError: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, firstName: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  updateMe(patch: Parameters<typeof api.updateMe>[0]): Promise<void>;
  setMe(me: Me): Promise<void>;
  refresh(): Promise<void>;
  finishSession(session: FinishedSession): Promise<void>;
  localReview(): string[];
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = use(AppContext);
  if (!value) throw new Error("useApp doit être utilisé dans <AppProvider>");
  return value;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMeState] = useState<Me | null>(null);
  const [bundle, setBundle] = useState<ContentBundle | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [mastery, setMastery] = useState<Mastery>({});
  const [pending, setPending] = useState<PendingSession[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Références à jour pour les fonctions asynchrones (évite les fermetures périmées).
  const ref = useRef({ pending, bundle, localCompleted, mastery });
  ref.current = { pending, bundle, localCompleted, mastery };

  const setMe = useCallback(async (value: Me) => {
    setMeState(value);
    await kv.set(K.me, value);
  }, []);

  const resetLocal = useCallback(async () => {
    await kv.remove(...Object.values(K));
    setMeState(null);
    setBundle(null);
    setProgress(null);
    setLocalCompleted([]);
    setMastery({});
    setPending([]);
  }, []);

  const handleAuthError = useCallback(
    async (error: unknown) => {
      if (error instanceof AppError && error.status === 401) {
        await auth.forget();
        await resetLocal();
        setStatus("signedOut");
        return true;
      }
      return false;
    },
    [resetLocal],
  );

  /** Envoie les séances en attente. Celles refusées par le serveur sont abandonnées (elles ne passeront jamais). */
  const flush = useCallback(async () => {
    const queue = ref.current.pending;
    if (queue.length === 0) return;
    const { results } = await api.submitSessions(queue.slice(0, 50));
    const handled = new Set(results.map((r) => r.id));
    const rest = ref.current.pending.filter((s) => !handled.has(s.id));
    setPending(rest);
    await kv.set(K.pending, rest);
  }, []);

  const refresh = useCallback(async () => {
    if (!(await auth.hasSession())) return;
    setSyncing(true);
    try {
      await flush();
      const fresh = await api.me();
      await setMe(fresh);
      if (fresh.program_id) {
        const current = ref.current.bundle;
        const res = await api.content(current?.version);
        if (res.changed) {
          const next: ContentBundle = {
            version: res.version,
            images_base_url: res.images_base_url,
            max_review_per_lesson: res.max_review_per_lesson,
            content: res.content,
          };
          setBundle(next);
          await kv.set(K.content, next);
        }
        const p = await api.progress();
        setProgress(p);
        await kv.set(K.progress, p);
      }
      setLastError(null);
    } catch (error) {
      if (await handleAuthError(error)) return;
      setLastError(isOffline(error) ? null : error instanceof Error ? error.message : "Synchronisation impossible.");
    } finally {
      setSyncing(false);
    }
  }, [flush, handleAuthError, setMe]);

  // Démarrage : lecture du cache local, puis synchronisation en arrière-plan.
  useEffect(() => {
    (async () => {
      const [cachedMe, cachedContent, cachedProgress, cachedPending, cachedCompleted, cachedMastery] = await Promise.all([
        kv.get<Me>(K.me),
        kv.get<ContentBundle>(K.content),
        kv.get<Progress>(K.progress),
        kv.get<PendingSession[]>(K.pending),
        kv.get<string[]>(K.completed),
        kv.get<Mastery>(K.mastery),
      ]);
      setMeState(cachedMe);
      setBundle(cachedContent);
      setProgress(cachedProgress);
      setPending(cachedPending ?? []);
      setLocalCompleted(cachedCompleted ?? []);
      setMastery(cachedMastery ?? {});
      const signedIn = await auth.hasSession();
      if (signedIn && !cachedMe) {
        // Session présente mais profil jamais chargé : il faut le serveur avant d'afficher quoi que ce soit.
        try {
          await setMe(await api.me());
        } catch (error) {
          if (await handleAuthError(error)) return;
        }
      }
      setStatus(signedIn ? "signedIn" : "signedOut");
    })();
  }, [handleAuthError, setMe]);

  useEffect(() => {
    if (status !== "signedIn") return;
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [status, refresh]);

  const afterSignIn = useCallback(
    async (firstName?: string) => {
      await resetLocal();
      let fresh = await api.me();
      // Le prénom saisi à l'inscription est repris dans le profil avant d'afficher la configuration.
      if (firstName && !fresh.first_name) fresh = await api.updateMe({ first_name: firstName });
      await setMe(fresh);
      setStatus("signedIn");
    },
    [resetLocal, setMe],
  );

  const value = useMemo<AppContextValue>(() => {
    const completed = new Set([...(progress?.completed_lesson_ids ?? []), ...localCompleted]);
    return {
      status,
      me,
      bundle,
      progress,
      completed,
      mastery,
      pendingCount: pending.length,
      syncing,
      lastError,
      async signIn(email, password) {
        await auth.signIn(email.trim(), password);
        await afterSignIn();
      },
      async signUp(email, password, firstName) {
        await auth.signUp(email.trim(), password, firstName.trim());
        // Si la vérification d'e-mail est exigée, la connexion échoue ici avec EMAIL_NOT_VERIFIED.
        await auth.signIn(email.trim(), password);
        await afterSignIn(firstName.trim());
      },
      async signOut() {
        await auth.signOut();
        await resetLocal();
        setStatus("signedOut");
      },
      async deleteAccount() {
        await api.deleteAccount();
        await auth.forget();
        await resetLocal();
        setStatus("signedOut");
      },
      async updateMe(patch) {
        const updated = await api.updateMe(patch);
        await setMe(updated);
        if ("program_id" in patch) await refresh();
      },
      setMe,
      refresh,
      async finishSession(s) {
        const session: PendingSession = {
          id: randomUUID(),
          kind: s.kind,
          lesson_id: s.lessonId ?? null,
          unit_id: s.unitId ?? null,
          completed_at: new Date().toISOString(),
          active_seconds: Math.min(3600, Math.round((Date.now() - s.startedAt) / 1000)),
          answers: s.answers.map(({ question_id, choice_ids }) => ({ question_id, choice_ids })),
        };
        const queue = [...ref.current.pending, session];
        setPending(queue);
        ref.current.pending = queue;
        await kv.set(K.pending, queue);

        const nextMastery = applyAnswers(ref.current.mastery, s.answers);
        setMastery(nextMastery);
        await kv.set(K.mastery, nextMastery);

        if (s.kind === "lecon" && s.lessonId && !ref.current.localCompleted.includes(s.lessonId)) {
          const done = [...ref.current.localCompleted, s.lessonId];
          setLocalCompleted(done);
          await kv.set(K.completed, done);
        }
        refresh(); // envoi en arrière-plan ; hors ligne, la séance attend la prochaine connexion
      },
      localReview: () => questionsToReview(ref.current.mastery),
    };
  }, [status, me, bundle, progress, localCompleted, mastery, pending.length, syncing, lastError, afterSignIn, resetLocal, setMe, refresh]);

  return <AppContext value={value}>{children}</AppContext>;
}
