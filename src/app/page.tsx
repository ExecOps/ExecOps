'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { format, formatDistanceToNow } from 'date-fns';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Play, FileText, History, Plus, Trash2, Edit, Eye, Server,
  CheckCircle2, XCircle, Clock, Cpu, HardDrive, Activity, FolderOpen,
  Terminal, LayoutDashboard, BookOpen, RotateCcw, AlertCircle,
  ClipboardCopy, Search, Package, Puzzel, Loader2, CircleDot,
  MemoryStick, Timer, Hash, Layers, ArrowUpRight, Zap, Monitor,
  CpuIcon, Database, Globe, Info, ChevronDown, SquareTerminal,
  Boxes, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// ─── TYPES ──────────────────────────────────────────────────────────

interface Playbook {
  name: string;
  displayName: string;
  description: string;
  taskCount: number;
  size: number;
  modified: number;
  created: number;
}

interface Execution {
  id: string;
  playbook: string;
  status: 'running' | 'success' | 'failed';
  startTime: number;
  endTime: number | null;
  duration: number | null;
  exitCode: number | null;
}

interface Template {
  name: string;
  displayName: string;
  description: string;
  category: string;
  taskCount: number;
}

interface AnsibleModule {
  name: string;
  collection: string;
  shortName: string;
}

interface CollectionInfo {
  name: string;
  count: number;
}

interface ModulesResponse {
  modules: AnsibleModule[];
  total: number;
  collections: CollectionInfo[];
}

interface InventoryHost {
  name: string;
  vars: Record<string, string>;
}

interface InventoryGroup {
  name: string;
  hosts: string[];
  vars: Record<string, string>;
}

interface InventoryData {
  content: string;
  hosts: InventoryHost[];
  groups: InventoryGroup[];
}

