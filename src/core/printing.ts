import type { PrintJob } from './local';

export interface PrintableLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  emphasis?: boolean;
}

export interface PrintDocument {
  title: string;
  lines: PrintableLine[];
  copies?: number;
}

export interface PrintAdapter {
  readonly name: string;
  readonly available: boolean;
  print(job: PrintJob, document: PrintDocument): Promise<void>;
}

export class BrowserPrintAdapter implements PrintAdapter {
  readonly name = 'browser-print';
  readonly available = typeof window !== 'undefined' && typeof window.print === 'function';

  async print(_job: PrintJob, document: PrintDocument): Promise<void> {
    if (!this.available) throw new Error('Browser printing is unavailable');
    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) throw new Error('Print window blocked');
    const htmlLines = document.lines.map(line => {
      const align = line.align ?? 'left';
      const weight = line.emphasis ? '700' : '400';
      const safe = line.text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
      return `<div style="text-align:${align};font-weight:${weight};white-space:pre-wrap">${safe}</div>`;
    }).join('');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${document.title}</title><style>@page{size:58mm auto;margin:2mm}body{font-family:ui-monospace,monospace;font-size:12px;margin:0;width:54mm}div{margin:2px 0}</style></head><body>${htmlLines}<script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
    popup.document.close();
  }
}

export interface NativePrintBridge {
  print(payload: { printerId: string; document: PrintDocument; jobId: string }): Promise<void>;
}

export class BridgePrintAdapter implements PrintAdapter {
  readonly name = 'native-bridge';
  readonly available = true;

  constructor(private readonly bridge: NativePrintBridge) {}

  print(job: PrintJob, document: PrintDocument): Promise<void> {
    return this.bridge.print({ printerId: job.printerId, document, jobId: job.id });
  }
}

export class ResilientPrintService {
  constructor(private readonly adapters: PrintAdapter[]) {}

  async print(job: PrintJob, document: PrintDocument): Promise<{ adapter: string }> {
    const failures: string[] = [];
    for (const adapter of this.adapters) {
      if (!adapter.available) continue;
      try {
        await adapter.print(job, document);
        return { adapter: adapter.name };
      } catch (error) {
        failures.push(`${adapter.name}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    throw new Error(`No print adapter succeeded. ${failures.join(' | ')}`);
  }
}

export const buildProductionTicket = (input: {
  businessName: string;
  tableLabel?: string;
  stationName: string;
  items: Array<{ quantity: number; name: string; personLabel?: string; notes?: string }>;
}): PrintDocument => ({
  title: `${input.businessName} · ${input.stationName}`,
  lines: [
    { text: input.businessName, align: 'center', emphasis: true },
    { text: input.stationName.toUpperCase(), align: 'center', emphasis: true },
    { text: input.tableLabel || 'Pedido', align: 'center' },
    { text: '--------------------------------' },
    ...input.items.flatMap(item => [
      { text: `${item.quantity} x ${item.name}`, emphasis: true },
      ...(item.personLabel ? [{ text: item.personLabel }] : []),
      ...(item.notes ? [{ text: `Nota: ${item.notes}` }] : []),
    ]),
    { text: '--------------------------------' },
    { text: new Date().toLocaleString('es-MX'), align: 'center' },
  ],
});
