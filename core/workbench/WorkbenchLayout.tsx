"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Group as PanelGroup, Panel, Separator as PanelSeparator, usePanelRef } from "react-resizable-panels";
import { ActivityBar } from "./ActivityBar";
import { TabBar } from "./TabBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileExplorer } from "@/features/file-explorer/FileExplorer";
import { SearchPanel } from "@/features/search/SearchPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { RightPanel } from "./RightPanel";
import { PdfToolbar } from "./PdfToolbar";
import { HealthMonitor } from "./HealthMonitor";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useEditorStore } from "@/state/editor.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useSearchStore } from "@/state/search.store";
import { useRevisionStore } from "@/state/revision.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useCitasStore } from "@/state/citas.store";
import { useDocStatusStore } from "@/state/docStatus.store";
import { useSintesisStore } from "@/state/sintesis.store";
import { useBookmarksStore } from "@/state/bookmarks.store";
import { useSettingsStore } from "@/state/settings.store";
import { useUXStore } from "@/state/ux.store";
import { QUESTIONNAIRE_TEMPLATE } from "@/config/questionnaire";
import { useIsElectron } from "@/hooks/useIsElectron";
import { cn } from "@/lib/utils";

import { IconFocusCentered } from "@tabler/icons-react";
import type { Tab } from "@/types/expediente";

function getTintStyle(id: string | null) {
  if (!id) return undefined;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `linear-gradient(135deg, hsla(${h}, 25%, 50%, 0.04) 0%, transparent 100%)`;
}

// ─── Session persistence ──────────────────────────────────────────────────────

const SESSION_KEY = "revisor:session";

interface SessionState {
  rootPath: string | null;
  expandedPaths: string[];
  tabs: Tab[];
  activeTabId: string | null;
  sidebarSize?: number;    // last expanded percentage
  rightPanelSize?: number; // last percentage
  activeSidebarView: string | null;
}

function loadSession(): SessionState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

function saveSession(state: SessionState) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

