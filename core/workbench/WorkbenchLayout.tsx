"use client";

import { useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Group as PanelGroup, Panel, Separator as PanelSeparator, usePanelRef } from "react-resizable-panels";
import { ActivityBar } from "./ActivityBar";
import { TabBar } from "./TabBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileExplorer } from "@/features/file-explorer/FileExplorer";
import { Questionnaire } from "@/features/questionnaire/Questionnaire";
import { SearchPanel } from "@/features/search/SearchPanel";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useEditorStore } from "@/state/editor.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useSearchStore } from "@/state/search.store";
import { QUESTIONNAIRE_TEMPLATE } from "@/config/questionnaire";
import { useIsElectron } from "@/hooks/useIsElectron";
import { cn } from "@/lib/utils";

const PdfViewer = dynamic(
  () => import("@/features/pdf-viewer/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false },
);

// ─── Resize handle ────────────────────────────────────────────────────────────

function ResizeHandle({ className }: { className?: string }) {
  return (
    <PanelSeparator
      className={cn(
        "group relative z-10 flex w-[4px] shrink-0 cursor-col-resize bg-transparent",
        "transition-colors hover:bg-primary/20 active:bg-primary/30",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-border",
        "hover:after:bg-primary/40",
        className,
      )}
    />
  );
}

// ─── Workbench ────────────────────────────────────────────────────────────────

export function WorkbenchLayout() {
  const { activeSidebarView, setSidebarView } = useWorkbenchStore();
  const { activeTab }  = useEditorStore();
  const {
    indexStatus, setIndexStatus, root,
    addFileToTree, addFolderToTree, removeFromTree,
  } = useExplorerStore();
  const { setIndexed } = useSearchStore();
  const inElectron = useIsElectron();
  const sidebarRef = usePanelRef();

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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
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
            minSize="120px"
            collapsible
            collapsedSize={0}
            onResize={(size) => { if (size.asPercentage === 0) handlePanelCollapse(); }}
            style={{ overflow: "hidden" }}
          >
            <div className="flex h-full w-full flex-col overflow-hidden border-r">
              {activeSidebarView === "explorer" && <FileExplorer />}
              {activeSidebarView === "search"   && <SearchPanel />}
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

                  {/* Questionnaire */}
                  <Panel
                    defaultSize={36}
                    minSize="200px"
                    style={{ overflow: "hidden" }}
                    className="border-l"
                  >
                    <Questionnaire
                      questions={QUESTIONNAIRE_TEMPLATE}
                      filePath={activeFile?.path ?? null}
                    />
                  </Panel>
                </PanelGroup>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <footer className="flex h-6 shrink-0 items-center gap-3 border-t bg-primary px-3 text-primary-foreground">
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