interface Facts {
  hostname: string;
  distribution: string;
  distribution_version: string;
  distribution_release: string;
  architecture: string;
  kernel: string;
  os_family: string;
  system: string;
  processor_vcpus: number;
  processor_count: number;
  memtotal_mb: number;
  memfree_mb: number;
  memreal: { free: number; total: number; used: number } | null;
  swaptotal_mb: number;
  swapfree_mb: number;
  python_version: string;
  uptime_seconds: number;
  virtualization_type: string;
  ansible_version: string;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────

const COLLECTION_HUES = [
  'bg-emerald-50 text-emerald-700 border-emerald-200 bg-emerald-500',
  'bg-sky-50 text-sky-700 border-sky-200 bg-sky-500',
  'bg-amber-50 text-amber-700 border-amber-200 bg-amber-500',
  'bg-violet-50 text-violet-700 border-violet-200 bg-violet-500',
  'bg-rose-50 text-rose-700 border-rose-200 bg-rose-500',
  'bg-teal-50 text-teal-700 border-teal-200 bg-teal-500',
  'bg-orange-50 text-orange-700 border-orange-200 bg-orange-500',
  'bg-cyan-50 text-cyan-700 border-cyan-200 bg-cyan-500',
  'bg-pink-50 text-pink-700 border-pink-200 bg-pink-500',
  'bg-lime-50 text-lime-700 border-lime-200 bg-lime-500',
];

function getCollectionColor(index: number) {
  const parts = COLLECTION_HUES[index % COLLECTION_HUES.length].split(' ');
  return { bg: parts[0], text: parts[1], border: parts[2], dot: parts[3] };
}

// ─── HELPERS ────────────────────────────────────────────────────────

async function fetchPlaybooks(): Promise<Playbook[]> {
  const res = await fetch('/api/ansible/playbooks');
  if (!res.ok) throw new Error('Failed to fetch playbooks');
  return res.json();
}

async function fetchExecutions(): Promise<Execution[]> {
  const res = await fetch('/api/ansible/executions');
  if (!res.ok) throw new Error('Failed to fetch executions');
  return res.json();
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch('/api/ansible/templates');
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

async function fetchFacts(): Promise<Facts> {
  const res = await fetch('/api/ansible/facts');
  if (!res.ok) throw new Error('Failed to fetch facts');
  return res.json();
}

async function fetchInventory(): Promise<InventoryData> {
  const res = await fetch('/api/ansible/inventory');
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

async function fetchModules(): Promise<ModulesResponse> {
  const res = await fetch('/api/ansible/modules');
  if (!res.ok) throw new Error('Failed to fetch modules');
  return res.json();
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ${secs}s`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'success':
      return { label: 'Exitoso', variant: 'default' as const, icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' };
    case 'failed':
      return { label: 'Fallido', variant: 'destructive' as const, icon: XCircle, className: 'bg-red-500/10 text-red-700 border-red-200', dotColor: 'bg-red-500' };
    default:
      return { label: 'Ejecutando', variant: 'secondary' as const, icon: Clock, className: 'bg-amber-500/10 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' };
  }
}

function getCatColor(category: string) {
  // Simple hash-based color assignment for template categories
  const idx = category.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLLECTION_HUES.length;
  const parts = COLLECTION_HUES[idx].split(' ');
  return { bg: parts[0], text: parts[1], border: parts[2], dot: parts[3] };
}

// framer-motion variants
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

// ─── SKELETON COMPONENTS ───────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-lg" /><div className="space-y-2 flex-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-12" /></div></div></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /></div>)}</CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" /></div>)}</CardContent></Card>
      </div>
    </div>
  );
}

function PlaybooksSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5 space-y-3"><div className="flex justify-between"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-12 rounded-full" /></div><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /><div className="flex gap-2 pt-2">{Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-8 w-8 rounded-md" />)}</div></CardContent></Card>
        ))}
      </div>
    </div>
  );
}

function ModulesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="flex gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}</div>
      <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 flex-1" /></div></CardContent></Card>)}</div>
    </div>
  );
}

// ─── ANIMATED COUNTER ──────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 30));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        setDisplayed(start);
      }
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return <>{displayed}</>;
}

// ─── YAML SYNTAX HIGHLIGHTING (Red Hat Ansible Style) ──────

function YamlHighlight({ code }: { code: string }) {
  return (
    <pre className="text-[13px] font-mono bg-gray-950 text-gray-300 rounded-xl p-5 whitespace-pre-wrap overflow-x-auto leading-relaxed" style={{ tabSize: 2 }}>
      {code.split('\n').map((line, i) => <YamlLine key={i} line={line} />)}
    </pre>
  );
}

// ─── YAML EDITOR (Monaco Editor) ─────────────────────────────────

function YamlEditor({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <MonacoEditor
      height="70vh"
      language="yaml"
      value={value}
      onChange={(v) => onChange(v || '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'ui-monospace', 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        tabSize: 2,
        renderWhitespace: 'none',
        bracketPairColorization: { enabled: true },
        padding: { top: 12 },
      }}
    />
  );
}

function YamlLine({ line }: { line: string }) {
  const trimmed = line.trim();

  // Empty line
  if (!trimmed) return <span>{'\n'}</span>;

  // Comment
  if (trimmed.startsWith('#')) {
    return <span className="text-gray-500">{line}{'\n'}</span>;
  }

  // Document separator
  if (trimmed === '---') {
    return <span className="text-gray-600">{line}{'\n'}</span>;
  }

  // Parse the line into parts
  const parts: JSX.Element[] = [];
  let remaining = line;
  let keyIndex = 0;

  // Process the line character by character / token by token
  // Split on colon for key-value pairs
  const colonIdx = trimmed.indexOf(':');

  if (colonIdx > 0 && !trimmed.startsWith('-')) {
    // Key-value pair
    const key = trimmed.substring(0, colonIdx);
    const afterColon = trimmed.substring(colonIdx + 1);

    const isModule = key.includes('ansible.');
    const isSpecialKey = ['become', 'connection', 'hosts', 'gather_subset', 'state', 'mode', 'register', 'changed_when', 'ignore_errors', 'delegate_to', 'local_action', 'args', 'vars', 'environment'].includes(key.trim());

    if (isModule) {
      parts.push(<span key={keyIndex++} className="text-rose-400">{key}</span>);
    } else if (isSpecialKey) {
      parts.push(<span key={keyIndex++} className="text-violet-400">{key}</span>);
    } else {
      parts.push(<span key={keyIndex++} className="text-sky-400">{key}</span>);
    }
    parts.push(<span key={keyIndex++} className="text-sky-400">:</span>);

    // Highlight the value part
    const valuePart = highlightValue(afterColon);
    parts.push(<span key={keyIndex++}>{valuePart}</span>);
  } else if (trimmed.startsWith('- name:')) {
    // Task name
    const match = trimmed.match(/^- name:\s*(.*)/);
    parts.push(<span key={keyIndex++} className="text-sky-300">-</span>);
    parts.push(<span key={keyIndex++} className="text-sky-400"> name:</span>);
    if (match && match[1]) {
      parts.push(<span key={keyIndex++} className="text-emerald-300">{highlightValue(' ' + match[1])}</span>);
    }
  } else if (trimmed.startsWith('- ')) {
    // List item
    const afterDash = trimmed.substring(2);
    const innerColon = afterDash.indexOf(':');
    if (innerColon > 0) {
      const innerKey = afterDash.substring(0, innerColon);
      const innerVal = afterDash.substring(innerColon + 1);
      const isMod = innerKey.includes('ansible.');
      parts.push(<span key={keyIndex++} className="text-sky-300">-</span>);
      parts.push(<span key={keyIndex++}> </span>);
      if (isMod) {
        parts.push(<span key={keyIndex++} className="text-rose-400">{innerKey}</span>);
      } else {
        parts.push(<span key={keyIndex++} className="text-sky-400">{innerKey}</span>);
      }
      parts.push(<span key={keyIndex++} className="text-sky-400">:</span>);
      parts.push(<span key={keyIndex++}>{highlightValue(innerVal)}</span>);
    } else {
      parts.push(<span key={keyIndex++} className="text-sky-300">-</span>);
      parts.push(<span key={keyIndex++}>{highlightValue(' ' + afterDash)}</span>);
    }
  } else {
    parts.push(<span key={keyIndex++}>{highlightValue(line)}</span>);
  }

  return <>{parts}{'\n'}</>;
}

function highlightValue(text: string): (string | JSX.Element)[] {
  if (!text) return [];

  const result: (string | JSX.Element)[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    // Check for Jinja2 {{ }}
    const jinjaStart = remaining.indexOf('{{');
    if (jinjaStart >= 0) {
      if (jinjaStart > 0) {
        // Text before jinja
        const before = remaining.substring(0, jinjaStart);
        result.push(...highlightStrings(before));
      }
      const jinjaEnd = remaining.indexOf('}}', jinjaStart);
      if (jinjaEnd >= 0) {
        const jinjaContent = remaining.substring(jinjaStart, jinjaEnd + 2);
        result.push(<span key={idx++} className="text-amber-300">{jinjaContent}</span>);
        remaining = remaining.substring(jinjaEnd + 2);
      } else {
        result.push(...highlightStrings(remaining));
        remaining = '';
      }
    } else {
      result.push(...highlightStrings(remaining));
      remaining = '';
    }
  }

  return result;
}

function highlightStrings(text: string): (string | JSX.Element)[] {
  // Highlight quoted strings with green, booleans with orange
  const result: (string | JSX.Element)[] = [];
  const regex = /("([^"]*)")/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.substring(lastIndex, match.index);
      // Check for bare booleans/numbers
      const bare = before.trim();
      if (bare === 'true' || bare === 'false' || bare === 'yes' || bare === 'no') {
        result.push(<span key={Math.random()} className="text-orange-400">{bare}</span>);
      } else if (/^\d+$/.test(bare)) {
        result.push(<span key={Math.random()} className="text-orange-300">{bare}</span>);
      } else if (before) {
        result.push(before);
      }
    }
    result.push(<span key={Math.random()} className="text-emerald-300">{match[0]}</span>);
    lastIndex = regex.lastIndex;
  }

  const tail = text.substring(lastIndex);
  if (tail) {
    const trimmed = tail.trim();
    if (trimmed === 'true' || trimmed === 'false' || trimmed === 'yes' || trimmed === 'no') {
      result.push(<span key={Math.random()} className="text-orange-400">{trimmed}</span>);
    } else if (/^\d+$/.test(trimmed)) {
      result.push(<span key={Math.random()} className="text-orange-300">{trimmed}</span>);
    } else {
      result.push(tail);
    }
  }

  return result;
}

// ─── DASHBOARD VIEW ─────────────────────────────────────────────────

function DashboardView({
  playbooks, executions, facts, onTabChange, loading,
}: {
  playbooks: Playbook[];
  executions: Execution[];
  facts: Facts | null;
  onTabChange: (tab: string) => void;
  loading: boolean;
}) {
  if (loading) return <DashboardSkeleton />;

  const successCount = executions.filter(e => e.status === 'success').length;
  const failedCount = executions.filter(e => e.status === 'failed').length;
  const recentExecutions = executions.slice(0, 5);

  const ramUsed = facts ? (facts.memreal?.used ?? facts.memtotal_mb - facts.memfree_mb) : 0;
  const ramTotal = facts ? (facts.memreal?.total ?? facts.memtotal_mb) : 1;
  const ramPercent = Math.round((ramUsed / ramTotal) * 100);

  const stats = [
    { title: 'Playbooks', value: playbooks.length, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { title: 'Exitosos', value: successCount, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
    { title: 'Fallidos', value: failedCount, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    { title: 'Ejecuciones', value: executions.length, icon: Activity, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
  ];

  return (
    <motion.div className="space-y-6" variants={fadeIn} initial="hidden" animate="visible">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.title} custom={i} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`border ${stat.border} hover:shadow-md transition-shadow duration-200`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold tracking-tight"><AnimatedNumber value={stat.value} /></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* System Info + Recent Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* System Info */}
        <motion.div className="lg:col-span-3" custom={4} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Server className="h-4 w-4 text-emerald-600" />
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {facts ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    { label: 'Hostname', value: facts.hostname, icon: Monitor },
                    { label: 'Sistema', value: `${facts.distribution} ${facts.distribution_version}`, icon: Globe },
                    { label: 'Kernel', value: facts.kernel, icon: Cpu },
                    { label: 'Arquitectura', value: facts.architecture, icon: Layers },
                    { label: 'CPU Cores', value: String(facts.processor_vcpus), icon: CpuIcon },
                    { label: 'Uptime', value: formatUptime(facts.uptime_seconds), icon: Timer },
                    { label: 'Python', value: facts.python_version, icon: Sparkles },
                    { label: 'Virtualización', value: facts.virtualization_type || 'N/A', icon: Boxes },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <item.icon className="h-3.5 w-3.5 opacity-50" />
                        {item.label}
                      </span>
                      <span className="font-medium truncate">{item.value}</span>
                    </div>
                  ))}

                  {/* RAM Usage Bar */}
                  <div className="col-span-1 sm:col-span-2 mt-1">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <MemoryStick className="h-3.5 w-3.5 opacity-50" />
                        Memoria RAM
                      </span>
                      <span className="font-medium text-xs">
                        {(facts.memreal?.used ?? (facts.memtotal_mb - facts.memfree_mb)).toFixed(0)} / {ramTotal.toFixed(0)} MB ({ramPercent}%)
                      </span>
                    </div>
                    <Progress value={ramPercent} className="h-2" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando información del sistema...
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Executions */}
        <motion.div className="lg:col-span-2" custom={5} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-600" />
                  Ejecuciones Recientes
                </span>
                {executions.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => onTabChange('executions')}>
                    Ver todas <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentExecutions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                  <Clock className="h-10 w-10 mb-3 opacity-30" />
                  <p className="font-medium">Sin ejecuciones registradas</p>
                  <p className="text-xs mt-1 opacity-70">Ejecuta un playbook para ver el historial</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[280px] pr-1">
                  <div className="space-y-2">
                    {recentExecutions.map((exec) => {
                      const cfg = getStatusConfig(exec.status);
                      return (
                        <motion.div
                          key={exec.id}
                          className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`} />
                            <span className="truncate font-mono text-xs">{exec.playbook}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(exec.startTime), { addSuffix: true, locale: es })}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="border-dashed">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground mb-3">Acciones Rápidas</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => onTabChange('playbooks')}>
                <Plus className="h-4 w-4" />
                Nuevo Playbook
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => onTabChange('templates')}>
                <Zap className="h-4 w-4" />
                Ver Plantillas
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => onTabChange('modules')}>
                <Package className="h-4 w-4" />
                Explorar Módulos
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── INVENTORY VIEW ───────────────────────────────────────────────

