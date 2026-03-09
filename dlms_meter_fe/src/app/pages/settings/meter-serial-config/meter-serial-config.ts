import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DlmsService } from '../../../services/dlms.service';
import { SerialConfigDialog } from './serial-config-dialog/serial-config-dialog';
import { MeterConfigDialog } from './meter-config-dialog/meter-config-dialog';

@Component({
  selector: 'app-meter-serial-config',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './meter-serial-config.html',
  styleUrl: './meter-serial-config.scss'
})
export class MeterSerialConfig implements OnInit {
  serialsDataSource = new MatTableDataSource<any>([]);
  metersDataSource = new MatTableDataSource<any>([]);
  availablePorts: string[] = [];

  serialColumns: string[] = ['name', 'port', 'baud_rate', 'data_bits', 'stop_bits', 'parity', 'actions'];
  meterColumns: string[] = ['outstation', 'meter_name', 'serial_id', 'meter_hdlc_id', 'sn_referencing', 'actions'];

  constructor(
    private dlmsService: DlmsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.loadData();
    this.loadAvailablePorts();
  }

  loadAvailablePorts() {
    this.dlmsService.getAvailablePorts().subscribe({
      next: (ports) => {
        this.availablePorts = ports || [];
      },
      error: (err) => console.error('Failed to load COM ports', err)
    });
  }

  loadData() {
    this.dlmsService.getSerialSettings().subscribe({
      next: (res) => { this.serialsDataSource.data = res || []; },
      error: (err) => console.error('Failed to load serials', err)
    });

    this.dlmsService.getMeters().subscribe({
      next: (res) => { this.metersDataSource.data = res || []; },
      error: (err) => console.error('Failed to load meters', err)
    });
  }

  hasMetersForSerial(serialId: number): boolean {
    return this.metersDataSource.data.some((m: any) => m.serial_id === serialId);
  }

  getSerialName(serialId: number): string {
    const s = this.serialsDataSource.data.find((x: any) => x.id === serialId);
    return s ? `${s.name} (${s.port})` : serialId.toString();
  }

  // Serial Dialogs
  openSerialDialog(serial: any = null) {
    const dialogRef = this.dialog.open(SerialConfigDialog, {
      width: '400px',
      data: { serial, availablePorts: this.availablePorts }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res === true) {
        this.snackBar.open(serial ? 'Serial updated successfully' : 'Serial added successfully', 'Close', { duration: 3000 });
        this.loadData();
      } else if (typeof res === 'string') {
        this.snackBar.open(res, 'Close', { duration: 3000 });
      }
    });
  }

  deleteSerial(id: number) {
    if (confirm('Are you sure you want to delete this serial setting?')) {
      this.dlmsService.deleteSerialSetting(id).subscribe({
        next: () => {
          this.snackBar.open('Serial deleted successfully', 'Close', { duration: 3000 });
          this.loadData();
        },
        error: (err) => this.snackBar.open(err.error?.detail || 'Cannot delete serial', 'Close', { duration: 3000 })
      });
    }
  }

  // Meter Dialogs
  openMeterDialog(meter: any = null) {
    const dialogRef = this.dialog.open(MeterConfigDialog, {
      width: '450px',
      data: { meter, serials: this.serialsDataSource.data }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res === true) {
        this.snackBar.open(meter ? 'Meter updated successfully' : 'Meter added successfully', 'Close', { duration: 3000 });
        this.loadData();
      } else if (typeof res === 'string') {
        this.snackBar.open(res, 'Close', { duration: 3000 });
      }
    });
  }

  deleteMeter(id: number) {
    if (confirm('Are you sure you want to delete this meter config?')) {
      this.dlmsService.deleteMeter(id).subscribe({
        next: () => {
          this.snackBar.open('Meter deleted successfully', 'Close', { duration: 3000 });
          this.loadData();
        },
        error: () => this.snackBar.open('Cannot delete meter', 'Close', { duration: 3000 })
      });
    }
  }
}
