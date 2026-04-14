"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Group as PanelGroup, Panel, Separator as PanelSeparator, usePanelRef } from "react-resizable-panels";
import { ActivityBar } from "./ActivityBar";
import { TabBar } from "./TabBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileExplorer } from "@/features/file-explorer/FileExplorer";
import { SearchPanel } from "@/features/search/SearchPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { RightPanel } from "./RightPanel";
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
import { useSettingsStore } from "@/state/settings.store";
import { useUXStore } from "@/state/ux.store";
import { QUESTIONNAIRE_TEMPLATE } from "@/config/questionnaire";
import { useIsElectron } from "@/hooks/useIsElectron";
import { cn } from "@/lib/utils";

/** Generate a very subtle, desaturated HSL color from a string */
function getContextColor(str: string | null) {
  if (!str) return null;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  // Low saturation (15-25%), High lightness (85-95%) for a "ghost" tint
  return `hsla(${h}, 20%, 50%, 0.03)`;
}
import type { Tab } from "@/types/expediente";

// ─── Session persistence ──────────────────────────────────────────────────────

const SESSION_KEY = "revisor:session";

interface SessionState {
  rootPath: string | null;
  expandedPaths: string[];
  tabs: Tab[];
  activeTabId: string | null;
  sidebarSize?: number;    // last expanded percentage
  rightPanelSize?: number; // last percentage
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
  const { activeSidebarView, setSidebarView } = useWorkbenchStore();
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
  const { clientesFolder, revisionesFolder } = useSettingsStore();
  const { contextTinting } = useUXStore();
  const { revisionPath, meta } = useRevisionStore();
  const inElectron = useIsElectron();
  const sidebarRef    = usePanelRef();
  const rightPanelRef = usePanelRef();

  const contextColor = (contextTinting && meta) ? getContextColor(meta.expedienteId) : null;

  // Track sidebar size to detect collapse → expand transitions
  const prevSidebarSizeRef     = useRef<number>(22);
  const sidebarExpandedSizeRef = useRef<number>(22);  // last non-zero sidebar %
  const rightPanelSizeRef      = useRef<number>(36);  // last right panel %
  const [sidebarKey, setSidebarKey] = useState(0);

  // Prevent double-restore across strict mode double-invocation
  const sessionRestoredRef = useRef(false);

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
  }, [inElectron, openDirectoryByPath, restoreTabs]);

  // ── Session save on window close ───────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { root: currentRoot, expandedPaths } = useExplorerStore.getState();
      const { tabs, activeTabId } = useEditorStore.getState();
      saveSession({
        rootPath: currentRoot?.path ?? null,
        expandedPaths: [...expandedPaths],
        tabs,
        activeTabId,
        sidebarSize:    sidebarExpandedSizeRef.current,
        rightPanelSize: rightPanelSizeRef.current,
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
    } else {
      unloadCitas();
      unloadDocStatus();
      unloadSintesis();
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
      console.log(`[FS EVENT] add: ${path}`);
      addFileToTree(path, parentPath, name);
    });

    const offAddDir = window.api.onFsAddDir(({ path, parentPath, name }) => {
      console.log(`[FS EVENT] addDir: ${path}`);
      addFolderToTree(path, parentPath, name);
    });

    const offRemove = window.api.onFsRemove(({ path }) => {
      console.log(`[FS EVENT] remove: ${path}`);
      removeFromTree(path);
    });

    const offRemoveDir = window.api.onFsRemoveDir(({ path }) => {
      console.log(`[FS EVENT] removeDir: ${path}`);
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

  return (
    <div 
      className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground transition-colors duration-1000"
      style={{ backgroundColor: contextColor || undefined }}
    >
      <HealthMonitor />
      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Sidebar + Editor */}
        <PanelGroup orientation="horizontal" className="flex-1">
          {/* Sidebar */}
          <Panel
            panelRef={sidebarRef}
            defaultSize={22}
            minSize="160px"
            collapsible
            collapsedSize={0}
            onResize={(size) => {
              const pct = size.asPercentage;
              if (pct === 0) {
                handlePanelCollapse();
              } else {
                if (prevSidebarSizeRef.current === 0) {
                  // Transitioning from collapsed → expanded: force virtual list remount
                  setSidebarKey((k) => k + 1);
                }
                sidebarExpandedSizeRef.current = pct;
              }
              prevSidebarSizeRef.current = pct;
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

          {/* Editor area */}
          <Panel style={{ overflow: "hidden" }}>
            <div className="flex h-full flex-col">
              {/* Tab bar */}
              <TabBar />

              {/* Breadcrumbs */}
              <Breadcrumbs file={activeFile} rootPath={root?.path ?? null} />

              {/* PDF + Questionnaire */}
              <div className="min-h-0 flex-1 overflow-hidden">
                <PanelGroup orientation="horizontal" className="h-full w-full">
                  {/* PDF Viewer */}
                  <Panel minSize="200px" style={{ overflow: "hidden" }}>
                    <PdfViewer file={activeFile} />
                  </Panel>

                  <ResizeHandle />

                  {/* Right panel: Cuestionario / Notas tabs */}
                  <Panel
                    panelRef={rightPanelRef}
                    defaultSize={36}
                    minSize="200px"
                    style={{ overflow: "hidden" }}
                    onResize={(size) => {
                      rightPanelSizeRef.current = size.asPercentage;
                    }}
                  >
                    <RightPanel questions={QUESTIONNAIRE_TEMPLATE} />
                  </Panel>
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <footer className="flex h-[22px] shrink-0 items-center gap-3 bg-muted/80 px-3 text-muted-foreground border-t border-border">
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
    </div>
  );
}
