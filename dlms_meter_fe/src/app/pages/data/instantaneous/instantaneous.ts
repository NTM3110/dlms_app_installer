import { Component, OnInit, AfterViewChecked, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DlmsService } from '../../../services/dlms.service';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, concat, from } from 'rxjs';
import { catchError, toArray, mergeMap, concatMap } from 'rxjs/operators';

// ── Error Dialog ───────────────────────────────────────────────────────────
import { Component as NgComponent, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@NgComponent({
  selector: 'app-read-error-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="error-dialog">
      <div class="error-dialog-header">
        <mat-icon>error_outline</mat-icon>
        <span>{{ data.title }}</span>
      </div>
      <div class="error-dialog-body">
        <p class="error-msg">{{ data.message }}</p>
        <div class="error-hint">
          <mat-icon>tips_and_updates</mat-icon>
          <span>Please check the <strong>meter HDLC address</strong>,
            <strong>serial port config</strong>, and ensure the meter is powered and connected.</span>
        </div>
        <pre class="error-detail" *ngIf="data.detail">{{ data.detail }}</pre>
      </div>
      <div class="error-dialog-actions">
        <button mat-raised-button color="primary" (click)="ref.close()">Understood</button>
      </div>
    </div>
  `,
  styles: [`
    .error-dialog { min-width: 380px; max-width: 560px; }
    .error-dialog-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 20px 12px; background: #c62828; color: white;
      font-weight: 700; font-size: 16px; border-radius: 8px 8px 0 0;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .error-dialog-body { padding: 20px 20px 8px; }
    .error-msg { font-size: 14px; color: #333; margin: 0 0 14px; line-height: 1.5; }
    .error-hint {
      display: flex; gap: 8px; align-items: flex-start;
      background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px;
      padding: 10px 14px; font-size: 13px; color: #5d4037; margin-bottom: 12px;
      mat-icon { color: #f9a825; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
    }
    .error-detail {
      background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;
      padding: 10px; font-size: 11px; color: #555; max-height: 120px;
      overflow-y: auto; white-space: pre-wrap; word-break: break-all;
    }
    .error-dialog-actions { padding: 8px 20px 16px; display: flex; justify-content: flex-end; }
  `]
})
export class ReadErrorDialog {
  constructor(public ref: MatDialogRef<ReadErrorDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; message: string; detail?: string }) { }
}
// ──────────────────────────────────────────────────────────────────────────

const TARGET_OBIS = [
  { obis: '1.1.1.8.0.255', label: 'Active Energy Import +A (QI+QIV)', shortLabel: 'Act. Import +A', icon: 'bolt', color: '#012596', profileKey: 'kwhnhan', unit: 'Wh' },
  { obis: '1.1.2.8.0.255', label: 'Active Energy Export −A (QII+QIII)', shortLabel: 'Act. Export −A', icon: 'electric_bolt', color: '#dc3545', profileKey: 'kwhgiao', unit: 'Wh' },
  { obis: '1.1.3.8.0.255', label: 'Reactive Energy Import +R (QI+QII)', shortLabel: 'React. Import +R', icon: 'flash_on', color: '#28a745', profileKey: 'kvarhnhan', unit: 'varh' },
  { obis: '1.1.4.8.0.255', label: 'Reactive Energy Export −R (QIII+QIV)', shortLabel: 'React. Export −R', icon: 'flash_off', color: '#FF6D00', profileKey: 'kvarhgiao', unit: 'varh' },
];

export const CHART_PALETTES: { name: string; color: string }[] = [
  { name: 'Blue', color: '#012596' },
  { name: 'Green', color: '#28a745' },
  { name: 'Orange', color: '#FF6D00' },
  { name: 'Teal', color: '#17a2b8' },
  { name: 'Purple', color: '#6f42c1' },
  { name: 'Red', color: '#dc3545' },
];

export const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES: string[] = ['00', '30'];

@Component({
  selector: 'app-instantaneous',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatInputModule,
    MatIconModule,
    MatDividerModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './instantaneous.html',
  styleUrl: './instantaneous.scss',
  providers: [DatePipe]
})
export class Instantaneous implements OnInit, AfterViewChecked {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  meters: any[] = [];
  selectedMeasurementPoints: string[] = [];

  // ── Date range ────────────────────────────────────
  startDate: Date = new Date();
  endDate: Date = new Date();

  // ── Time selects ──────────────────────────────────
  startHour: number = 0;
  startMinute: string = '00';
  endHour: number = 23;
  endMinute: string = '30';

  hours = HOURS;
  minutes = MINUTES;

  csvSavePath: string = '';

  loading = false;
  exporting = false;

  // ── View mode ─────────────────────────────────────
  activeView: 'none' | 'data' | 'report' = 'none';

  // ── Multi-meter results ───────────────────────────
  // Billing:  meterResults[outstation]         = response
  // Profile:  meterResults[outstation][date]   = response  (keyed by 'yyyy-MM-dd')
  meterResults: { [outstation: string]: any } = {};
  viewingMeter: string | null = null;
  viewingDate: string | null = null;   // only used in profile mode
  readingResult: any = null;

  displayedColumns: string[] = [];
  dataSource: any[] = [];
  tableMode: 'billing' | 'profile' | 'none' = 'none';

  chartData: { label: string; value: number; unit: string }[] = [];
  chartPalettes = CHART_PALETTES;
  selectedChartColor = CHART_PALETTES[0].color;
  private chartNeedsRedraw = false;

  statCards: { obis: string; label: string; shortLabel: string; value: string; unit: string; delta?: string; icon: string; color: string }[] = [];

  missingDataReport: any[] = [];
  reportLoading = false;
  reportColumns = ['meter', 'date', 'missing_gaps'];
  loadedDates: string[] = [];  // dates shown for current viewingMeter (profile)

  constructor(
    private dlmsService: DlmsService,
    private snackBar: MatSnackBar,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.dlmsService.getMeters().subscribe({
      next: (res) => this.meters = res,
      error: (err) => console.log('Error loading meters', err)
    });
    this.dlmsService.getCsvStoragePath().subscribe({
      next: (res) => { this.csvSavePath = res?.path ?? ''; this.cdr.detectChanges(); },
      error: () => { }
    });
  }

  ngAfterViewChecked() {
    if (this.chartNeedsRedraw && this.chartCanvas) {
      this.chartNeedsRedraw = false;
      setTimeout(() => this.drawChart(), 50);
    }
  }

  // ── Helpers ───────────────────────────────────────

  get startTime(): string {
    return `${String(this.startHour).padStart(2, '0')}:${this.startMinute}`;
  }

  get endTime(): string {
    return `${String(this.endHour).padStart(2, '0')}:${this.endMinute}`;
  }

  get hasMeters(): boolean { return this.selectedMeasurementPoints.length > 0; }
  get hasDate(): boolean { return !!this.startDate; }

  /** Returns every calendar date from start to end (inclusive) */
  private getDatesInRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const curr = new Date(start); curr.setHours(0, 0, 0, 0);
    const endD = new Date(end); endD.setHours(23, 59, 59, 0);
    while (curr <= endD) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
    return dates;
  }

  saveCsvPath() {
    this.dlmsService.updateCsvStoragePath(this.csvSavePath.trim()).subscribe({
      next: () => this.snackBar.open('CSV path saved ✓', 'Close', { duration: 3000 }),
      error: (err) => this.snackBar.open(`Failed to save path: ${err?.error?.detail ?? err?.message}`, 'Close', { duration: 4000 })
    });
  }

  private showReadError(label: string, err: any) {
    const apiDetail = err?.error?.detail ?? err?.error?.message ?? null;
    this.dialog.open(ReadErrorDialog, {
      data: {
        title: 'Meter Read Error',
        message: `Failed to read data for "${label}".`,
        detail: apiDetail ? `${err?.status ? '[HTTP ' + err.status + '] ' : ''}${apiDetail}` : (err?.message ?? JSON.stringify(err))
      }
    });
  }

  // ── View helpers ──────────────────────────────────

  /** For profile mode: sorted list of loaded dates for the current viewingMeter */
  get datesForMeter(): string[] {
    if (this.tableMode !== 'profile' || !this.viewingMeter) return [];
    const bucket = this.meterResults[this.viewingMeter];
    if (!bucket || typeof bucket !== 'object') return [];
    return Object.keys(bucket).sort();
  }

  /** Friendly display label for a date key (yyyy-MM-dd → dd/MM/yyyy) */
  formatDateKey(d: string): string {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  onViewingMeterChange(outstation: string) {
    this.viewingMeter = outstation;

    if (this.tableMode === 'profile') {
      // Auto-select first available date for this meter
      const dates = this.datesForMeter;
      this.viewingDate = dates.length > 0 ? dates[0] : null;
      this._applyProfileResult();
    } else {
      // Billing: flat result
      this._applyBillingResult();
    }
  }

  onViewingDateChange(dateKey: string) {
    this.viewingDate = dateKey;
    this._applyProfileResult();
  }

  private _applyBillingResult() {
    const res = this.viewingMeter ? this.meterResults[this.viewingMeter] : null;
    if (!res) { this.readingResult = null; this.dataSource = []; this.statCards = []; this.cdr.detectChanges(); return; }
    this.readingResult = res;
    this.displayedColumns = ['obis', 'description', 'value', 'unit'];
    this.dataSource = res.data || [];
    this.statCards = TARGET_OBIS.map(t => {
      const row = (res.data || []).find((r: any) => r.obis === t.obis);
      return { ...t, value: row ? (row.value ?? '—') : '—', unit: row ? (row.unit ?? '') : '' };
    });
    this.cdr.detectChanges();
  }

  private _applyProfileResult() {
    if (!this.viewingMeter || !this.viewingDate) { this.readingResult = null; this.dataSource = []; this.statCards = []; this.cdr.detectChanges(); return; }
    const res = this.meterResults[this.viewingMeter]?.[this.viewingDate];
    if (!res) { this.readingResult = null; this.dataSource = []; this.statCards = []; this.cdr.detectChanges(); return; }
    this.readingResult = res;
    const rows: any[][] = res.data?.data || [];
    if (rows.length > 0) {
      this.displayedColumns = rows[0].map((_: any, i: number) => `col_${i}`);
      this.dataSource = rows.map((r: any[]) => { const o: any = {}; r.forEach((v, i) => { o[`col_${i}`] = v; }); return o; });
      const firstNum = rows.find((r: any[]) => r.slice(2).some((v: any) => v !== null && !isNaN(Number(v)) && Number(v) !== 0));
      if (firstNum) {
        // For today's date: clip chart to slots that have actually occurred
        // (future slots in the CSV are null/NaN and render as misleading 0.0 bars)
        const todayStr = this.datePipe.transform(new Date(), 'yyyy-MM-dd');
        const isToday = this.viewingDate === todayStr;
        const now = new Date();
        const currentSlotIdx = isToday ? (now.getHours() * 2 + Math.floor(now.getMinutes() / 30)) : Infinity;

        // Determine startSlotIdx for this viewingDate
        const [y, m, day] = (this.viewingDate || '').split('-').map(Number);
        const dateObj = new Date(y, m - 1, day);
        const isFirstDate = this.datePipe.transform(this.startDate, 'yyyy-MM-dd') === this.viewingDate;
        const slotStart = this._viewingSlotStart;

        this.chartData = firstNum.slice(2)
          .map((val: any, i: number) => {
            const slotIdx = slotStart + i;
            const hasValue = val !== null && val !== '' && !isNaN(Number(val));
            // Skip future slots on today (they are empty, showing 0 is misleading)
            if (isToday && slotIdx > currentSlotIdx) return null;
            // Compute label from absolute slot index (not startHour — avoids 42:30 on middle dates)
            const totalMins = slotIdx * 30;
            const h = Math.floor(totalMins / 60);
            const mm = totalMins % 60;
            const label = `${h}:${mm === 0 ? '00' : mm}`;
            return { label, value: hasValue ? parseFloat(val) : 0, unit: '' };
          })
          .filter((d): d is { label: string; value: number; unit: string } => d !== null);
        this.chartNeedsRedraw = true;
      }
      this.statCards = TARGET_OBIS.map(t => {
        const key = t.profileKey.toLowerCase();
        const varRow = rows.find((r: any[]) => (r[1] || '').toString().toLowerCase().replace(/[\s_\-]/g, '').includes(key));
        let value = '—', delta = '';
        if (varRow) {
          const nums = varRow.slice(2).map((v: any) => (v !== null && v !== '' && !isNaN(Number(v)) ? parseFloat(v) : null)).filter((v): v is number => v !== null);
          if (nums.length >= 2) { const diff = nums[nums.length - 1] - nums[0]; value = diff.toFixed(3); delta = `${nums[0].toFixed(2)} → ${nums[nums.length - 1].toFixed(2)}`; }
          else if (nums.length === 1) { value = nums[0].toFixed(3); }
        }
        return { ...t, value, unit: t.unit, delta };
      });
    }
    this.cdr.detectChanges();
  }

  // ── Actions ───────────────────────────────────────

  readBilling() {
    if (!this.hasMeters) { this.snackBar.open('Please select at least one meter', 'Close', { duration: 3000 }); return; }
    this.loading = true; this.activeView = 'data'; this.tableMode = 'billing';
    this.meterResults = {}; this.readingResult = null; this.missingDataReport = [];
    this.viewingDate = null;

    const tasks = this.selectedMeasurementPoints.map(mp =>
      this.dlmsService.getInstantaneousData(mp).pipe(catchError(err => { this.showReadError(mp, err); return of({ error: true }); }))
    );
    concat(...tasks).pipe(toArray()).subscribe({
      next: (results) => {
        this.loading = false;
        results.forEach((res, i) => { if (!res.error) this.meterResults[this.selectedMeasurementPoints[i]] = res; });
        const first = this.selectedMeasurementPoints.find(mp => this.meterResults[mp]);
        if (first) { this.viewingMeter = first; this._applyBillingResult(); } else { this.activeView = 'none'; }
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.activeView = 'none'; this.cdr.detectChanges(); }
    });
  }

  readProfile() {
    if (!this.hasMeters || !this.hasDate) { this.snackBar.open('Please select meter(s) and a date', 'Close', { duration: 3000 }); return; }
    const dates = this.getDatesInRange(this.startDate, this.endDate);
    this.loading = true; this.activeView = 'data'; this.tableMode = 'profile';
    this.meterResults = {}; this.readingResult = null; this.missingDataReport = [];
    this.viewingDate = null;

    // Build sequential job list: every date × every meter
    // Per-date time logic:
    //   first date  → startTime → 23:30
    //   middle dates → 00:00 → 23:30 (full day)
    //   last date   → 00:00 → endTime
    //   single date  → startTime → endTime
    const jobs: { date: string; mp: string; sTime: string; eTime: string }[] = [];
    dates.forEach((d, idx) => {
      const fd = this.datePipe.transform(d, 'yyyy-MM-dd') || '';
      const isFirst = idx === 0;
      const isLast = idx === dates.length - 1;
      const sTime = isFirst ? this.startTime : '00:00';
      const eTime = isLast ? this.endTime : '23:30';
      this.selectedMeasurementPoints.forEach(mp => jobs.push({ date: fd, mp, sTime, eTime }));
    });

    from(jobs).pipe(
      concatMap(job =>
        this.dlmsService.getProfileData(job.mp, job.date, job.sTime, job.eTime, this.csvSavePath).pipe(
          catchError(err => { this.showReadError(`${job.mp} — ${job.date}`, err); return of({ error: true }); }),
          mergeMap(res => of({ ...job, res }))
        )
      ),
      toArray()
    ).subscribe({
      next: (results) => {
        this.loading = false;
        results.forEach(({ mp, date, res }) => {
          if (!(res as any).error) {
            if (!this.meterResults[mp]) this.meterResults[mp] = {};
            this.meterResults[mp][date] = res;  // keyed by 'yyyy-MM-dd'
          }
        });
        // Default view: first meter that has any data, first date
        const firstMp = this.selectedMeasurementPoints.find(mp => this.meterResults[mp] && Object.keys(this.meterResults[mp]).length > 0);
        if (firstMp) {
          this.viewingMeter = firstMp;
          this.viewingDate = Object.keys(this.meterResults[firstMp]).sort()[0];
          this._applyProfileResult();
        } else {
          this.activeView = 'none';
        }
        const total = results.filter(r => !(r.res as any).error).length;
        this.snackBar.open(`Profile read complete — ${total} / ${jobs.length} successful`, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  exportCsv() {
    if (!this.hasMeters || !this.hasDate) { this.snackBar.open('Please select meter(s) and a date', 'Close', { duration: 3000 }); return; }
    // Export CSV for each date in the range x each meter
    const dates = this.getDatesInRange(this.startDate, this.endDate);
    this.exporting = true;

    // Build flat list of [date, meter] jobs with correct per-date time bounds
    const jobs: { date: string; mp: string; sTime: string; eTime: string }[] = [];
    dates.forEach((d, idx) => {
      const fd = this.datePipe.transform(d, 'yyyy-MM-dd') || '';
      const sTime = idx === 0 ? this.startTime : '00:00';
      const eTime = idx === dates.length - 1 ? this.endTime : '23:30';
      this.selectedMeasurementPoints.forEach(mp => jobs.push({ date: fd, mp, sTime, eTime }));
    });

    from(jobs).pipe(
      concatMap(job =>
        this.dlmsService.exportProfileCsv(job.mp, job.date, job.sTime, job.eTime, this.csvSavePath).pipe(
          catchError(err => { console.error(err); return of(null); }),
          mergeMap(blob => { if (blob) return of({ blob, ...job }); return of(null); })
        )
      ),
      toArray()
    ).subscribe({
      next: (results) => {
        this.exporting = false;
        let count = 0;
        results.forEach(r => {
          if (!r || !r.blob) return;
          const url = window.URL.createObjectURL(r.blob);
          const a = document.createElement('a');
          a.href = url; a.download = `Profile_${r.mp}_${r.date}.csv`; a.click();
          window.URL.revokeObjectURL(url);
          count++;
        });
        this.snackBar.open(`CSV Export Complete! (${count} file${count !== 1 ? 's' : ''})`, 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  generateMissingReport() {
    if (!this.hasMeters || !this.hasDate) { this.snackBar.open('Please select meter(s) and a date', 'Close', { duration: 3000 }); return; }
    // Check each date in the range
    const dates = this.getDatesInRange(this.startDate, this.endDate);
    this.reportLoading = true; this.activeView = 'report';
    this.missingDataReport = []; this.readingResult = null; this.viewingMeter = null; this.meterResults = {};

    from(dates).pipe(
      concatMap(d => {
        const fd = this.datePipe.transform(d, 'yyyy-MM-dd') || '';
        return this.dlmsService.getMissingDataReport(
          this.selectedMeasurementPoints, fd, this.startTime, this.endTime, this.csvSavePath
        ).pipe(catchError(() => of({ report: [] })));
      }),
      toArray()
    ).subscribe({
      next: (allResults) => {
        this.reportLoading = false;
        // Flatten all per-date reports into one list
        this.missingDataReport = allResults.flatMap((r: any) => r?.report ?? []);
        this.cdr.detectChanges();
        if (this.missingDataReport.length === 0) {
          this.snackBar.open('No missing data found ✓', 'Close', { duration: 3000 });
          this.activeView = 'none';
        }
      },
      error: () => {
        this.reportLoading = false; this.activeView = 'none'; this.cdr.detectChanges();
        this.snackBar.open('Error generating report', 'Close', { duration: 3000 });
      }
    });
  }

  onTabChange(event: any) {
    if (event.index === 0 && this.chartData.length > 0) setTimeout(() => this.drawChart(), 150);
  }

  onColorChange(color: string) {
    this.selectedChartColor = color;
    if (this.chartData.length > 0) this.drawChart();
  }

  /** Effective slot-start index for the currently viewed date (0 for middle/last dates, startHour*2+.. for first date) */
  private get _viewingSlotStart(): number {
    const isFirst = this.datePipe.transform(this.startDate, 'yyyy-MM-dd') === this.viewingDate;
    return isFirst ? (this.startHour * 2 + (this.startMinute === '30' ? 1 : 0)) : 0;
  }

  /** HH:MM label for the start of the currently-viewed date's data range */
  get viewingEffectiveStartTime(): string {
    const isFirst = this.datePipe.transform(this.startDate, 'yyyy-MM-dd') === this.viewingDate;
    return isFirst ? this.startTime : '00:00';
  }

  /** HH:MM label for the end of the currently-viewed date's data range */
  get viewingEffectiveEndTime(): string {
    const isLast = this.datePipe.transform(this.endDate, 'yyyy-MM-dd') === this.viewingDate;
    return isLast ? this.endTime : '23:30';
  }

  getTimeLabel(index: number): string {
    if (index <= 1) return '';
    const slotIdx = this._viewingSlotStart + (index - 2);
    const totalMins = slotIdx * 30;
    const h = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${h}:${mm === 0 ? '00' : mm}`;
  }

  drawChart() {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas || this.chartData.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const container = canvas.parentElement!;
    canvas.width = container.clientWidth - 2; canvas.height = 320;
    const W = canvas.width, H = canvas.height;
    const PAD_L = 72, PAD_R = 24, PAD_T = 36, PAD_B = 70;
    const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#f8f9fd'; ctx.fillRect(0, 0, W, H);
    const data = this.chartData;
    const maxVal = Math.max(...data.map(d => d.value), 0.001);
    const minVal = Math.min(...data.map(d => d.value), 0);
    const range = maxVal - minVal || 1;
    const barCount = data.length;
    const gap = barCount > 30 ? 2 : barCount > 15 ? 4 : 8;
    const barW = Math.max(4, (chartW - gap * (barCount + 1)) / barCount);
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = PAD_T + chartH - (i / 5) * chartH;
      ctx.strokeStyle = '#dde3ef'; ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + chartW, y); ctx.stroke();
      const lv = minVal + (i / 5) * range;
      ctx.fillStyle = '#6c757d'; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.abs(lv) >= 1000 ? (lv / 1000).toFixed(1) + 'k' : lv % 1 === 0 ? lv.toFixed(0) : lv.toFixed(2), PAD_L - 6, y + 4);
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ced4da'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, PAD_T + chartH); ctx.lineTo(PAD_L + chartW, PAD_T + chartH); ctx.stroke();
    const baseColor = '#012596'; // fixed blue — color picker removed
    const zeroY = PAD_T + chartH - ((0 - minVal) / range) * chartH;
    data.forEach((d, i) => {
      const x = PAD_L + gap + i * (barW + gap);
      const valY = PAD_T + chartH - ((d.value - minVal) / range) * chartH;
      const barTop = Math.min(valY, zeroY), barH = Math.abs(zeroY - valY);
      const radius = Math.min(4, barW / 2.5, barH / 2);
      if (barH < 1) return;
      const grad = ctx.createLinearGradient(x, barTop, x, barTop + barH);
      grad.addColorStop(0, baseColor); grad.addColorStop(1, baseColor + '60');
      ctx.fillStyle = grad;
      if (d.value >= 0) {
        ctx.beginPath(); ctx.moveTo(x, zeroY); ctx.lineTo(x, barTop + radius);
        ctx.quadraticCurveTo(x, barTop, x + radius, barTop);
        ctx.lineTo(x + barW - radius, barTop); ctx.quadraticCurveTo(x + barW, barTop, x + barW, barTop + radius);
        ctx.lineTo(x + barW, zeroY); ctx.fill();
      } else { ctx.fillRect(x, barTop, barW, barH); }
      if (barCount <= 20 && barH > 18) {
        ctx.fillStyle = '#212529'; ctx.font = 'bold 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
        const v = Math.abs(d.value) >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : d.value % 1 === 0 ? d.value.toFixed(0) : d.value.toFixed(1);
        ctx.fillText(v, x + barW / 2, barTop - 4);
      }
      if (barCount <= 48) {
        ctx.save(); ctx.translate(x + barW / 2, PAD_T + chartH + 8); ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#495057'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(d.label, 0, 0); ctx.restore();
      }
    });
    ctx.fillStyle = '#495057'; ctx.font = 'bold 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Interval Data', PAD_L + 4, PAD_T - 14);
  }
}
