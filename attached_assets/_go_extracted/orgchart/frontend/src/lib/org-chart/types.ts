export interface OrgChartNode {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  avatarUrl: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentColor: string | null;
  administrationId: number | null;
  administrationName: string | null;
  administrationColor: string | null;
  managerId: number | null;
  nationality: string | null;
  directReports: number;
  isActive: boolean;
  isOpenPosition?: boolean;
  openSinceDate?: string | null;
  isCriticalRole?: boolean;
  isOnLeave?: boolean;
  leaveType?: string | null;
  leaveFrom?: string | null;
  leaveTo?: string | null;
  tags?: { id: number; name: string; color: string }[];
  children: OrgChartNode[];
}

export type ConnectorStyle = "straight" | "angled" | "curved";

export interface DragState {
  draggedId: number | null;
  draggedName: string | null;
  draggedParentId: number | null;
  draggedIndex: number | null;
  dropTargetId: number | null;
  reorderTarget: { parentId: number | null; index: number } | null;
}

export interface BranchVacancy {
  id: number;
  name: string;
  title: string;
  days: number;
}

export interface BranchHeadcount {
  total: number;
  open: number;
  byDept: Array<{ id: number | null; name: string; color: string | null; count: number }>;
  vacancies: BranchVacancy[];
  avgVacantDays: number | null;
}

export type UndoAction =
  | { type: "collapse"; message: string; undoSnapshot: Set<number>; redoSnapshot: Set<number> }
  | { type: "reorder"; message: string; employeeId: number; undoIndex: number; redoIndex: number }
  | {
      type: "move";
      message: string;
      employeeId: number;
      undoManagerId: number | null;
      redoManagerId: number | null;
      undoShowInOrgChart?: boolean;
      redoShowInOrgChart?: boolean;
    };

export interface EditFormData {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  nationality: string;
  administrationId: number | null;
  departmentId: number | null;
  managerId: number | null;
  jobDescription: string;
}

export interface OpenPositionFormData {
  title: string;
  administrationId: number | null;
  departmentId: number | null;
  managerId: number | null;
  jobDescription: string;
}

export interface ChartFormData {
  name: string;
  description: string;
  type: string;
  rootEmployeeId: number | null;
  departmentId: number | null;
}

export interface ExportOptions {
  format: "png" | "jpeg" | "pdf" | "svg";
  pixelRatio: 1 | 2 | 3;
  transparent: boolean;
  pageSize: "A4" | "Letter" | "A3";
  orientation: "portrait" | "landscape";
  margin: number;
  fitMode: "fit" | "multi";
  includeHeader: boolean;
}

export type TFn = (key: string, opts?: Record<string, unknown>) => string;
