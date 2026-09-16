import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Maximize2,
  Network,
  RefreshCw,
  Search,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  SchemaDiagramData,
  SchemaDiagramRelation,
  SchemaDiagramTable,
} from "@/domain/database/types";

const NODE_WIDTH = 236;
const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 26;
const MAX_VISIBLE_COLUMNS = 8;
const NODE_GAP_X = 92;
const NODE_GAP_Y = 30;
const CANVAS_PADDING = 56;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.4;
const RELATION_CULL_MARGIN = 120;
const MAX_CANVAS_DPR = 2;

interface DiagramPosition {
  x: number;
  y: number;
}

interface DiagramLayout {
  positions: Map<string, DiagramPosition>;
  width: number;
  height: number;
  visibleTables: SchemaDiagramTable[];
}

interface RelationGeometry {
  source: DiagramPosition;
  target: DiagramPosition;
  control1: DiagramPosition;
  control2: DiagramPosition;
}

interface PositionedRelation extends RelationGeometry {
  relation: SchemaDiagramRelation;
  sourceBounds: DiagramBounds;
  targetBounds: DiagramBounds;
}

interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SchemaDiagramProps {
  data?: SchemaDiagramData;
  loading: boolean;
  fetching?: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenTable: (tableName: string) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function tableHeight(table: SchemaDiagramTable) {
  const visibleRows = Math.max(1, Math.min(table.columns.length, MAX_VISIBLE_COLUMNS));
  const overflowHeight = table.columns.length > MAX_VISIBLE_COLUMNS ? 27 : 0;
  return HEADER_HEIGHT + visibleRows * ROW_HEIGHT + overflowHeight + 10;
}

function createLayout(
  tables: SchemaDiagramTable[],
  relations: SchemaDiagramRelation[],
  hiddenTables: Set<string>,
): DiagramLayout {
  const visibleTables = tables.filter((table) => !hiddenTables.has(table.name));
  const tableNames = new Set(visibleTables.map((table) => table.name));
  const children = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  visibleTables.forEach((table) => {
    children.set(table.name, new Set());
    indegree.set(table.name, 0);
  });

  relations.forEach((relation) => {
    if (!tableNames.has(relation.sourceTable) || !tableNames.has(relation.targetTable)) return;
    const targetChildren = children.get(relation.targetTable);
    if (!targetChildren || targetChildren.has(relation.sourceTable)) return;
    targetChildren.add(relation.sourceTable);
    indegree.set(relation.sourceTable, (indegree.get(relation.sourceTable) ?? 0) + 1);
  });

  const levels = new Map<string, number>();
  const queue = visibleTables
    .filter((table) => indegree.get(table.name) === 0)
    .map((table) => table.name)
    .sort((left, right) => left.localeCompare(right));

  queue.forEach((name) => {
    levels.set(name, 0);
  });

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    if (!current) continue;
    const currentLevel = levels.get(current) ?? 0;

    children.get(current)?.forEach((child) => {
      levels.set(child, Math.max(levels.get(child) ?? 0, currentLevel + 1));
      const nextDegree = (indegree.get(child) ?? 1) - 1;
      indegree.set(child, nextDegree);
      if (nextDegree === 0) queue.push(child);
    });
  }

  visibleTables.forEach((table) => {
    if (!levels.has(table.name)) levels.set(table.name, 0);
  });

  const columns = new Map<number, SchemaDiagramTable[]>();
  visibleTables.forEach((table) => {
    const level = levels.get(table.name) ?? 0;
    const current = columns.get(level) ?? [];
    current.push(table);
    columns.set(level, current);
  });

  const positions = new Map<string, DiagramPosition>();
  let maxColumnHeight = 0;
  let maxLevel = 0;

  Array.from(columns.entries())
    .sort(([left], [right]) => left - right)
    .forEach(([level, columnTables]) => {
      maxLevel = Math.max(maxLevel, level);
      let y = CANVAS_PADDING;

      columnTables
        .sort((left, right) => left.name.localeCompare(right.name))
        .forEach((table) => {
          positions.set(table.name, {
            x: CANVAS_PADDING + level * (NODE_WIDTH + NODE_GAP_X),
            y,
          });
          y += tableHeight(table) + NODE_GAP_Y;
        });

      maxColumnHeight = Math.max(maxColumnHeight, y - NODE_GAP_Y);
    });

  return {
    positions,
    visibleTables,
    width: Math.max(900, CANVAS_PADDING * 2 + (maxLevel + 1) * NODE_WIDTH + maxLevel * NODE_GAP_X),
    height: Math.max(560, CANVAS_PADDING * 2 + maxColumnHeight),
  };
}

