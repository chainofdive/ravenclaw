import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';
import type { ProjectTree, Dependency } from '../lib/api';

// --- Layout ---

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

  const sizes: Record<string, { w: number; h: number }> = {
    projectNode: { w: 320, h: 100 },
    epicNode: { w: 280, h: 100 },
    issueNode: { w: 220, h: 70 },
  };

  nodes.forEach((node) => {
    const s = sizes[node.type ?? ''] ?? { w: 220, h: 70 };
    g.setNode(node.id, { width: s.w, height: s.h });
  });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const pos = g.node(node.id);
      const s = sizes[node.type ?? ''] ?? { w: 220, h: 70 };
      return { ...node, position: { x: pos.x - s.w / 2, y: pos.y - s.h / 2 } };
    }),
    edges,
  };
}

// --- Status colors ---

const statusBadgeColors: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700',
  active: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-sky-100 text-sky-700',
  todo: 'bg-amber-100 text-amber-700',
  backlog: 'bg-gray-100 text-gray-600',
  planning: 'bg-violet-100 text-violet-700',
  on_hold: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  in_review: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

const statusDotColors: Record<string, string> = {
  done: '#10b981',
  active: '#0ea5e9',
  in_progress: '#0ea5e9',
  todo: '#f59e0b',
  backlog: '#9ca3af',
  cancelled: '#ef4444',
  in_review: '#8b5cf6',
};

const typeBadgeColors: Record<string, string> = {
  task: 'bg-blue-50 text-blue-600',
  bug: 'bg-red-50 text-red-600',
  spike: 'bg-purple-50 text-purple-600',
  story: 'bg-green-50 text-green-600',
};

// --- Project Node ---

function ProjectNode({ data }: NodeProps) {
  const p = data as { name: string; status: string; key: string; epicCount: number };
  const badge = statusBadgeColors[p.status] || 'bg-gray-100 text-gray-600';
  return (
    <div className="bg-white border-2 border-purple-500 rounded-xl shadow-lg px-5 py-3" style={{ width: 320 }}>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-purple-500 font-mono font-bold">{p.key}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badge}`}>
          {p.status.replace('_', ' ')}
        </span>
      </div>
      <div className="font-bold text-slate-900 text-base truncate">{p.name}</div>
      <div className="text-xs text-slate-400 mt-1">{p.epicCount} epic{p.epicCount !== 1 ? 's' : ''}</div>
    </div>
  );
}

// --- Epic Node ---

function EpicNode({ data }: NodeProps) {
  const epic = data as { title: string; status: string; progress: number; key: string; issueCount: number; doneCount: number };
  const badge = statusBadgeColors[epic.status] || 'bg-gray-100 text-gray-600';
  return (
    <div className="bg-white border-2 border-teal-500 rounded-xl shadow-md px-4 py-3" style={{ width: 280 }}>
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-2 !h-2" />
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-teal-600 font-mono">{epic.key}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badge}`}>
          {epic.status.replace('_', ' ')}
        </span>
      </div>
      <div className="font-semibold text-slate-800 text-sm truncate">{epic.title}</div>
      <div className="flex items-center gap-2 mt-2">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex-1">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, epic.progress))}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">{epic.doneCount}/{epic.issueCount}</span>
      </div>
    </div>
  );
}

// --- Issue Node ---

