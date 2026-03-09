import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { DlmsService } from '../../../../services/dlms.service';

@Component({
  selector: 'app-serial-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './serial-config-dialog.html',
  styleUrl: './serial-config-dialog.scss'
})
export class SerialConfigDialog implements OnInit {
  serialForm: FormGroup;
  isEditMode: boolean = false;

  baudRates = [300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
  dataParityOptions = [
    { label: '8 Bit (8 data bits / no parity)', data_bits: 8, parity: 'None' },
    { label: '9 Bit (8 data bits / even parity)', data_bits: 8, parity: 'Even' }
  ];
  availablePorts: string[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<SerialConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dlmsService: DlmsService
  ) {
    this.serialForm = this.fb.group({
      name: ['', Validators.required],
      port: ['', Validators.required],
      baud_rate: [9600, Validators.required],
      data_parity: [this.dataParityOptions[0], Validators.required],
      stop_bits: [1, Validators.required]
    });
  }

  ngOnInit() {
    this.availablePorts = this.data.availablePorts || [];

    if (this.availablePorts.length > 0 && !this.data.serial) {
      this.serialForm.patchValue({ port: this.availablePorts[0] });
    }

    if (this.data.serial) {
      this.isEditMode = true;
      const dp = this.dataParityOptions.find(o => o.data_bits === this.data.serial.data_bits && o.parity === this.data.serial.parity) || this.dataParityOptions[0];
      this.serialForm.patchValue({
        name: this.data.serial.name,
        port: this.data.serial.port,
        baud_rate: this.data.serial.baud_rate,
        data_parity: dp,
        stop_bits: this.data.serial.stop_bits
      });
    }
  }

  save() {
    if (this.serialForm.invalid) return;
    const formVal = this.serialForm.value;
    const payload = {
      name: formVal.name,
      port: formVal.port,
      baud_rate: formVal.baud_rate,
      data_bits: formVal.data_parity.data_bits,
      stop_bits: formVal.stop_bits,
      parity: formVal.data_parity.parity
    };

    if (this.isEditMode) {
      this.dlmsService.updateSerialSetting(this.data.serial.id, payload).subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => console.error(err)
      });
    } else {
      this.dlmsService.addSerialSetting(payload).subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => {
          console.error(err);
          this.dialogRef.close(false); // Or handle error message in component
        }
      });
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
