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
import type { Epic, Dependency } from '../lib/api';

// --- Dagre layout helper ---

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  nodes.forEach((node) => {
    const width = node.type === 'epicNode' ? 280 : 220;
    const height = node.type === 'epicNode' ? 110 : 80;
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const width = node.type === 'epicNode' ? 280 : 220;
    const height = node.type === 'epicNode' ? 110 : 80;
    return {
      ...node,
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// --- Status dot colors ---

const statusDotColors: Record<string, string> = {
  done: '#10b981',
  active: '#0ea5e9',
  in_progress: '#0ea5e9',
  todo: '#f59e0b',
  backlog: '#9ca3af',
  cancelled: '#ef4444',
  in_review: '#8b5cf6',
};

const statusBadgeColors: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700',
  active: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-sky-100 text-sky-700',
  todo: 'bg-amber-100 text-amber-700',
  backlog: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  in_review: 'bg-violet-100 text-violet-700',
};

const typeBadgeColors: Record<string, string> = {
  task: 'bg-blue-50 text-blue-600',
  bug: 'bg-red-50 text-red-600',
  spike: 'bg-purple-50 text-purple-600',
  story: 'bg-green-50 text-green-600',
};

// --- Custom Node: Epic ---

function EpicNode({ data }: NodeProps) {
  const epic = data as { title: string; status: string; progress: number; key: string };
  const badgeColor = statusBadgeColors[epic.status] || 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white border-2 border-teal-500 rounded-xl shadow-md px-4 py-3" style={{ width: 280 }}>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-2 !h-2" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-mono">{epic.key}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badgeColor}`}>
          {String(epic.status).replace('_', ' ')}
        </span>
      </div>
      <div className="font-semibold text-slate-800 text-sm mb-2 truncate">{epic.title}</div>
      <div className="flex items-center gap-2">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex-1">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, epic.progress))}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">{epic.progress}%</span>
      </div>
    </div>
  );
}

// --- Custom Node: Issue ---

function IssueNode({ data }: NodeProps) {
  const issue = data as { title: string; status: string; issueType: string; assignee: string | null; key: string };
  const dotColor = statusDotColors[issue.status] || '#9ca3af';
  const typeColor = typeBadgeColors[issue.issueType] || 'bg-gray-50 text-gray-500';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2.5 hover:shadow-md transition-shadow" style={{ width: 220 }}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="text-xs text-slate-400 font-mono">{issue.key}</span>
        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium ${typeColor}`}>
          {issue.issueType}
        </span>
      </div>
      <div className="text-sm text-slate-700 truncate">{issue.title}</div>
      {issue.assignee && (
        <div className="text-xs text-slate-400 mt-1">@{issue.assignee}</div>
      )}
    </div>
  );
}

const nodeTypes = { epicNode: EpicNode, issueNode: IssueNode };

// --- Props ---

export interface GraphData {
  epics: Epic[];
  trees: Map<string, Epic>;
  dependencies: Map<string, Dependency[]>;
}

// --- Main Component ---

export function EpicTreeGraph({ data }: { data: GraphData }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    data.epics.forEach((epic) => {
      const tree = data.trees.get(epic.id);
      const epicData = tree || epic;

      nodes.push({
        id: `epic-${epic.id}`,
        type: 'epicNode',
        position: { x: 0, y: 0 },
        data: {
          title: epicData.title,
          status: epicData.status,
          progress: epicData.progress,
          key: epicData.key,
        },
      });

      const issues = tree?.issues || [];
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

        // Epic -> Issue edge
        edges.push({
          id: `e-epic-${epic.id}-issue-${issue.id}`,
          source: `epic-${epic.id}`,
          target: `issue-${issue.id}`,
          style: { stroke: '#9ca3af', strokeWidth: 1.5 },
          type: 'smoothstep',
        });

        // Issue -> Issue dependency edges
        const deps = data.dependencies.get(issue.id) || [];
        deps.forEach((dep) => {
          const depColor =
            dep.dependencyType === 'blocks' ? '#ef4444' :
            dep.dependencyType === 'depends_on' ? '#f97316' :
            '#3b82f6';

          edges.push({
            id: `dep-${dep.id}`,
            source: `issue-${dep.sourceId}`,
            target: `issue-${dep.targetId}`,
            style: { stroke: depColor, strokeWidth: 1.5, strokeDasharray: '6 3' },
            type: 'smoothstep',
            markerEnd: { type: 'arrowclosed' as any, color: depColor },
            label: dep.dependencyType.replace('_', ' '),
            labelStyle: { fontSize: 10, fill: depColor },
          });
        });
      });
    });

    // De-duplicate dependency edges by id
    const seenEdgeIds = new Set<string>();
    const uniqueEdges = edges.filter((e) => {
      if (seenEdgeIds.has(e.id)) return false;
      seenEdgeIds.add(e.id);
      return true;
    });

    if (nodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const layouted = getLayoutedElements(nodes, uniqueEdges);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [data]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.2 }), 50);
  }, []);

  if (initialNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        No epics to display
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-12rem)] rounded-xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls position="bottom-left" className="!bg-white !border-gray-200 !shadow-sm" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => (node.type === 'epicNode' ? '#14b8a6' : '#e2e8f0')}
          className="!bg-white !border-gray-200 !shadow-sm"
          maskColor="rgba(0,0,0,0.05)"
        />
      </ReactFlow>
    </div>
  );
}
