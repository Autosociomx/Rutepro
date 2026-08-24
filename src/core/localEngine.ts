import type { ID } from './domain';
import type { LocalOrder, LocalOrderItem, LocalOrderStatus, PrintJob, ProductionTask } from './local';
import { err, ok, type Result } from './result';

export type LocalEngineError =
  | 'ORDER_EMPTY'
  | 'INVALID_STATUS_TRANSITION'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_ITEM'
  | 'TASK_NOT_FOUND'
  | 'PRINT_JOB_NOT_FOUND';

export interface LocalAggregateState {
  order?: LocalOrder;
  tasks: ProductionTask[];
  printJobs: PrintJob[];
}

export interface CreateOrderInput {
  id: ID;
  tenantId: ID;
  businessId: ID;
  locationId: ID;
  tableLabel?: string;
  waiterId?: ID;
  customerId?: ID;
  items: LocalOrderItem[];
  createdAt: number;
}

const allowedTransitions: Record<LocalOrderStatus, LocalOrderStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['paid'],
  paid: [],
  cancelled: [],
};

export const initialLocalState = (): LocalAggregateState => ({ tasks: [], printJobs: [] });

export function createLocalOrder(input: CreateOrderInput): Result<LocalAggregateState, LocalEngineError> {
  if (!input.items.length) return err('ORDER_EMPTY');
  if (input.items.some(item => item.quantity <= 0 || !item.stationId || item.unitPrice.amountCents < 0)) {
    return err('INVALID_ITEM');
  }

  const order: LocalOrder = {
    id: input.id,
    tenantId: input.tenantId,
    businessId: input.businessId,
    locationId: input.locationId,
    tableLabel: input.tableLabel,
    waiterId: input.waiterId,
    customerId: input.customerId,
    status: 'draft',
    items: input.items,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };

  return ok({ order, tasks: [], printJobs: [] });
}

export function transitionOrder(
  state: LocalAggregateState,
  nextStatus: LocalOrderStatus,
  updatedAt: number,
): Result<LocalAggregateState, LocalEngineError> {
  if (!state.order) return err('ORDER_NOT_FOUND');
  if (!allowedTransitions[state.order.status].includes(nextStatus)) {
    return err('INVALID_STATUS_TRANSITION', { from: state.order.status, to: nextStatus });
  }
  return ok({ ...state, order: { ...state.order, status: nextStatus, updatedAt } });
}

export function createProductionTasks(
  state: LocalAggregateState,
  idFactory: () => ID,
): Result<LocalAggregateState, LocalEngineError> {
  if (!state.order) return err('ORDER_NOT_FOUND');

  const stationMap = new Map<ID, number[]>();
  state.order.items.forEach((item, index) => {
    const indexes = stationMap.get(item.stationId) ?? [];
    indexes.push(index);
    stationMap.set(item.stationId, indexes);
  });

  const tasks: ProductionTask[] = [...stationMap.entries()].map(([stationId, itemIndexes]) => ({
    id: idFactory(),
    orderId: state.order!.id,
    stationId,
    itemIndexes,
    status: 'pending',
  }));

  return ok({ ...state, tasks });
}

export function updateProductionTask(
  state: LocalAggregateState,
  taskId: ID,
  status: ProductionTask['status'],
  at: number,
): Result<LocalAggregateState, LocalEngineError> {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return err('TASK_NOT_FOUND');

  const nextTask: ProductionTask = {
    ...task,
    status,
    startedAt: status === 'preparing' && !task.startedAt ? at : task.startedAt,
    completedAt: status === 'ready' ? at : task.completedAt,
  };

  const tasks = state.tasks.map(t => t.id === taskId ? nextTask : t);
  return ok({ ...state, tasks });
}

export function createPrintJobs(
  state: LocalAggregateState,
  printerByStation: Record<ID, ID | undefined>,
  idFactory: () => ID,
  createdAt: number,
): Result<LocalAggregateState, LocalEngineError> {
  if (!state.order) return err('ORDER_NOT_FOUND');

  const printJobs: PrintJob[] = state.tasks.flatMap(task => {
    const printerId = printerByStation[task.stationId];
    if (!printerId) return [];
    return [{
      id: idFactory(),
      businessId: state.order!.businessId,
      printerId,
      orderId: state.order!.id,
      template: 'production' as const,
      status: 'pending' as const,
      attempts: 0,
      createdAt,
    }];
  });

  return ok({ ...state, printJobs });
}

export function markPrintJob(
  state: LocalAggregateState,
  printJobId: ID,
  status: PrintJob['status'],
  at: number,
): Result<LocalAggregateState, LocalEngineError> {
  const printJob = state.printJobs.find(job => job.id === printJobId);
  if (!printJob) return err('PRINT_JOB_NOT_FOUND');

  const printJobs = state.printJobs.map(job => job.id === printJobId
    ? {
        ...job,
        status,
        attempts: status === 'printing' || status === 'failed' ? job.attempts + 1 : job.attempts,
        printedAt: status === 'printed' ? at : job.printedAt,
      }
    : job);

  return ok({ ...state, printJobs });
}

export function areAllTasksReady(state: LocalAggregateState): boolean {
  return state.tasks.length > 0 && state.tasks.every(task => task.status === 'ready' || task.status === 'delivered');
}
