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
import { DlmsService } from '../../../services/dlms.service';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, concat } from 'rxjs';
import { catchError, toArray } from 'rxjs/operators';

// The 4 target energy registers — matched by profile row variable name keywords
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
  ],
  templateUrl: './instantaneous.html',
  styleUrl: './instantaneous.scss',
  providers: [DatePipe]
})
export class Instantaneous implements OnInit, AfterViewChecked {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  meters: any[] = [];
  selectedMeasurementPoints: string[] = [];

  selectedDate: Date | null = new Date();
  startHour: number = 0;
  startMinute: string = '00';
  endHour: number = 23;
  endMinute: string = '30';

  csvSavePath: string = '';
  hours = HOURS;
  minutes = MINUTES;

  loading = false;
  exporting = false;
  
  // ── Multi-meter results storage ───────────────────
  meterResults: { [outstation: string]: any } = {};
  viewingMeter: string | null = null;
  readingResult: any = null; // Currently viewed result

  displayedColumns: string[] = [];
  dataSource: any[] = [];
  isTableData = false;
  tableMode: 'billing' | 'profile' | 'none' = 'none';

  // Chart
  chartData: { label: string; value: number; unit: string }[] = [];
  chartPalettes = CHART_PALETTES;
  selectedChartColor = CHART_PALETTES[0].color;
  private chartNeedsRedraw = false;

  statCards: { obis: string; label: string; shortLabel: string; value: string; unit: string; delta?: string; icon: string; color: string }[] = [];

  // Missing data report
  missingDataReport: any[] = [];
  reportLoading = false;
  reportColumns = ['meter', 'date', 'missing_gaps'];

  constructor(
    private dlmsService: DlmsService,
    private snackBar: MatSnackBar,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.dlmsService.getMeters().subscribe({
      next: (res) => this.meters = res,
      error: (err) => console.log('Error loading meters', err)
    });
  }

  ngAfterViewChecked() {
    if (this.chartNeedsRedraw && this.chartCanvas) {
      this.chartNeedsRedraw = false;
      setTimeout(() => this.drawChart(), 50);
    }
  }

  onTabChange(event: any) {
    if (event.index === 0 && this.chartData.length > 0) {
      setTimeout(() => this.drawChart(), 150);
    }
  }

  onColorChange(color: string) {
    this.selectedChartColor = color;
    if (this.chartData.length > 0) {
      this.drawChart();
    }
  }

  get startTime(): string {
    return `${String(this.startHour).padStart(2, '0')}:${this.startMinute}`;
  }

  get endTime(): string {
    return `${String(this.endHour).padStart(2, '0')}:${this.endMinute}`;
  }

  get hasMeters(): boolean { return this.selectedMeasurementPoints.length > 0; }
  get hasDate(): boolean { return !!this.selectedDate; }

  /** Switch the UI to show data for a specific meter from the saved results */
  onViewingMeterChange(outstation: string) {
    this.viewingMeter = outstation;
    const res = this.meterResults[outstation];
    if (!res) {
      this.readingResult = null;
      this.dataSource = [];
      this.statCards = [];
      this.chartData = [];
      this.cdr.detectChanges();
      return;
    }

    this.readingResult = res;

    if (this.tableMode === 'billing') {
      this.displayedColumns = ['obis', 'description', 'value', 'unit'];
      this.dataSource = res.data || [];
      this.statCards = TARGET_OBIS.map(target => {
        const row = (res.data || []).find((r: any) => r.obis === target.obis);
        return {
          ...target,
          value: row ? (row.value ?? '—') : '—',
          unit: row ? (row.unit ?? '') : '',
        };
      });
    } else if (this.tableMode === 'profile') {
      const rows: any[][] = res.data?.data || [];
      if (rows.length > 0) {
        this.displayedColumns = rows[0].map((_: any, i: number) => `col_${i}`);
        this.dataSource = rows.map((rowArr: any[]) => {
          const obj: any = {};
          rowArr.forEach((val, i) => { obj[`col_${i}`] = val; });
          return obj;
        });

        const firstNumericRow = rows.find((r: any[]) =>
          r.slice(2).some((v: any) => v !== null && !isNaN(Number(v)) && Number(v) !== 0)
        );
        if (firstNumericRow) {
          this.chartData = firstNumericRow.slice(2)
            .map((val: any, i: number) => ({
              label: this.getTimeLabel(i + 2),
              value: val !== null ? (parseFloat(val) || 0) : 0,
              unit: ''
            }));
          this.chartNeedsRedraw = true;
        }

        this.statCards = TARGET_OBIS.map(target => {
          const key = target.profileKey.toLowerCase();
          const varRow = rows.find((r: any[]) => {
            const varName: string = (r[1] || '').toString().toLowerCase().replace(/[\s_\-]/g, '');
            return varName.includes(key);
          });
          let value = '—', delta = '';
          if (varRow) {
            const numerics = varRow.slice(2)
              .map((v: any) => (v !== null && v !== '' && !isNaN(Number(v)) ? parseFloat(v) : null))
              .filter((v): v is number => v !== null);
            if (numerics.length >= 2) {
              const diff = numerics[numerics.length - 1] - numerics[0];
              value = diff.toFixed(3);
              delta = `${numerics[0].toFixed(2)} → ${numerics[numerics.length - 1].toFixed(2)}`;
            } else if (numerics.length === 1) {
              value = numerics[0].toFixed(3);
            }
          }
          return { ...target, value, unit: target.unit, delta };
        });
      }
    }
    this.cdr.detectChanges();
  }