function columnCenterY(position: DiagramPosition, table: SchemaDiagramTable, columnName: string) {
  const columnIndex = table.columns.findIndex((column) => column.name === columnName);
  const rowIndex = columnIndex < 0 ? 0 : Math.min(columnIndex, MAX_VISIBLE_COLUMNS - 1);
  return position.y + HEADER_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

function relationGeometry(
  relation: SchemaDiagramRelation,
  layout: DiagramLayout,
  tables: Map<string, SchemaDiagramTable>,
): RelationGeometry | null {
  const sourcePosition = layout.positions.get(relation.sourceTable);
  const targetPosition = layout.positions.get(relation.targetTable);
  const sourceTable = tables.get(relation.sourceTable);
  const targetTable = tables.get(relation.targetTable);
  if (!sourcePosition || !targetPosition || !sourceTable || !targetTable) return null;

  const sourceIsRight = sourcePosition.x >= targetPosition.x;
  const sourceX = sourceIsRight ? sourcePosition.x : sourcePosition.x + NODE_WIDTH;
  const targetX = sourceIsRight ? targetPosition.x + NODE_WIDTH : targetPosition.x;
  const direction = sourceIsRight ? -1 : 1;
  const spread = Math.max(38, Math.abs(targetX - sourceX) * 0.42);
  const sourceY = columnCenterY(sourcePosition, sourceTable, relation.sourceColumn);
  const targetY = columnCenterY(targetPosition, targetTable, relation.targetColumn);

  return {
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
    control1: { x: sourceX + direction * spread, y: sourceY },
    control2: { x: targetX - direction * spread, y: targetY },
  };
}

const DiagramTableCard = memo(function DiagramTableCard({
  table,
  position,
  onOpenTable,
}: {
  table: SchemaDiagramTable;
  position: DiagramPosition;
  onOpenTable: (tableName: string) => void;
}) {
  const { t } = useTranslation();
  const displayedColumns = table.columns.slice(0, MAX_VISIBLE_COLUMNS);
  const hiddenColumnCount = Math.max(0, table.columns.length - displayedColumns.length);

  return (
    <div
      data-diagram-node
      className="absolute overflow-hidden rounded-lg border border-border/80 bg-card shadow-md shadow-slate-900/5 dark:shadow-black/20"
      style={{
        left: position.x,
        top: position.y,
        width: NODE_WIDTH,
        height: tableHeight(table),
        contentVisibility: "auto",
        containIntrinsicSize: `${NODE_WIDTH}px ${tableHeight(table)}px`,
      }}
    >
      <button
        type="button"
        onClick={() => onOpenTable(table.name)}
        className="flex h-[38px] w-full items-center gap-2 border-b border-border/70 bg-muted/55 px-3 text-left transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
        title={t("explorer.diagram_open_table")}
      >
        <Table2 size={14} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{table.name}</span>
        <span className="rounded border border-border/70 bg-background/75 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {table.type || "table"}
        </span>
      </button>

      <div className="divide-y divide-border/45">
        {displayedColumns.length > 0 ? displayedColumns.map((column) => (
          <div key={column.name} className="flex h-[26px] items-center gap-2 px-3 text-[11px]">
            <KeyRound size={11} className={column.isPrimaryKey ? "shrink-0 text-primary" : "shrink-0 text-muted-foreground/35"} />
            <span className={column.isPrimaryKey ? "min-w-0 flex-1 truncate font-medium text-foreground" : "min-w-0 flex-1 truncate text-muted-foreground"}>
              {column.name}
            </span>
            <span className="max-w-[84px] truncate font-mono text-[10px] text-muted-foreground/75">{column.type}</span>
          </div>
        )) : (
          <div className="flex h-[26px] items-center px-3 text-[11px] text-muted-foreground">{t("explorer.diagram_no_columns")}</div>
        )}
      </div>

      {hiddenColumnCount > 0 && (
        <div className="border-t border-border/45 px-3 py-1.5 text-[10px] text-muted-foreground">
          {t("explorer.diagram_more_columns", { count: hiddenColumnCount })}
        </div>
      )}
    </div>
  );
});

export function SchemaDiagram({ data, loading, fetching = false, error, onRefresh, onOpenTable }: SchemaDiagramProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [hiddenTables, setHiddenTables] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.82);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const diagramLayerRef = useRef<HTMLDivElement>(null);
  const relationsCanvasRef = useRef<HTMLCanvasElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const panRef = useRef({ x: 32, y: 32 });
  const zoomRef = useRef(0.82);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pendingPanRef = useRef<DiagramPosition | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const zoomSyncTimeoutRef = useRef<number | null>(null);

  const tables = data?.tables ?? [];
  const relations = data?.relations ?? [];
  const tableMap = useMemo(() => new Map(tables.map((table) => [table.name, table])), [tables]);
  const layout = useMemo(() => createLayout(tables, relations, hiddenTables), [hiddenTables, relations, tables]);
  const positionedRelations = useMemo<PositionedRelation[]>(() => {
    const next: PositionedRelation[] = [];
    relations.forEach((relation) => {
      const geometry = relationGeometry(relation, layout, tableMap);
      const sourcePosition = layout.positions.get(relation.sourceTable);
      const targetPosition = layout.positions.get(relation.targetTable);
      const sourceTable = tableMap.get(relation.sourceTable);
      const targetTable = tableMap.get(relation.targetTable);
      if (!geometry || !sourcePosition || !targetPosition || !sourceTable || !targetTable) return;
      next.push({
        relation,
        ...geometry,
        sourceBounds: {
          x: sourcePosition.x,
          y: sourcePosition.y,
          width: NODE_WIDTH,
          height: tableHeight(sourceTable),
        },
        targetBounds: {
          x: targetPosition.x,
          y: targetPosition.y,
          width: NODE_WIDTH,
          height: tableHeight(targetTable),
        },
      });
    });
    return next;
  }, [layout, relations, tableMap]);
  const filteredTables = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return tables.filter((table) => !normalizedSearch || table.name.toLocaleLowerCase().includes(normalizedSearch));
  }, [search, tables]);

  const drawRelations = useCallback(() => {
    const canvas = relationsCanvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport || viewport.clientWidth === 0 || viewport.clientHeight === 0) return;

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
    const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const currentZoom = zoomRef.current;
    if (currentZoom <= 0 || relations.length === 0) return;
    const currentPan = panRef.current;
    const left = -currentPan.x / currentZoom - RELATION_CULL_MARGIN;
    const right = (width - currentPan.x) / currentZoom + RELATION_CULL_MARGIN;
    const top = -currentPan.y / currentZoom - RELATION_CULL_MARGIN;
    const bottom = (height - currentPan.y) / currentZoom + RELATION_CULL_MARGIN;
    const primaryColor = getComputedStyle(viewport).getPropertyValue("--primary").trim() || "#3b82f6";

    context.globalAlpha = 0.65;
    context.strokeStyle = primaryColor;
    context.fillStyle = primaryColor;
    context.lineWidth = Math.max(1, 1.6 * currentZoom);
    context.lineCap = "round";

    const toScreen = (point: DiagramPosition) => ({
      x: currentPan.x + point.x * currentZoom,
      y: currentPan.y + point.y * currentZoom,
    });

    const intersectsViewport = (bounds: DiagramBounds) => (
      bounds.x + bounds.width > left &&
      bounds.x < right &&
      bounds.y + bounds.height > top &&
      bounds.y < bottom
    );

    positionedRelations.forEach(({ relation, sourceBounds, targetBounds, ...geometry }) => {
      if (!intersectsViewport(sourceBounds) || !intersectsViewport(targetBounds)) return;
      const minX = Math.min(geometry.source.x, geometry.target.x, geometry.control1.x, geometry.control2.x);
      const maxX = Math.max(geometry.source.x, geometry.target.x, geometry.control1.x, geometry.control2.x);
      const minY = Math.min(geometry.source.y, geometry.target.y, geometry.control1.y, geometry.control2.y);
      const maxY = Math.max(geometry.source.y, geometry.target.y, geometry.control1.y, geometry.control2.y);
      if (maxX < left || minX > right || maxY < top || minY > bottom) return;

      const source = toScreen(geometry.source);
      const target = toScreen(geometry.target);
      const control1 = toScreen(geometry.control1);
      const control2 = toScreen(geometry.control2);
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, target.x, target.y);
      context.stroke();
      const radius = Math.max(2, 3 * currentZoom);
      context.beginPath();
      context.arc(source.x, source.y, radius, 0, Math.PI * 2);
      context.arc(target.x, target.y, radius, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
  }, [positionedRelations]);

  const scheduleRelationsDraw = useCallback(() => {
    if (drawFrameRef.current !== null) return;
    drawFrameRef.current = window.requestAnimationFrame(() => {
      drawFrameRef.current = null;
      drawRelations();
    });
  }, [drawRelations]);

  const updateCanvasTransform = useCallback((nextPan: DiagramPosition, nextZoom: number) => {
    panRef.current = nextPan;
    zoomRef.current = nextZoom;

    if (diagramLayerRef.current) {
      diagramLayerRef.current.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`;
    }

    if (viewportRef.current) {
      const gridSize = 24 * nextZoom;
      viewportRef.current.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      viewportRef.current.style.backgroundPosition = `${nextPan.x % gridSize}px ${nextPan.y % gridSize}px`;
    }

    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(nextZoom * 100)}%`;
    }
    scheduleRelationsDraw();
  }, [scheduleRelationsDraw]);

  const updateCanvasPan = useCallback((nextPan: DiagramPosition) => {
    panRef.current = nextPan;
    if (diagramLayerRef.current) {
      diagramLayerRef.current.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${zoomRef.current})`;
    }
    scheduleRelationsDraw();
  }, [scheduleRelationsDraw]);

  const scheduleZoomStateSync = useCallback(() => {
    if (zoomSyncTimeoutRef.current !== null) {
      window.clearTimeout(zoomSyncTimeoutRef.current);
    }
    zoomSyncTimeoutRef.current = window.setTimeout(() => {
      zoomSyncTimeoutRef.current = null;
      setZoom(zoomRef.current);
    }, 120);
  }, []);

  useEffect(() => () => {
    if (zoomSyncTimeoutRef.current !== null) {
      window.clearTimeout(zoomSyncTimeoutRef.current);
    }
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
    }
    if (drawFrameRef.current !== null) {
      window.cancelAnimationFrame(drawFrameRef.current);
    }
  }, []);

  useEffect(() => {
    const availableNames = new Set(tables.map((table) => table.name));
    setHiddenTables((current) => {
      const next = new Set(Array.from(current).filter((name) => availableNames.has(name)));
      if (next.size === current.size) return current;
      return next;
    });
  }, [tables]);

  useEffect(() => {
    scheduleRelationsDraw();
  }, [scheduleRelationsDraw]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => scheduleRelationsDraw());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [scheduleRelationsDraw]);

  const fitDiagram = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nextZoom = clamp(
      Math.min(
        (viewport.clientWidth - 80) / layout.width,
        (viewport.clientHeight - 80) / layout.height,
        1,
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    const nextPan = {
      x: Math.max(20, (viewport.clientWidth - layout.width * nextZoom) / 2),
      y: Math.max(20, (viewport.clientHeight - layout.height * nextZoom) / 2),
    };
    updateCanvasTransform(nextPan, nextZoom);
    setZoom(nextZoom);
  }, [layout.height, layout.width, updateCanvasTransform]);

  useEffect(() => {
    if (!data || loading) return;
    const frame = window.requestAnimationFrame(fitDiagram);
    return () => window.cancelAnimationFrame(frame);
  }, [data, fitDiagram, loading]);

  const toggleTableVisibility = (tableName: string) => {
    setHiddenTables((current) => {
      const next = new Set(current);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextZoom = clamp(zoomRef.current - event.deltaY * 0.001, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === zoomRef.current) return;
    updateCanvasTransform(panRef.current, nextZoom);
    scheduleZoomStateSync();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-diagram-node]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    pendingPanRef.current = {
      x: dragRef.current.panX + event.clientX - dragRef.current.x,
      y: dragRef.current.panY + event.clientY - dragRef.current.y,
    };
    if (panFrameRef.current !== null) return;
    panFrameRef.current = window.requestAnimationFrame(() => {
      panFrameRef.current = null;
      const nextPan = pendingPanRef.current;
      pendingPanRef.current = null;
      if (nextPan) updateCanvasPan(nextPan);
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
    if (pendingPanRef.current) {
      updateCanvasPan(pendingPanRef.current);
      pendingPanRef.current = null;
    }
    dragRef.current = null;
    setDragging(false);
  };

  const changeZoom = (delta: number) => {
    const nextZoom = clamp(zoomRef.current + delta, MIN_ZOOM, MAX_ZOOM);
    updateCanvasTransform(panRef.current, nextZoom);
    setZoom(nextZoom);
  };
  const zoomIn = () => changeZoom(0.1);
  const zoomOut = () => changeZoom(-0.1);
  const showAll = () => setHiddenTables(new Set());

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border/30 bg-muted/15" aria-label={t("explorer.diagram")}>
      <div className="flex min-h-12 shrink-0 items-center gap-4 border-b border-border/45 bg-background px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Network size={15} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-foreground">{t("explorer.diagram")}</h3>
            <p className="truncate text-[10px] text-muted-foreground">{t("explorer.diagram_desc")}</p>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
          <span className="rounded bg-muted px-2 py-1">{t("explorer.diagram_tables", { count: tables.length })}</span>
          <span className="rounded bg-muted px-2 py-1">{t("explorer.diagram_relations", { count: relations.length })}</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={zoomOut} aria-label={t("explorer.diagram_zoom_out")} title={t("explorer.diagram_zoom_out")}>
            <ZoomOut size={14} />
          </Button>
          <span ref={zoomLabelRef} className="w-10 text-center font-mono text-[10px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-sm" onClick={zoomIn} aria-label={t("explorer.diagram_zoom_in")} title={t("explorer.diagram_zoom_in")}>
            <ZoomIn size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={fitDiagram}>
            <Maximize2 size={13} />
            {t("explorer.diagram_fit")}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={fetching} aria-label={t("explorer.diagram_refresh")} title={t("explorer.diagram_refresh")}>
            <RefreshCw size={14} className={fetching ? "animate-spin" : undefined} />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={viewportRef}
          className={`relative min-w-0 flex-1 overflow-hidden bg-[#f7f9fc] dark:bg-[#17191d] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--border) 42%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 42%, transparent) 1px, transparent 1px)",
            backgroundSize: `${24 * zoomRef.current}px ${24 * zoomRef.current}px`,
            backgroundPosition: `${panRef.current.x % (24 * zoomRef.current)}px ${panRef.current.y % (24 * zoomRef.current)}px`,
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {!loading && !error && layout.visibleTables.length > 0 && (
            <canvas
              ref={relationsCanvasRef}
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
              aria-hidden="true"
            />
          )}

          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw size={22} className="animate-spin text-primary" />
              <span className="text-[12px]">{t("explorer.diagram_loading")}</span>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertCircle size={24} className="text-destructive" />
              <div>
                <p className="text-[13px] font-medium text-foreground">{t("explorer.diagram_error")}</p>
                <p className="mt-1 max-w-md text-[11px] text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={onRefresh}>{t("explorer.diagram_retry")}</Button>
            </div>
          ) : layout.visibleTables.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Network size={24} className="text-primary/60" />
              <span className="text-[12px]">{tables.length > 0 ? t("explorer.diagram_all_hidden") : t("explorer.diagram_empty")}</span>
              {tables.length > 0 && <Button variant="ghost" size="sm" onClick={showAll}>{t("explorer.diagram_show_all")}</Button>}
            </div>
          ) : (
            <div
              ref={diagramLayerRef}
              className="absolute left-0 top-0 origin-top-left overflow-visible"
              style={{
                transform: `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoomRef.current})`,
                willChange: dragging ? "transform" : undefined,
              }}
            >
              {layout.visibleTables.map((table) => {
                const position = layout.positions.get(table.name);
                if (!position) return null;
                return <DiagramTableCard key={table.name} table={table} position={position} onOpenTable={onOpenTable} />;
              })}
            </div>
          )}

          {!loading && !error && layout.visibleTables.length > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
              <Link2 size={11} className="text-primary" />
              <span>{t("explorer.diagram_pan_hint")}</span>
            </div>
          )}
        </div>

        <aside className="hidden w-64 shrink-0 flex-col border-l border-border/45 bg-background/90 lg:flex">
          <div className="border-b border-border/45 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("explorer.diagram_search")}
                aria-label={t("explorer.diagram_search")}
                className="h-8 bg-muted/35 pl-8 text-[11px] shadow-none"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground">{t("explorer.diagram_tables_label")}</span>
              <button type="button" onClick={showAll} className="text-primary hover:underline">{t("explorer.diagram_show_all")}</button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2 custom-scrollbar">
            {filteredTables.map((table) => {
              const hidden = hiddenTables.has(table.name);
              return (
                <div key={table.name} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${hidden ? "opacity-50" : "hover:bg-muted/55"}`}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => onOpenTable(table.name)}
                    title={t("explorer.diagram_open_table")}
                  >
                    <Table2 size={13} className="shrink-0 text-primary/75" />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{table.name}</span>
                  </button>
                  <button
                    type="button"
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => toggleTableVisibility(table.name)}
                    aria-label={hidden ? t("explorer.diagram_show_table") : t("explorer.diagram_hide_table")}
                    aria-pressed={!hidden}
                    title={hidden ? t("explorer.diagram_show_table") : t("explorer.diagram_hide_table")}
                  >
                    {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              );
            })}

            {filteredTables.length === 0 && <p className="px-2 py-5 text-center text-[11px] text-muted-foreground">{t("explorer.diagram_no_matches")}</p>}
          </div>

          <div className="border-t border-border/45 px-3 py-2 text-[10px] text-muted-foreground">
            {t("explorer.diagram_visible_summary", { visible: layout.visibleTables.length, total: tables.length })}
          </div>
        </aside>
      </div>
    </section>
  );
}
