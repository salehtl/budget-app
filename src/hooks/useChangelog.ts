import { useCallback, useEffect, useRef, useState } from "react";
import { useDb } from "@/context/DbContext";
import { getAllSettings, setSetting } from "@/db/queries/settings";
import { emitDbEvent, onDbEvent } from "@/lib/db-events";
import { changelogEntries, latestVersion } from "@/lib/changelog";

const SETTINGS_KEY = "last_seen_version";
const DISMISSED_KEY = "changelog_dismissed";

export function useChangelog() {
  const db = useDb();
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const runId = useRef(0);

  const fetchSettings = useCallback(() => {
    const id = ++runId.current;
    getAllSettings(db).then((s) => {
      if (runId.current === id) {
        setLastSeen(s[SETTINGS_KEY] ?? null);
        setDismissed(s[DISMISSED_KEY] === "true");
        setLoaded(true);
      }
    });
  }, [db]);

  useEffect(() => {
    fetchSettings();
    return () => { runId.current++; };
  }, [fetchSettings]);

  useEffect(() => {
    return onDbEvent("settings-changed", fetchSettings);
  }, [fetchSettings]);

  const hasNew = loaded && !dismissed && lastSeen !== latestVersion;

  const markSeen = useCallback(async () => {
    await setSetting(db, SETTINGS_KEY, latestVersion);
    setLastSeen(latestVersion);
    emitDbEvent("settings-changed");
  }, [db]);

  const setDismissNotifications = useCallback(async (value: boolean) => {
    await setSetting(db, DISMISSED_KEY, value ? "true" : "false");
    setDismissed(value);
    emitDbEvent("settings-changed");
  }, [db]);

  return { entries: changelogEntries, latestVersion, hasNew, dismissed, markSeen, setDismissNotifications };
}
