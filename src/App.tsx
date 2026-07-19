import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import Scheduler from './components/Scheduler';
import TargetEditor from './components/TargetEditor';
import TemplatesModal from './components/TemplatesModal';
import { EditShiftPopover, AddShiftModal } from './components/Modals';
import ConfirmDialog, { ConfirmOptions } from './components/ConfirmDialog';
import { Shift, Template } from './types/index';
import { INITIAL_SHIFTS, DEFAULT_TARGETS } from './lib/defaults';
import { decimalFromTimeInput, roundHalf } from './lib/utils';
import { computeHourlyCoverage, summarizeCoverage } from './lib/coverage';
import { getLaborRate } from './lib/rates';
import { nextShiftId } from './lib/shiftIds';
import { ZoomIn, ZoomOut, Maximize, Trash2, Copy, Clock, DollarSign, Award } from 'lucide-react';

// Recharts is the largest client chunk; load the chart on demand.
const CoverageChart = lazy(() => import('./components/CoverageChart'));

const SHIFTS_STORAGE_KEY = 'shiftsync.opus.shifts.v2';
const DARK_MODE_STORAGE_KEY = 'shiftsync.opus.darkmode.v1';
const TEMPLATES_STORAGE_KEY = 'shiftsync.opus.templates.v2';

function isValidShift(s: unknown): s is Shift {
  if (!s || typeof s !== 'object') return false;
  const v = s as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.role === 'string' &&
    (v.type === 'FT' || v.type === 'PT') &&
    typeof v.start === 'number' &&
    typeof v.duration === 'number'
  );
}

function isValidTemplate(t: unknown): t is Template {
  if (!t || typeof t !== 'object') return false;
  const v = t as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.shifts) &&
    v.shifts.every(isValidShift) &&
    Array.isArray(v.targets) &&
    v.targets.every(n => typeof n === 'number')
  );
}