function InventoryView() {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hosts, setHosts] = useState<InventoryHost[]>([]);
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchInventory()
      .then((data) => {
        setContent(data.content);
        setOriginalContent(data.content);
        setHosts(data.hosts);
        setGroups(data.groups);
        setHasChanges(false);
      })
      .catch(() => {
        toast.error('Error al cargar el inventario');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== originalContent);
  }, [originalContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ansible/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setOriginalContent(data.content);
        setContent(data.content);
        setHosts(data.hosts);
        setGroups(data.groups);
        setHasChanges(false);
        toast.success('Inventario guardado correctamente');
      } else {
        toast.error('Error al guardar el inventario');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-[70vh] w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-5" variants={fadeIn} initial="hidden" animate="visible">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Inventario</h2>
          <p className="text-sm text-muted-foreground">
            {hosts.length} host{hosts.length !== 1 ? 's' : ''} configurado{hosts.length !== 1 ? 's' : ''} · {groups.length} grupo{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Sin guardar
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            disabled={saving}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-emerald-600" />
            inventory.ini
          </CardTitle>
          <CardDescription className="text-xs">
            Archivo de inventario de Ansible (INI)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-xl overflow-hidden border-t">
            <MonacoEditor
              height="50vh"
              language="ini"
              value={content}
              onChange={(v) => handleContentChange(v || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'ui-monospace', 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                tabSize: 2,
                renderWhitespace: 'none',
                bracketPairColorization: { enabled: true },
                padding: { top: 12 },
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parsed Hosts */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-emerald-600" />
          Hosts Detectados
        </h3>
        {hosts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Server className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No se detectaron hosts</p>
              <p className="text-xs mt-1 opacity-70">Añade hosts al archivo INI para verlos aquí</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hosts.map((host, i) => (
              <motion.div key={`host-${i}`} custom={i} variants={cardVariants} initial="hidden" animate="visible">
                <Card className="hover:shadow-md hover:border-emerald-200 transition-all duration-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-50">
                        <Server className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{host.name}</p>
                        <p className="text-[11px] text-muted-foreground">Host</p>
                      </div>
                    </div>
                    {Object.keys(host.vars).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(host.vars).map(([key, val]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-[10px] font-mono bg-sky-50 text-sky-700 border-sky-200"
                          >
                            {key}={val}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            Grupos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group, i) => (
              <motion.div key={group.name} custom={i} variants={cardVariants} initial="hidden" animate="visible">
                <Card className="hover:shadow-md transition-all duration-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-violet-50">
                        <Layers className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{group.name}</p>
                        <p className="text-[11px] text-muted-foreground">{group.hosts.length} host{group.hosts.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.hosts.map((h) => (
                        <Badge
                          key={h}
                          variant="outline"
                          className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── PLAYBOOKS VIEW ─────────────────────────────────────────────────

function PlaybooksView({ playbooks, onRefresh, loading, onCreateNew }: {
  playbooks: Playbook[];
  onRefresh: () => void;
  loading: boolean;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newContent, setNewContent] = useState('');

  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [viewContent, setViewContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const hasUnsavedChanges = editContent !== '' && editContent !== originalContent;
  const [runPlaybookName, setRunPlaybookName] = useState('');
  const [deletePlaybookName, setDeletePlaybookName] = useState('');

  const logRef = useRef<HTMLDivElement>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<'running' | 'success' | 'failed'>('running');
  const [runLog, setRunLog] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-scroll run log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [runLog]);

  const filteredPlaybooks = useMemo(() => {
    if (!search.trim()) return playbooks;
    const q = search.toLowerCase();
    return playbooks.filter(pb =>
      pb.displayName.toLowerCase().includes(q) ||
      pb.name.toLowerCase().includes(q) ||
      pb.description.toLowerCase().includes(q)
    );
  }, [playbooks, search]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/ansible/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), content: newContent }),
      });
      if (res.ok) {
        toast.success('Playbook creado exitosamente');
        setCreateOpen(false);
        setNewName('');
        setNewDesc('');
        setNewContent('');
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al crear el playbook');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!selectedPlaybook || !editContent) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ansible/playbooks/${encodeURIComponent(selectedPlaybook.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        toast.success('Playbook actualizado');
        setOriginalContent(editContent);
        setEditingPlaybook(null);
        onRefresh();
      } else {
        toast.error('Error al actualizar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deletePlaybookName) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ansible/playbooks/${encodeURIComponent(deletePlaybookName)}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Playbook eliminado');
        setDeleteOpen(false);
        setDeletePlaybookName('');
        onRefresh();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setSubmitting(false);
  };

  const handleRun = async (playbookName?: string) => {
    const name = playbookName || runPlaybookName;
    if (!name) return;
    setIsRunning(true);
    setRunStatus('running');
    setRunLog('');

    const abortController = new AbortController();
    runAbortRef.current = abortController;

    try {
      const res = await fetch(`/api/ansible/playbooks/${encodeURIComponent(name)}/run`, {
        method: 'POST',
        signal: abortController.signal,
      });
      if (!res.ok) throw new Error('Failed to run playbook');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'complete') {
              setRunStatus(event.status === 'success' ? 'success' : 'failed');
            } else {
              accumulated += (event.text || '') + '\n';
              setRunLog(accumulated);
            }
          } catch { /* skip malformed */ }
        }
      }

      toast.success('Playbook ejecutado correctamente');
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        toast('Ejecución cancelada', { description: 'El playbook fue detenido por el usuario' });
        setRunStatus('failed');
      } else {
        setRunStatus('failed');
        toast.error('Error en la ejecución');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const openView = (pb: Playbook) => {
    setSelectedPlaybook(pb);
    setViewContent('Cargando...');
    fetch(`/api/ansible/playbooks/${encodeURIComponent(pb.name)}`)
      .then(res => res.json())
      .then(data => { setViewContent(data.content); setViewOpen(true); })
      .catch(() => { setViewContent('Error al cargar el contenido'); setViewOpen(true); });
  };

  const openEdit = (pb: Playbook) => {
    setSelectedPlaybook(pb);
    setEditContent('Cargando...');
    fetch(`/api/ansible/playbooks/${encodeURIComponent(pb.name)}`)
      .then(res => res.json())
      .then(data => { setEditContent(data.content); setOriginalContent(data.content); setEditingPlaybook(pb); })
      .catch(() => { setEditContent('Error al cargar'); setEditingPlaybook(pb); });
  };

  const openRun = (pb: Playbook) => {
    setRunPlaybookName(pb.name);
    setRunStatus('running');
    setIsRunning(false);
    setRunLog('');
    setRunOpen(true);
    setTimeout(() => handleRun(pb.name), 100);
  };

  const openDelete = (pb: Playbook) => {
    setDeletePlaybookName(pb.name);
    setDeleteOpen(true);
  };

  // Expose create trigger
  useEffect(() => {
    if (onCreateNew) {
      // Listen for external create trigger via a custom event
      const handler = () => { setCreateOpen(true); setNewName(''); setNewDesc(''); setNewContent(''); };
      window.addEventListener('playbook:create', handler);
      return () => window.removeEventListener('playbook:create', handler);
    }
  }, [onCreateNew]);

  // Warn on close/navigate when unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmGoBack = () => {
    if (hasUnsavedChanges && !window.confirm('Tienes cambios sin guardar. Perderas los cambios si sales.')) {
      return;
    }
    setEditingPlaybook(null);
  };

  if (loading) return <PlaybooksSkeleton />;

  // Edit mode - full page editor
  if (editingPlaybook) {
    return (
      <motion.div className="space-y-4" variants={fadeIn} initial="hidden" animate="visible">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={confirmGoBack} className="gap-1.5">
              <ArrowUpRight className="h-4 w-4 rotate-180" />
              Volver
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h2 className="text-lg font-bold tracking-tight">{editingPlaybook.displayName}</h2>
              <p className="text-xs text-muted-foreground font-mono">{editingPlaybook.name}</p>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200">
                  <CircleDot className="h-2.5 w-2.5" />
                  Sin guardar
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleEdit} disabled={submitting || !hasUnsavedChanges} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>

        <YamlEditor value={editContent} onChange={setEditContent} />
      </motion.div>
    );
  }

  return (
    <motion.div className="space-y-5" variants={fadeIn} initial="hidden" animate="visible">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Playbooks</h2>
          <p className="text-sm text-muted-foreground">{playbooks.length} playbook{playbooks.length !== 1 ? 's' : ''} disponible{playbooks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar playbook..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-[250px]"
            />
          </div>
          <Button onClick={() => { setCreateOpen(true); setNewName(''); setNewDesc(''); setNewContent(''); }} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* Playbook Grid */}
      {filteredPlaybooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FolderOpen className="h-14 w-14 mb-4 opacity-30" />
            <p className="text-lg font-semibold">{search ? 'Sin resultados' : 'No hay playbooks'}</p>
            <p className="text-sm mt-1 opacity-70">
              {search ? 'Intenta con otro término de búsqueda' : 'Crea uno nuevo o usa una plantilla para empezar'}
            </p>
            {!search && (
              <Button className="mt-4 gap-2" onClick={() => { setCreateOpen(true); setNewName(''); setNewDesc(''); setNewContent(''); }}>
                <Plus className="h-4 w-4" />
                Crear Playbook
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlaybooks.map((pb, i) => (
            <motion.div key={pb.name} custom={i} variants={cardVariants} initial="hidden" animate="visible">
              <Card className="group hover:shadow-lg hover:border-emerald-200 transition-all duration-200 h-full flex flex-col">
                <CardContent className="p-5 flex flex-col flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate group-hover:text-emerald-700 transition-colors">{pb.displayName}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{pb.description}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Hash className="h-2.5 w-2.5 mr-0.5" />
                      {pb.taskCount}
                    </Badge>
                  </div>

                  <div className="mt-auto pt-2">
                    <Separator className="mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-muted-foreground gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(pb.modified), "d MMM yyyy, HH:mm", { locale: es })}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openView(pb)} title="Ver contenido">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(pb)} title="Editar">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => openRun(pb)} title="Ejecutar">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-red-600 hover:bg-red-50" onClick={() => openDelete(pb)} title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setNewName(''); setNewDesc(''); setNewContent(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50"><Plus className="h-4 w-4 text-emerald-600" /></div>
              Nuevo Playbook
            </DialogTitle>
            <DialogDescription>Crea un nuevo playbook de Ansible con nombre, descripción y contenido YAML.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pb-name">Nombre</Label>
                <Input id="pb-name" placeholder="mi-playbook" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-desc">Descripción</Label>
                <Input id="pb-desc" placeholder="Descripción del playbook" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pb-content">Contenido YAML</Label>
              <Textarea
                id="pb-content"
                placeholder={`---\n- name: mi-playbook\n  hosts: localhost\n  connection: local\n  tasks:\n    - name: Tarea de ejemplo\n      ansible.builtin.debug:\n        msg: "Hello World"`}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="font-mono text-sm min-h-[280px] resize-y"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creando...' : 'Crear Playbook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog - FULLSCREEN with syntax highlighting */}
      <Dialog open={viewOpen} onOpenChange={(open) => { if (!open) setSelectedPlaybook(null); }}>
        <DialogContent className="!w-screen !h-screen !max-w-none sm:!max-w-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none flex flex-col !p-0" showCloseButton={false}>
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-50"><FileText className="h-4 w-4 text-sky-600" /></div>
              <div>
                <DialogTitle className="text-base font-semibold">{selectedPlaybook?.displayName || selectedPlaybook?.name}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">{selectedPlaybook?.description}</DialogDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewOpen(false)}>Cerrar</Button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              <YamlHighlight code={viewContent} />
            </div>
          </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run Dialog */}
      <Dialog open={runOpen} onOpenChange={(open) => { if (!open) { setRunPlaybookName(''); setIsRunning(false); runAbortRef.current?.abort(); } }}>
        <DialogContent className="!w-screen !h-screen !max-w-none sm:!max-w-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none flex flex-col !p-0" showCloseButton={false}>
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isRunning ? 'bg-amber-50' : runStatus === 'success' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <Play className={`h-4 w-4 ${isRunning ? 'text-amber-600' : runStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
              <span className="truncate">{runPlaybookName}</span>
              {runStatus !== 'running' && !isRunning && (
                <Badge className={getStatusConfig(runStatus).className}>
                  {getStatusConfig(runStatus).label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <Button variant="ghost" size="sm" onClick={() => setRunOpen(false)}>Cerrar</Button>
          </div>

          <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ejecutando playbook...
              </div>
            )}
            {!isRunning && runStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Ejecución completada exitosamente
              </div>
            )}
            {!isRunning && runStatus === 'failed' && (
              <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                <XCircle className="h-4 w-4" />
                La ejecución falló
              </div>
            )}

            <div className="flex-1 min-h-0">
              <div ref={logRef} className="h-full overflow-y-auto rounded-xl">
                <pre className="bg-gray-950 rounded-xl p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto leading-relaxed min-h-[200px]">
                  {runLog || (isRunning ? '' : 'Esperando ejecución...')}
                  {isRunning && (
                    <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5" />
                  )}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t">
            {isRunning && (
              <Button variant="destructive" size="sm" onClick={() => runAbortRef.current?.abort()} className="gap-1.5">
                <CircleDot className="h-4 w-4" />
                Detener
              </Button>
            )}
            {!isRunning && (
              <Button variant="outline" size="sm" onClick={() => setRunOpen(false)}>Cerrar</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) setDeletePlaybookName(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-50"><AlertCircle className="h-4 w-4 text-red-600" /></div>
              Eliminar Playbook
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Estás seguro de que quieres eliminar <strong className="font-mono">{deletePlaybookName}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── TEMPLATES VIEW ────────────────────────────────────────────────

function TemplatesView({ onRefresh }: { onRefresh: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [useOpen, setUseOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [viewContent, setViewContent] = useState('');
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchTemplates()
      .then(data => { if (!cancelled) setTemplates(data); })
      .catch(() => { if (!cancelled) toast.error('Error cargando plantillas'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => [...new Set(templates.map(t => t.category))].sort(), [templates]);

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.displayName.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const filteredCategories = useMemo(() =>
    [...new Set(filteredTemplates.map(t => t.category))].sort(),
    [filteredTemplates]
  );

  const handleUse = async () => {
    if (!selectedTemplate || !newName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/ansible/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: selectedTemplate.name, newPlaybookName: newName.trim() }),
      });
      if (res.ok) {
        toast.success(`Plantilla creada como "${newName.trim()}"`);
        setUseOpen(false);
        setSelectedTemplate(null);
        setNewName('');
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al crear la plantilla');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setSubmitting(false);
  };

  const openUse = (tpl: Template) => {
    setSelectedTemplate(tpl);
    setNewName(tpl.displayName);
    setUseOpen(true);
  };

  const openView = (tpl: Template) => {
    setSelectedTemplate(tpl);
    setViewContent('Cargando...');
    setViewOpen(true);
    fetch(`/api/ansible/templates?name=${encodeURIComponent(tpl.name)}`)
      .then(res => res.json())
      .then(data => setViewContent(data.content || 'Contenido no disponible'))
      .catch(() => setViewContent('Error al cargar el contenido'));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-32 mb-3" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Card key={j}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-9 w-full mt-2" /></CardContent></Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-5" variants={fadeIn} initial="hidden" animate="visible">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Plantillas</h2>
          <p className="text-sm text-muted-foreground">{templates.length} plantilla{templates.length !== 1 ? 's' : ''} disponible{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar plantilla..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-[250px]" />
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BookOpen className="h-14 w-14 mb-4 opacity-30" />
            <p className="text-lg font-semibold">{search ? 'Sin resultados' : 'No hay plantillas disponibles'}</p>
            <p className="text-sm mt-1 opacity-70">{search ? 'Intenta con otro término' : 'Las plantillas aparecerán aquí'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredCategories.map((category) => {
            const catColor = getCatColor(category);
            const categoryTemplates = filteredTemplates.filter(t => t.category === category);
            return (
              <div key={category}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-2 h-2 rounded-full ${catColor.dot}`} />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{category}</h3>
                  <Badge variant="outline" className="text-[10px]">{categoryTemplates.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryTemplates.map((tpl, i) => (
                    <motion.div key={tpl.name} custom={i} variants={cardVariants} initial="hidden" animate="visible">
                      <Card className="group hover:shadow-lg transition-all duration-200 h-full">
                        <CardContent className="p-5 space-y-3 flex flex-col h-full">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="outline" className={`${catColor.bg} ${catColor.text} ${catColor.border} text-[10px] font-medium shrink-0`}>
                              {tpl.category}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-medium bg-muted">
                              <Hash className="h-2.5 w-2.5 mr-0.5" />
                              {tpl.taskCount}
                            </Badge>
                          </div>
                          <h4 className="font-semibold text-sm group-hover:text-emerald-700 transition-colors">{tpl.displayName}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">{tpl.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              onClick={() => openUse(tpl)}
                            >
                              <ClipboardCopy className="h-3.5 w-3.5" />
                              Usar Plantilla
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openView(tpl)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Codigo
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Use Template Dialog */}
      <Dialog open={useOpen} onOpenChange={(open) => { if (!open) { setSelectedTemplate(null); setNewName(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-50"><ClipboardCopy className="h-4 w-4 text-violet-600" /></div>
              Usar Plantilla
            </DialogTitle>
            <DialogDescription>
              Se creará un nuevo playbook basado en <strong>{selectedTemplate?.displayName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="tpl-name">Nombre del nuevo playbook</Label>
            <Input id="tpl-name" placeholder={selectedTemplate?.displayName} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setUseOpen(false)}>Cancelar</Button>
            <Button onClick={handleUse} disabled={!newName.trim() || submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creando...' : 'Crear desde Plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Code Dialog - FULLSCREEN */}
      <Dialog open={viewOpen} onOpenChange={(open) => { if (!open) { setSelectedTemplate(null); setViewContent(''); } }}>
        <DialogContent className="!w-screen !h-screen !max-w-none sm:!max-w-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none flex flex-col !p-0" showCloseButton={false}>
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-50"><BookOpen className="h-4 w-4 text-violet-600" /></div>
              <div>
                <DialogTitle className="text-base font-semibold">{selectedTemplate?.displayName || selectedTemplate?.name}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">{selectedTemplate?.description}</DialogDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewOpen(false)}>Cerrar</Button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              <YamlHighlight code={viewContent} />
            </div>
          </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── MODULES VIEW ───────────────────────────────────────────────────

function ModulesView() {
  const [modules, setModules] = useState<AnsibleModule[]>([]);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModules()
      .then(data => { if (!cancelled) { setModules(data.modules); setTotal(data.total); setCollections(data.collections || []); } })
      .catch(() => { if (!cancelled) toast.error('Error cargando módulos'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredModules = useMemo(() => {
    let result = modules;
    if (activeCategory) {
      result = result.filter(m => m.collection === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.shortName.toLowerCase().includes(q) ||
        m.collection.toLowerCase().includes(q)
      );
    }
    return result;
  }, [modules, activeCategory, search]);

  if (loading) return <ModulesSkeleton />;

  return (
    <motion.div className="space-y-5" variants={fadeIn} initial="hidden" animate="visible">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Módulos de Ansible</h2>
          <p className="text-sm text-muted-foreground">{total} módulos en {collections.length} colecciones · Mostrando {filteredModules.length}</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar módulo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-[280px]" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!activeCategory ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs rounded-full gap-1.5"
          onClick={() => setActiveCategory(null)}
        >
          <Layers className="h-3 w-3" />
          Todos
        </Button>
        {collections.slice(0, 15).map((col, idx) => {
          const colColor = getCollectionColor(idx);
          return (
            <Button
              key={col.name}
              variant={activeCategory === col.name ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs rounded-full gap-1.5 transition-colors ${activeCategory === col.name ? '' : `${colColor.bg} ${colColor.text} ${colColor.border}`}`}
              onClick={() => setActiveCategory(activeCategory === col.name ? null : col.name)}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeCategory === col.name ? 'bg-white' : colColor.dot}`} />
              {col.name.split('.').pop()}
              <span className="opacity-60">{col.count}</span>
            </Button>
          );
        })}
      </div>

      {/* Modules List */}
      {filteredModules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="h-14 w-14 mb-4 opacity-30" />
            <p className="text-lg font-semibold">Sin resultados</p>
            <p className="text-sm mt-1 opacity-70">No se encontraron módulos con los filtros actuales</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filteredModules.slice(0, 100).map((mod, i) => {
            const colIdx = collections.findIndex(c => c.name === mod.collection);
            const colColor = getCollectionColor(colIdx >= 0 ? colIdx : 0);
            return (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.008, 0.4), duration: 0.12 }}
              >
                <Card className="hover:shadow-sm transition-all duration-150 py-0">
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className={`w-1 h-8 rounded-full shrink-0 ${colColor.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold truncate">{mod.shortName}</span>
                        <Badge variant="outline" className={`text-[10px] ${colColor.bg} ${colColor.text} ${colColor.border} hidden sm:inline-flex`}>
                          {mod.collection}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {filteredModules.length > 100 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Mostrando 100 de {filteredModules.length} módulos. Usa el buscador para filtrar.
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── EXECUTIONS VIEW ────────────────────────────────────────────────

function ExecutionsView({ executions, onRefresh, loading }: { executions: Execution[]; onRefresh: () => void; loading: boolean }) {
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null);
  const [execLog, setExecLog] = useState('');
  const [loadingLog, setLoadingLog] = useState(true);
  const [search, setSearch] = useState('');

  const filteredExecutions = useMemo(() => {
    if (!search.trim()) return executions;
    const q = search.toLowerCase();
    return executions.filter(e => e.playbook.toLowerCase().includes(q));
  }, [executions, search]);

  const openView = async (exec: Execution) => {
    setSelectedExec(exec);
    setLoadingLog(true);
    setExecLog('');
    setViewOpen(true);
    try {
      const res = await fetch(`/api/ansible/executions/${exec.id}`);
      const data = await res.json();
      setExecLog(data.log || 'Log no disponible');
    } catch {
      setExecLog('Error al cargar el log');
    }
    setLoadingLog(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Card><CardContent className="p-0 space-y-0">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /><Skeleton className="h-7 w-16" /></div>)}</CardContent></Card>
      </div>
    );
  }

  return (
    <motion.div className="space-y-5" variants={fadeIn} initial="hidden" animate="visible">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Ejecuciones</h2>
          <p className="text-sm text-muted-foreground">{executions.length} ejecución{executions.length !== 1 ? 'es' : ''} registrada{executions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full sm:w-[200px]" />
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {filteredExecutions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <History className="h-14 w-14 mb-4 opacity-30" />
            <p className="text-lg font-semibold">{search ? 'Sin resultados' : 'Sin ejecuciones'}</p>
            <p className="text-sm mt-1 opacity-70">{search ? 'Intenta con otro término' : 'Los resultados aparecerán aquí tras ejecutar un playbook'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">Playbook</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Inicio</TableHead>
                  <TableHead className="font-semibold">Duración</TableHead>
                  <TableHead className="font-semibold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExecutions.map((exec) => {
                  const cfg = getStatusConfig(exec.status);
                  return (
                    <TableRow key={exec.id} className="group">
                      <TableCell className="font-mono text-xs">{exec.playbook}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${cfg.className} text-[10px] gap-1`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                        {format(new Date(exec.startTime), "d MMM yyyy, HH:mm:ss", { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{formatDuration(exec.duration)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1.5 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => openView(exec)}
                        >
                          <Terminal className="h-3 w-3" />
                          Ver Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Log Viewer Dialog - FULLSCREEN */}
      <Dialog open={viewOpen} onOpenChange={(open) => { if (!open) { setSelectedExec(null); setExecLog(''); } }}>
        <DialogContent className="!w-screen !h-screen !max-w-none sm:!max-w-none !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none flex flex-col !p-0" showCloseButton={false}>
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-800"><SquareTerminal className="h-4 w-4 text-gray-200" /></div>
              <span className="truncate">{selectedExec?.playbook}</span>
              {selectedExec && (
                <Badge variant="outline" className={`${getStatusConfig(selectedExec.status).className} text-[10px] gap-1`}>
                  {getStatusConfig(selectedExec.status).label}
                </Badge>
              )}
            </DialogTitle>
            {selectedExec && (
              <DialogDescription>
                Iniciado: {format(new Date(selectedExec.startTime), "d MMM yyyy, HH:mm:ss", { locale: es })}
                {selectedExec.duration && ` · Duración: ${formatDuration(selectedExec.duration)}`}
              </DialogDescription>
            )}
          </DialogHeader>
          <Button variant="ghost" size="sm" onClick={() => setViewOpen(false)}>Cerrar</Button>
          </div>

          <div className="flex-1 min-h-0 p-4">
            {loadingLog ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-full flex-1 rounded-xl">
                <pre className="bg-gray-950 text-gray-300 rounded-xl p-5 font-mono text-xs whitespace-pre-wrap overflow-x-auto leading-relaxed min-h-[200px]">
                  {execLog}
                </pre>
              </ScrollArea>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setViewOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────

export default function AnsibleManagerPage() {
  const [tab, setTab] = useState('dashboard');
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [playbooksLoading, setPlaybooksLoading] = useState(true);
  const [executionsLoading, setExecutionsLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshPlaybooks = useCallback(() => {
    setPlaybooksLoading(true);
    fetchPlaybooks()
      .then(setPlaybooks)
      .catch(() => toast.error('Error cargando playbooks'))
      .finally(() => setPlaybooksLoading(false));
  }, []);

  const refreshExecutions = useCallback(() => {
    setExecutionsLoading(true);
    fetchExecutions()
      .then(setExecutions)
      .catch(() => toast.error('Error cargando ejecuciones'))
      .finally(() => setExecutionsLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetchFacts().then(setFacts).catch(() => setFacts(null)),
      fetchPlaybooks().then(setPlaybooks).catch(() => toast.error('Error cargando playbooks')),
      fetchExecutions().then(setExecutions).catch(() => toast.error('Error cargando ejecuciones')),
    ]).finally(() => {
      setPlaybooksLoading(false);
      setExecutionsLoading(false);
      setInitialLoading(false);
    });
  }, []);

  const handleTabChange = useCallback((newTab: string) => {
    setTab(newTab);
    if (newTab === 'playbooks') refreshPlaybooks();
    if (newTab === 'executions') refreshExecutions();
  }, [refreshPlaybooks, refreshExecutions]);

  const handleCreateNew = useCallback(() => {
    setTab('playbooks');
    // Small delay to let the tab switch render, then dispatch event
    setTimeout(() => window.dispatchEvent(new CustomEvent('playbook:create')), 100);
  }, []);

  const isLoading = initialLoading;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-14 items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-600 shadow-sm shadow-emerald-200">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight leading-none">ExecOps</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gestión de playbooks y automatización</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5">
        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start bg-white border rounded-xl p-1 h-auto shadow-sm">
            <TabsTrigger
              value="dashboard"
              className="gap-1.5 rounded-lg data-[state=selected]:bg-emerald-50 data-[state=selected]:text-emerald-700 data-[state=selected]:shadow-sm px-3 py-2 text-muted-foreground data-[state=hover]:text-foreground transition-all"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger
              value="playbooks"
              className="gap-1.5 rounded-lg data-[state=selected]:bg-emerald-50 data-[state=selected]:text-emerald-700 data-[state=selected]:shadow-sm px-3 py-2 text-muted-foreground data-[state=hover]:text-foreground transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Playbooks</span>
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="gap-1.5 rounded-lg data-[state=selected]:bg-emerald-50 data-[state=selected]:text-emerald-700 data-[state=selected]:shadow-sm px-3 py-2 text-muted-foreground data-[state=hover]:text-foreground transition-all"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Inventario</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="gap-1.5 rounded-lg data-[state=selected]:bg-emerald-50 data-[state=selected]:text-emerald-700 data-[state=selected]:shadow-sm px-3 py-2 text-muted-foreground data-[state=hover]:text-foreground transition-all"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Plantillas</span>
            </TabsTrigger>
            <TabsTrigger
              value="modules"
              className="gap-1.5 rounded-lg data-[state=selected]:bg-emerald-50 data-[state=selected]:text-emerald-700 data-[state=selected]:shadow-sm px-3 py-2 text-muted-foreground data-[state=hover]:text-foreground transition-all"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Módulos</span>
            </TabsTrigger>
            <TabsTrigger
              value="executions"
              className="gap-1.5 rounded-lg data-[state=selected]:bg-emerald-50 data-[state=selected]:text-emerald-700 data-[state=selected]:shadow-sm px-3 py-2 text-muted-foreground data-[state=hover]:text-foreground transition-all"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Ejecuciones</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-5">
            {tab === 'dashboard' && (
              <DashboardView
                playbooks={playbooks}
                executions={executions}
                facts={facts}
                onTabChange={handleTabChange}
                loading={isLoading}
              />
            )}
            {tab === 'playbooks' && (
              <PlaybooksView
                playbooks={playbooks}
                onRefresh={refreshPlaybooks}
                loading={playbooksLoading}
                onCreateNew={handleCreateNew}
              />
            )}
            {tab === 'inventory' && (
              <InventoryView />
            )}
            {tab === 'templates' && (
              <TemplatesView onRefresh={refreshPlaybooks} />
            )}
            {tab === 'modules' && (
              <ModulesView />
            )}
            {tab === 'executions' && (
              <ExecutionsView executions={executions} onRefresh={refreshExecutions} loading={executionsLoading} />
            )}
          </div>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/80 backdrop-blur-md py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>ExecOps v0.01a</span>
          </div>
          <div className="flex items-center gap-3">
            {facts && (
              <>
                <span className="hidden sm:inline">Ansible Core {facts.ansible_version}</span>
                <span className="hidden md:inline">·</span>
                <span className="hidden sm:inline">{facts.distribution} {facts.distribution_version}</span>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