const PdfViewer = dynamic(
  () => import("@/features/pdf-viewer/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false },
);

// ─── Resize handle ────────────────────────────────────────────────────────────

function ResizeHandle({ className }: { className?: string }) {
  return (
    <PanelSeparator
      className={cn(
        "group relative z-10 flex w-[6px] shrink-0 items-center justify-center cursor-col-resize bg-transparent",
        "after:absolute after:inset-y-0 after:w-[1px] after:bg-border/50",
        "hover:after:bg-primary/50 active:after:bg-primary transition-colors hover:delay-150",
        className,
      )}
    />
  );
}

// ─── Workbench ────────────────────────────────────────────────────────────────

export function WorkbenchLayout() {
  const { activeSidebarView, setSidebarView, splitFile, setSplitFile } = useWorkbenchStore();
  const { activeTab, restoreTabs }  = useEditorStore();
  const {
    indexStatus, setIndexStatus, root,
    addFileToTree, addFolderToTree, removeFromTree,
    openDirectoryByPath,
  } = useExplorerStore();
  const { setIndexed } = useSearchStore();
  const { loadRevision, unloadRevision } = useRevisionStore();
  const { loadAnotaciones, unloadAnotaciones } = useAnotacionesStore();
  const { loadCitas, unloadCitas }             = useCitasStore();
  const { loadDocStatus, unloadDocStatus }     = useDocStatusStore();
  const { loadSintesis, unloadSintesis }       = useSintesisStore();
  const { loadBookmarks, unloadBookmarks }     = useBookmarksStore();
  const { clientesFolder, revisionesFolder } = useSettingsStore();
  const { contextTinting, zenMode, readingMode, setReadingMode, autoReadingMode, readingModeStartHour } = useUXStore();
  const { revisionPath, meta } = useRevisionStore();
  const inElectron = useIsElectron();

  const tintStyle = useMemo(
    () => (contextTinting && meta?.expedienteId ? getTintStyle(meta.expedienteId) : undefined),
    [contextTinting, meta?.expedienteId],
  );
  const sidebarRef    = usePanelRef();
  const rightPanelRef = usePanelRef();

  // Track sidebar size to detect collapse → expand transitions
  const prevSidebarSizeRef     = useRef<number>(22);
  const sidebarExpandedSizeRef = useRef<number>(22);  // last non-zero sidebar %
  const rightPanelSizeRef      = useRef<number>(36);  // last right panel %
  const [sidebarKey, setSidebarKey] = useState(0);

  // Prevent double-restore across strict mode double-invocation
  const sessionRestoredRef = useRef(false);

  // ── Auto reading mode (time-based) — global, not per-pane ────────────────
  useEffect(() => {
    if (!autoReadingMode) return;
    const check = () => {
      const h = new Date().getHours();
      setReadingMode(h >= readingModeStartHour || h < 6);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [autoReadingMode, readingModeStartHour, setReadingMode]);

  // Sync panel collapse ↔ store
  const handlePanelCollapse = useCallback(() => setSidebarView(null), [setSidebarView]);

  // When store says "open sidebar" but panel is collapsed, expand
  useEffect(() => {
    if (activeSidebarView) {
      sidebarRef.current?.expand?.();
    } else {
      sidebarRef.current?.collapse?.();
    }
  }, [activeSidebarView, sidebarRef]);

  // ── Session restore (once, on Electron ready) ──────────────────────────────
  useEffect(() => {
    if (!inElectron || sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    const session = loadSession();
    if (!session) return;

    if (session.tabs.length > 0) {
      restoreTabs(session.tabs, session.activeTabId);
    }
    if (session.rootPath) {
      openDirectoryByPath(session.rootPath, session.expandedPaths);
    }

    if (session.activeSidebarView) {
      setSidebarView(session.activeSidebarView as any);
    }

    // Restore panel sizes after panels have mounted
    requestAnimationFrame(() => {
      if (session.sidebarSize && session.sidebarSize > 0) {
        sidebarRef.current?.resize(session.sidebarSize);
        sidebarExpandedSizeRef.current = session.sidebarSize;
      }
      if (session.rightPanelSize && session.rightPanelSize > 0) {
        rightPanelRef.current?.resize(session.rightPanelSize);
        rightPanelSizeRef.current = session.rightPanelSize;
      }
    });
  }, [inElectron, openDirectoryByPath, restoreTabs, setSidebarView]);

  // ── Session save on window close ───────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { root: currentRoot, expandedPaths } = useExplorerStore.getState();
      const { tabs, activeTabId } = useEditorStore.getState();
      const { activeSidebarView } = useWorkbenchStore.getState();

      saveSession({
        rootPath: currentRoot?.path ?? null,
        expandedPaths: [...expandedPaths],
        tabs,
        activeTabId,
        sidebarSize:    sidebarExpandedSizeRef.current,
        rightPanelSize: rightPanelSizeRef.current,
        activeSidebarView,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    // Also save periodically or on visibility change as backup
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") handleBeforeUnload();
    };
    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sidebarExpandedSizeRef, rightPanelSizeRef]);

  // ── Load / unload revision when the explorer root changes ─────────────────
  useEffect(() => {
    if (!inElectron) return;
    if (root?.path) {
      loadRevision(root.path);
    } else {
      unloadRevision();
      unloadAnotaciones();
    }
  // revisionesFolder is intentionally in deps: if the user configures it for
  // the first time while an expediente is already open, we re-initialize.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root?.path, clientesFolder, revisionesFolder, inElectron]);

  // ── Load / unload annotations once revisionPath becomes available ──────────
  useEffect(() => {
    if (!inElectron) return;
    if (revisionPath) {
      loadAnotaciones(revisionPath);
    } else {
      unloadAnotaciones();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionPath, inElectron]);

  // ── Load / unload citas, docStatus, sintesis ───────────────────────────────
  useEffect(() => {
    if (!inElectron) return;
    if (revisionPath) {
      loadCitas(revisionPath);
      loadDocStatus(revisionPath);
      loadSintesis(revisionPath);
      loadBookmarks(revisionPath);
    } else {
      unloadCitas();
      unloadDocStatus();
      unloadSintesis();
      unloadBookmarks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionPath, inElectron]);

  // Wire indexer + granular FS events
  useEffect(() => {
    if (!inElectron) return;

    const offProgress = window.api.onIndexProgress(({ indexed, rootPath }) => {
      setIndexStatus({ state: "indexing", total: indexed, rootPath });
    });

    const offComplete = window.api.onIndexComplete(({ total, rootPath }) => {
      setIndexStatus({ state: "complete", total, rootPath });
      setIndexed(true);
    });

    // Granular watcher events → surgical tree mutations (no full reload)
    const offAdd = window.api.onFsAdd(({ path, parentPath, name }) => {
      addFileToTree(path, parentPath, name);
    });
    const offAddDir = window.api.onFsAddDir(({ path, parentPath, name }) => {
      addFolderToTree(path, parentPath, name);
    });
    const offRemove = window.api.onFsRemove(({ path }) => {
      removeFromTree(path);
    });
    const offRemoveDir = window.api.onFsRemoveDir(({ path }) => {
      removeFromTree(path);
    });

    return () => {
      offProgress();
      offComplete();
      offAdd();
      offAddDir();
      offRemove();
      offRemoveDir();
    };
  }, [inElectron, setIndexStatus, setIndexed, addFileToTree, addFolderToTree, removeFromTree]);

  const activeFile = activeTab();

  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={cn(
        "flex h-screen flex-col overflow-hidden bg-background transition-colors duration-1000",
      )}
      style={{
        background: tintStyle,
        filter: readingMode ? "sepia(0.4) brightness(0.9) contrast(1.05)" : undefined,
        transition: "filter 0.6s ease",
      }}
    >
      <HealthMonitor />

      {showIntro && (
        <div className="fixed inset-0 z-[30000] flex flex-col items-center justify-center bg-background pointer-events-none animate-out fade-out duration-1000 fill-mode-forwards">
          <div className="flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-700">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <IconFocusCentered size={24} className="text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <h1 className="text-sm font-bold tracking-[0.3em] uppercase text-foreground/80">Espacio de Foco</h1>
              <p className="text-[10px] text-muted-foreground/60 font-medium">Preparando entorno sanitario...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Activity Bar */}
        {!zenMode && <ActivityBar />}

        {/* Sidebar + Editor */}
        <PanelGroup orientation="horizontal" className="flex-1">
          {/* Sidebar */}
          {!zenMode && (
            <>
              <Panel
                panelRef={sidebarRef}
                defaultSize={22}
                minSize="160px"
                collapsible
                collapsedSize={0}
                onResize={(panelSize) => {
                  const size = panelSize.asPercentage;
                  if (size === 0) {
                    handlePanelCollapse();
                  } else {
                    if (prevSidebarSizeRef.current === 0) {
                      // Transitioning from collapsed → expanded: force virtual list remount
                      setSidebarKey((k) => k + 1);
                    }
                    sidebarExpandedSizeRef.current = size;
                  }
                  prevSidebarSizeRef.current = size;
                }}
                style={{ overflow: "hidden" }}
              >
                <div key={sidebarKey} className="flex h-full w-full flex-col overflow-hidden bg-muted/10">
                  {activeSidebarView === "explorer" && <FileExplorer />}
                  {activeSidebarView === "search"   && <SearchPanel />}
                  {activeSidebarView === "settings" && <SettingsPanel />}
                </div>
              </Panel>
              <ResizeHandle />
            </>
          )}

          {/* Editor area */}
          <Panel style={{ overflow: "hidden" }}>
            <div className="flex h-full flex-col">
              {/* Tab bar */}
              <TabBar />

              {/* Breadcrumbs */}
              <Breadcrumbs file={activeFile} rootPath={root?.path ?? null} />

              {/* Single shared PDF toolbar */}
              <PdfToolbar />

              {/* PDF + Questionnaire */}
              <div className="min-h-0 flex-1 overflow-hidden">
                <PanelGroup orientation="horizontal" className="h-full w-full">
                  {/* PDF Viewer — single or split */}
                  <Panel minSize="200px" style={{ overflow: "hidden" }}>
                    {splitFile ? (
                      <PanelGroup orientation="horizontal" className="h-full w-full">
                        <Panel minSize="200px" style={{ overflow: "hidden" }}>
                          <PdfViewer file={activeFile} paneId="left" />
                        </Panel>
                        <ResizeHandle />
                        <Panel minSize="200px" style={{ overflow: "hidden" }}>
                          <PdfViewer
                            file={splitFile}
                            isSplitPane
                            paneId="right"
                            onCloseSplit={() => setSplitFile(null)}
                          />
                        </Panel>
                      </PanelGroup>
                    ) : (
                      <PdfViewer file={activeFile} paneId="left" />
                    )}
                  </Panel>

                  {/* Right panel: Cuestionario / Notas tabs */}
                  {!zenMode && (
                    <>
                      <ResizeHandle />
                      <Panel
                        panelRef={rightPanelRef}
                        defaultSize={36}
                        minSize="200px"
                        style={{ overflow: "hidden" }}
                        onResize={(panelSize) => {
                          rightPanelSizeRef.current = panelSize.asPercentage;
                        }}
                      >
                        <RightPanel questions={QUESTIONNAIRE_TEMPLATE} />
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      {!zenMode && (
        <footer className="flex h-[22px] shrink-0 items-center gap-3 bg-muted/80 px-3 text-muted-foreground border-t border-border animate-in slide-in-from-bottom-2 duration-300">
          <span className="text-[11px] font-medium">
            {indexStatus.state === "indexing" && `Indexando… ${indexStatus.total} archivos`}
            {indexStatus.state === "complete"  && `${indexStatus.total} archivos indexados`}
            {indexStatus.state === "idle"      && "Listo"}
          </span>
          {activeFile && (
            <>
              <span className="opacity-40">│</span>
              <span className="truncate text-[11px] opacity-70">{activeFile.path}</span>
              <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase tracking-wider opacity-80">
                {activeFile.type}
              </span>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