function loadStoredShifts(): Shift[] {
  try {
    const stored = localStorage.getItem(SHIFTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every(isValidShift)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load stored shifts; using defaults.', e);
  }
  return INITIAL_SHIFTS;
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem(DARK_MODE_STORAGE_KEY);
      if (stored !== null) {
        return JSON.parse(stored) === true;
      }
    } catch (e) {
      console.warn('Failed to load dark mode preference.', e);
    }
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem(DARK_MODE_STORAGE_KEY, JSON.stringify(isDarkMode));
    } catch (e) {
      console.warn('Failed to persist dark mode preference.', e);
    }
  }, [isDarkMode]);

  const [shifts, setShifts] = useState<Shift[]>(loadStoredShifts);
  const [targets, setTargets] = useState<number[]>(DEFAULT_TARGETS);

  // Persist the roster so a reload keeps the user's shifts.
  useEffect(() => {
    try {
      localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
    } catch (e) {
      console.warn('Failed to persist shifts.', e);
    }
  }, [shifts]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(() => {
    try {
      const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every(isValidTemplate)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load stored templates; starting empty.', e);
    }
    return [];
  });
  
  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {}
  }, [templates]);
  
  // Local storage persistence for targets
  useEffect(() => {
    try {
      const stored = localStorage.getItem('shiftsync.opus.targets.v2');
      if (stored) {
        const p = JSON.parse(stored);
        if (Array.isArray(p) && p.length === DEFAULT_TARGETS.length) {
          setTargets(p);
        }
      }
    } catch (e) {}
  }, []);

  const updateTargets = (newTargets: number[]) => {
    setTargets(newTargets);
    try { localStorage.setItem('shiftsync.opus.targets.v2', JSON.stringify(newTargets)); } catch(e) {}
  };

  // Zoom control
  const [zoomLevel, setZoomLevel] = useState(1);
  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(4, Math.max(0.5, prev + delta)));
  };

  // Popover state
  const [popoverState, setPopoverState] = useState<{ shift: Shift | null; position: { x: number; y: number } | null }>({ shift: null, position: null });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<Shift | null>(null);

  // Confirmation dialog for destructive actions
  const [confirmState, setConfirmState] = useState<{ options: ConfirmOptions; onConfirm: () => void } | null>(null);
  const requestConfirm = (options: ConfirmOptions, onConfirm: () => void) => {
    setConfirmState({ options, onConfirm });
  };

  // Shift operations
  const handleUpdateShift = (updatedShift: Shift) => {
    setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
  };

  const handleSwapShifts = (id1: string, id2: string) => {
    setShifts(prev => {
      const next = [...prev];
      const i1 = next.findIndex(s => s.id === id1);
      const i2 = next.findIndex(s => s.id === id2);
      if (i1 === -1 || i2 === -1) return prev;
      
      const s1 = next[i1];
      const s2 = next[i2];
      
      next[i1] = { ...s1, start: s2.start, duration: s2.duration, meal: s2.meal };
      next[i2] = { ...s2, start: s1.start, duration: s1.duration, meal: s1.meal };
      return next;
    });
  };

  const handleDeleteShift = (id: string) => {
    setShifts(prev => prev.filter(s => s.id !== id));
    setSelectedShiftIds(prev => prev.filter(selectedId => selectedId !== id));
    setPopoverState({ shift: null, position: null });
  };

  const handleDuplicate = (shift: Shift) => {
    setPopoverState({ shift: null, position: null });
    setDuplicateData(shift);
    setIsAddModalOpen(true);
  };

  const handleToggleSelectResult = (id: string) => {
    setSelectedShiftIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = (selectAll: boolean) => {
    setSelectedShiftIds(selectAll ? shifts.map(s => s.id) : []);
  };

  const handleBulkDelete = () => {
    const count = selectedShiftIds.length;
    requestConfirm(
      {
        title: 'Delete selected shifts?',
        message: `This will permanently remove ${count} shift${count === 1 ? '' : 's'} from the roster.`,
        confirmLabel: 'Delete',
      },
      () => {
        setShifts(prev => prev.filter(s => !selectedShiftIds.includes(s.id)));
        setSelectedShiftIds([]);
      }
    );
  };

  const handleBulkDuplicate = () => {
    setShifts(prev => {
       const newShifts = [...prev];
       const shiftsToDuplicate = prev.filter(s => selectedShiftIds.includes(s.id));
       for (const shift of shiftsToDuplicate) {
         newShifts.push({ ...shift, id: nextShiftId(newShifts) });
       }
       return newShifts;
    });
    setSelectedShiftIds([]);
  };

  const handleAddShift = (shiftPartial: Partial<Shift>, lunchProps: { isEnabled: boolean; start: string; duration: number }) => {
    const newShift: Shift = {
      id: nextShiftId(shifts),
      name: shiftPartial.name || '',
      role: shiftPartial.role || '',
      type: shiftPartial.type as 'FT' | 'PT',
      start: shiftPartial.start || 9,
      duration: shiftPartial.duration || 8,
    };

    if (lunchProps.isEnabled) {
      newShift.meal = {
        start: roundHalf(decimalFromTimeInput(lunchProps.start)),
        duration: lunchProps.duration
      };
    }

    setShifts(prev => [...prev, newShift]);
    setIsAddModalOpen(false);
  };

  const handleSaveTemplate = (name: string) => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      name,
      shifts,
      targets
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleLoadTemplate = (template: Template) => {
    setShifts(template.shifts);
    updateTargets(template.targets);
    setIsTemplatesModalOpen(false);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // Shared per-hour coverage, computed once and passed to all consumers.
  const coverage = useMemo(() => computeHourlyCoverage(shifts, targets), [shifts, targets]);

  // Real-time calculated Schedule Metrics for dashboard
  const stats = useMemo(() => {
    const { coverageScore } = summarizeCoverage(coverage);

    const scheduledHours = shifts.reduce((acc, s) => acc + (s.duration - (s.meal?.duration || 0)), 0);
    const laborCost = Math.round(shifts.reduce((acc, s) => {
      const hours = s.duration - (s.meal?.duration || 0);
      return acc + (hours * getLaborRate(s.role));
    }, 0));

    const ftCount = shifts.filter(s => s.type === "FT").length;
    const ptCount = shifts.filter(s => s.type === "PT").length;

    return {
      coverageScore,
      scheduledHours,
      laborCost,
      ftCount,
      ptCount
    };
  }, [shifts, coverage]);

  return (
    <div className="min-h-screen font-sans text-slate-900 bg-slate-50 dark:bg-slate-950 dark:text-slate-100 relative pb-16 transition-colors duration-200">
      <Navbar 
        onAddShift={() => { setDuplicateData(null); setIsAddModalOpen(true); }} 
        onResetData={() => requestConfirm(
          {
            title: 'Reset all data?',
            message: 'This replaces your current roster and targets with the built-in defaults. Saved templates are kept.',
            confirmLabel: 'Reset',
          },
          () => { setShifts(INITIAL_SHIFTS); updateTargets(DEFAULT_TARGETS); }
        )}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-200">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Interactive Master Schedule</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-3xl leading-relaxed">
              Timeline covers <strong className="text-slate-700 dark:text-slate-300">5 a.m. to 10 p.m.</strong> Drag blocks horizontally to change start times. Resize using the right edge grabber. Drag the striped meal segment to reposition lunch. Drop a shift over another row to quickly swap allocations. <strong className="text-slate-700 dark:text-slate-300">Right-click</strong> any shift block for explicit time editing or to duplicate/delete.
            </p>
          </div>
          
          {/* Zoom Toolbar */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0 items-center">
            <button onClick={() => handleZoom(-0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" disabled={zoomLevel <= 0.5}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="px-3 flex flex-col items-center min-w-[70px]">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{Math.round(zoomLevel * 100)}%</span>
            </div>
            <button onClick={() => handleZoom(0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" disabled={zoomLevel >= 4}>
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1.5 ml-2"></div>
            <button onClick={() => setZoomLevel(1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white tooltip">
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Summary Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Adequacy Score */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 transition-colors">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Staffing Adequacy</span>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.coverageScore}%</p>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Staff match against baseline goals</p>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs ${
              stats.coverageScore >= 80 
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300" 
                : stats.coverageScore >= 50 
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-300" 
                  : "bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-300"
            }`}>
              <Award className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Hours Scheduled */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 transition-colors">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Roster Coverage</span>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stats.scheduledHours.toFixed(1)} hrs</p>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{stats.ftCount} FT Ã‚Â· {stats.ptCount} PT associates active</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-300 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Budget Analysis */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 transition-colors">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Estimated Labor Spending</span>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">${stats.laborCost.toLocaleString()}</p>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Estimated based on standard role rates</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300 flex items-center justify-center shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Scheduler Board */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors duration-200">
          <Scheduler 
            shifts={shifts}
            coverage={coverage}
            selectedShiftIds={selectedShiftIds}
            onToggleSelectResult={handleToggleSelectResult}
            onSelectAll={handleSelectAll}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onUpdateShift={handleUpdateShift}
            onSwapShifts={handleSwapShifts}
            onContextMenu={(e, shift) => {
              setPopoverState({ shift, position: { x: e.clientX, y: e.clientY } });
            }}
          />
          <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 p-4 text-xs font-medium text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-8 gap-y-2">
            <span>TOTAL SHIFTS: <strong className="text-slate-900 dark:text-white">{shifts.length}</strong></span>
            <span>SCHEDULED HOURS: <strong className="text-slate-900 dark:text-white">{stats.scheduledHours.toFixed(1)}h</strong></span>
          </div>
        </section>

        {/* Coverage Analytics */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col transition-colors duration-200">
          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Coverage Analytics</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-3xl leading-relaxed">
              Compare actual scheduled <strong className="text-indigo-600 dark:text-indigo-400">associate-hours</strong> (bars) against your <strong className="text-slate-900 dark:text-white">baseline targets</strong> (line). Red bars indicate a deficit, yellow indicates a warning. Edits strictly persist in your local browser storage.
            </p>
          </div>

          <TargetEditor 
            targets={targets}
            onChangeTarget={(idx, val) => {
              const nt = [...targets];
              nt[idx] = val;
              updateTargets(nt);
            }}
            onResetTargets={() => updateTargets(DEFAULT_TARGETS)}
          />

          <Suspense
            fallback={
              <div className="h-64 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                Loading chartâ€¦
              </div>
            }
          >
            <CoverageChart coverage={coverage} isDarkMode={isDarkMode} />
          </Suspense>
        </section>
      </main>

      <EditShiftPopover 
        shift={popoverState.shift}
        position={popoverState.position}
        onClose={() => setPopoverState({ shift: null, position: null })}
        onDelete={handleDeleteShift}
        onDuplicate={handleDuplicate}
        onApply={(id, updates) => {
          setShifts(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
          setPopoverState({ shift: null, position: null });
        }}
      />

      <AddShiftModal 
        isOpen={isAddModalOpen}
        initialData={duplicateData}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddShift}
      />

      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        templates={templates}
        onSave={handleSaveTemplate}
        onLoad={handleLoadTemplate}
        onDelete={(id) => {
          const template = templates.find(t => t.id === id);
          requestConfirm(
            {
              title: 'Delete template?',
              message: `"${template?.name ?? 'This template'}" will be permanently removed.`,
              confirmLabel: 'Delete',
            },
            () => handleDeleteTemplate(id)
          );
        }}
      />

      {selectedShiftIds.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[90%] sm:w-auto bg-slate-900 dark:bg-slate-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-full shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 z-50 border border-transparent dark:border-slate-700">
          <div className="flex items-center gap-3 text-sm font-semibold w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="bg-slate-700 dark:bg-slate-900 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs">
                {selectedShiftIds.length}
              </div>
              <span>shifts selected</span>
            </div>
            <button 
              onClick={() => setSelectedShiftIds([])} 
              className="sm:hidden ml-1 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-300 hover:text-white dark:hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start gap-2 sm:border-l sm:border-slate-700 sm:dark:border-slate-600 sm:pl-6 pt-2 sm:pt-0 border-t border-slate-800 sm:border-t-0">
             <button 
               onClick={handleBulkDuplicate} 
               className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-700 rounded transition-colors"
             >
               <Copy className="w-4 h-4"/> Duplicate
             </button>
             <button 
               onClick={handleBulkDelete} 
               className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-400 dark:text-red-300 hover:bg-slate-800 dark:hover:bg-slate-700 rounded transition-colors"
             >
               <Trash2 className="w-4 h-4"/> Delete
             </button>
             <div className="hidden sm:block w-px h-4 bg-slate-700 dark:bg-slate-600 mx-1"></div>
             <button 
               onClick={() => setSelectedShiftIds([])} 
               className="hidden sm:block ml-1 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-300 hover:text-white dark:hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 rounded transition-colors"
             >
               Cancel
             </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        options={confirmState?.options ?? null}
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