function IssueNode({ data }: NodeProps) {
  const issue = data as { title: string; status: string; issueType: string; assignee: string | null; key: string };
  const dotColor = statusDotColors[issue.status] || '#9ca3af';
  const typeColor = typeBadgeColors[issue.issueType] || 'bg-gray-50 text-gray-500';
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2" style={{ width: 220 }}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="text-xs text-slate-400 font-mono">{issue.key}</span>
        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium ${typeColor}`}>{issue.issueType}</span>
      </div>
      <div className="text-sm text-slate-700 truncate">{issue.title}</div>
      {issue.assignee && <div className="text-xs text-slate-400 mt-0.5">@{issue.assignee}</div>}
    </div>
  );
}

const nodeTypes = { projectNode: ProjectNode, epicNode: EpicNode, issueNode: IssueNode };

// --- Props ---

export interface ProjectGraphData {
  project: ProjectTree;
  epicDependencies: Map<string, Dependency[]>;
  issueDependencies: Map<string, Dependency[]>;
}

// --- Main ---

export function ProjectTreeGraph({ data }: { data: ProjectGraphData }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const { project } = data;

    // Project node
    nodes.push({
      id: `project-${project.id}`,
      type: 'projectNode',
      position: { x: 0, y: 0 },
      data: { name: project.name, status: project.status, key: project.key, epicCount: project.epics.length },
    });

    // Epic nodes + edges
    project.epics.forEach((epic) => {
      const issues = epic.issues || [];
      nodes.push({
        id: `epic-${epic.id}`,
        type: 'epicNode',
        position: { x: 0, y: 0 },
        data: {
          title: epic.title,
          status: epic.status,
          progress: epic.progress,
          key: epic.key,
          issueCount: issues.length,
          doneCount: issues.filter((i) => i.status === 'done').length,
        },
      });

      // Project → Epic
      edges.push({
        id: `e-proj-${project.id}-epic-${epic.id}`,
        source: `project-${project.id}`,
        target: `epic-${epic.id}`,
        style: { stroke: '#a78bfa', strokeWidth: 2 },
        type: 'smoothstep',
      });

      // Epic → Epic dependencies
      const epicDeps = data.epicDependencies.get(epic.id) || [];
      epicDeps.forEach((dep) => {
        if (dep.sourceType === 'epic' && dep.targetType === 'epic') {
          const color = dep.dependencyType === 'blocks' ? '#ef4444' : dep.dependencyType === 'depends_on' ? '#f97316' : '#3b82f6';
          edges.push({
            id: `dep-epic-${dep.id}`,
            source: `epic-${dep.sourceId}`,
            target: `epic-${dep.targetId}`,
            style: { stroke: color, strokeWidth: 2, strokeDasharray: '8 4' },
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' as any, color },
            label: dep.dependencyType.replace('_', ' '),
            labelStyle: { fontSize: 10, fill: color },
          });
        }
      });

      // Issue nodes
      issues.forEach((issue) => {
        nodes.push({
          id: `issue-${issue.id}`,
          type: 'issueNode',
          position: { x: 0, y: 0 },
          data: {
            title: issue.title,
            status: issue.status,
            issueType: issue.issueType,
            assignee: issue.assignee,
            key: issue.key,
          },
        });

        // Epic → Issue
        edges.push({
          id: `e-epic-${epic.id}-issue-${issue.id}`,
          source: `epic-${epic.id}`,
          target: `issue-${issue.id}`,
          style: { stroke: '#9ca3af', strokeWidth: 1.5 },
          type: 'smoothstep',
        });

        // Issue → Issue dependencies
        const issueDeps = data.issueDependencies.get(issue.id) || [];
        issueDeps.forEach((dep) => {
          const color = dep.dependencyType === 'blocks' ? '#ef4444' : dep.dependencyType === 'depends_on' ? '#f97316' : '#3b82f6';
          edges.push({
            id: `dep-issue-${dep.id}`,
            source: `issue-${dep.sourceId}`,
            target: `issue-${dep.targetId}`,
            style: { stroke: color, strokeWidth: 1.5, strokeDasharray: '6 3' },
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' as any, color },
            label: dep.dependencyType.replace('_', ' '),
            labelStyle: { fontSize: 10, fill: color },
          });
        });
      });
    });

    // De-duplicate edges
    const seen = new Set<string>();
    const uniqueEdges = edges.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    if (nodes.length === 0) return { initialNodes: [], initialEdges: [] };

    const layouted = getLayoutedElements(nodes, uniqueEdges);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [data]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.15 }), 50);
  }, []);

  if (initialNodes.length === 0) {
    return <div className="flex items-center justify-center h-96 text-slate-400">No data to display</div>;
  }

  return (
    <div className="w-full h-[calc(100vh-16rem)] rounded-xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls position="bottom-left" className="!bg-white !border-gray-200 !shadow-sm" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) =>
            node.type === 'projectNode' ? '#a78bfa' :
            node.type === 'epicNode' ? '#14b8a6' : '#e2e8f0'
          }
          className="!bg-white !border-gray-200 !shadow-sm"
          maskColor="rgba(0,0,0,0.05)"
        />
      </ReactFlow>
    </div>
  );
}