  readBilling() {
    if (!this.hasMeters) {
      this.snackBar.open('Please select at least one meter', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.tableMode = 'billing';
    this.meterResults = {};
    this.readingResult = null;

    // Use concat to read sequentially
    const tasks = this.selectedMeasurementPoints.map(mp => 
      this.dlmsService.getInstantaneousData(mp).pipe(
        catchError(err => {
          console.error(`Error reading billing for ${mp}`, err);
          return of({ error: true, outstation: mp });
        })
      )
    );

    concat(...tasks).pipe(toArray()).subscribe({
      next: (results) => {
        this.loading = false;
        results.forEach((res, idx) => {
          const mp = this.selectedMeasurementPoints[idx];
          if (!res.error) {
             this.meterResults[mp] = res;
          }
        });

        const firstMp = this.selectedMeasurementPoints.find(mp => this.meterResults[mp]);
        if (firstMp) {
          this.onViewingMeterChange(firstMp);
        } else {
          this.snackBar.open('Failed to read billing for any selected meter', 'Close', { duration: 3000 });
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.cdr.detectChanges();
        this.snackBar.open('Critical error during sequential read', 'Close', { duration: 3000 });
      }
    });
  }

  readProfile() {
    if (!this.hasMeters || !this.hasDate) {
      this.snackBar.open('Please select meter(s) and a date', 'Close', { duration: 3000 });
      return;
    }

    const formattedDate = this.datePipe.transform(this.selectedDate, 'yyyy-MM-dd') || '';
    this.loading = true;
    this.tableMode = 'profile';
    this.meterResults = {};
    this.readingResult = null;

    const tasks = this.selectedMeasurementPoints.map(mp => 
      this.dlmsService.getProfileData(mp, formattedDate, this.startTime, this.endTime, this.csvSavePath).pipe(
        catchError(err => {
          console.error(`Error reading profile for ${mp}`, err);
          return of({ error: true, outstation: mp });
        })
      )
    );

    concat(...tasks).pipe(toArray()).subscribe({
      next: (results) => {
        this.loading = false;
        results.forEach((res, idx) => {
          const mp = this.selectedMeasurementPoints[idx];
          if (!res.error) {
            this.meterResults[mp] = res;
          }
        });

        const firstMp = this.selectedMeasurementPoints.find(mp => this.meterResults[mp]);
        if (firstMp) {
          this.onViewingMeterChange(firstMp);
        }
        this.cdr.detectChanges();
        this.snackBar.open('Sequential profile read complete', 'Close', { duration: 3000 });
      }
    });
  }

  exportCsv() {
    if (!this.hasMeters || !this.hasDate) {
      this.snackBar.open('Please select meter(s) and a date', 'Close', { duration: 3000 });
      return;
    }

    const formattedDate = this.datePipe.transform(this.selectedDate, 'yyyy-MM-dd') || '';
    this.exporting = true;

    const tasks = this.selectedMeasurementPoints.map(mp => 
      this.dlmsService.exportProfileCsv(mp, formattedDate, this.startTime, this.endTime, this.csvSavePath).pipe(
        catchError(err => { console.error(err); return of(null); })
      )
    );

    concat(...tasks).pipe(toArray()).subscribe({
      next: (blobs) => {
        this.exporting = false;
        blobs.forEach((blob, idx) => {
          if (!blob) return;
          const outstation = this.selectedMeasurementPoints[idx];
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Profile_${outstation}_${formattedDate}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        });
        this.snackBar.open('CSV Export Complete!', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  generateMissingReport() {
    if (!this.hasMeters || !this.hasDate) {
      this.snackBar.open('Please select meter(s) and a date', 'Close', { duration: 3000 });
      return;
    }

    const formattedDate = this.datePipe.transform(this.selectedDate, 'yyyy-MM-dd') || '';
    this.reportLoading = true;
    this.missingDataReport = [];

    this.dlmsService.getMissingDataReport(
      this.selectedMeasurementPoints,
      formattedDate,
      this.startTime,
      this.endTime,
      this.csvSavePath
    ).subscribe({
      next: (res) => {
        this.reportLoading = false;
        this.missingDataReport = res?.report ?? [];
        this.cdr.detectChanges();
        if (this.missingDataReport.length === 0) {
          this.snackBar.open('No missing data found ✓', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        this.reportLoading = false;
        this.cdr.detectChanges();
        this.snackBar.open('Error generating report', 'Close', { duration: 3000 });
        console.error(err);
      }
    });
  }

  formatGaps(gaps: { from: string; to: string }[]): string {
    if (!gaps || gaps.length === 0) return '✓ No missing data';
    return gaps.map(g => `${g.from} → ${g.to}`).join(' | ');
  }

  getTimeLabel(index: number): string {
    if (index <= 1) return '';
    const startIdx = this.startHour * 2 + (this.startMinute === '30' ? 1 : 0);
    const slotIdx = startIdx + (index - 2);
    const totalMinutes = slotIdx * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes === 0 ? '00' : minutes}`;
  }

  drawChart() {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas || this.chartData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement!;
    canvas.width = container.clientWidth - 2;
    canvas.height = 320;

    const W = canvas.width, H = canvas.height;
    const PAD_L = 72, PAD_R = 24, PAD_T = 36, PAD_B = 70;
    const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f8f9fd';
    ctx.fillRect(0, 0, W, H);

    const data = this.chartData;
    const maxVal = Math.max(...data.map(d => d.value), 0.001);
    const minVal = Math.min(...data.map(d => d.value), 0);
    const range = maxVal - minVal || 1;

    const barCount = data.length;
    const gap = barCount > 30 ? 2 : barCount > 15 ? 4 : 8;
    const barW = Math.max(4, (chartW - gap * (barCount + 1)) / barCount);

    const gridCount = 5;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCount; i++) {
        const y = PAD_T + chartH - (i / gridCount) * chartH;
        ctx.strokeStyle = '#dde3ef';
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(PAD_L + chartW, y);
        ctx.stroke();

        const labelVal = minVal + (i / gridCount) * range;
        ctx.fillStyle = '#6c757d';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
            Math.abs(labelVal) >= 1000 ? (labelVal / 1000).toFixed(1) + 'k' :
            labelVal % 1 === 0 ? labelVal.toFixed(0) : labelVal.toFixed(2),
            PAD_L - 6, y + 4
        );
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ced4da';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T);
    ctx.lineTo(PAD_L, PAD_T + chartH);
    ctx.lineTo(PAD_L + chartW, PAD_T + chartH);
    ctx.stroke();

    const baseColor = this.selectedChartColor;
    const zeroY = PAD_T + chartH - ((0 - minVal) / range) * chartH;

    data.forEach((d, i) => {
        const x = PAD_L + gap + i * (barW + gap);
        const valY = PAD_T + chartH - ((d.value - minVal) / range) * chartH;
        const barTop = Math.min(valY, zeroY);
        const barH = Math.abs(zeroY - valY);
        const radius = Math.min(4, barW / 2.5, barH / 2);

        if (barH < 1) return;

        const grad = ctx.createLinearGradient(x, barTop, x, barTop + barH);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, baseColor + '60');
        ctx.fillStyle = grad;

        if (d.value >= 0) {
            ctx.beginPath();
            ctx.moveTo(x, zeroY);
            ctx.lineTo(x, barTop + radius);
            ctx.quadraticCurveTo(x, barTop, x + radius, barTop);
            ctx.lineTo(x + barW - radius, barTop);
            ctx.quadraticCurveTo(x + barW, barTop, x + barW, barTop + radius);
            ctx.lineTo(x + barW, zeroY);
            ctx.fill();
        } else {
            ctx.fillRect(x, barTop, barW, barH);
        }

        if (barCount <= 20 && barH > 18) {
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            const v = Math.abs(d.value) >= 1000 ? (d.value / 1000).toFixed(1) + 'k' :
                d.value % 1 === 0 ? d.value.toFixed(0) : d.value.toFixed(1);
            ctx.fillText(v, x + barW / 2, barTop - 4);
        }

        if (barCount <= 48) {
            ctx.save();
            ctx.translate(x + barW / 2, PAD_T + chartH + 8);
            ctx.rotate(-Math.PI / 4);
            ctx.fillStyle = '#495057';
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(d.label, 0, 0);
            ctx.restore();
        }
    });

    ctx.fillStyle = '#495057';
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Interval Data', PAD_L + 4, PAD_T - 14);
  }
}
