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
  selector: 'app-meter-config-dialog',
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
  templateUrl: './meter-config-dialog.html',
  styleUrl: './meter-config-dialog.scss'
})
export class MeterConfigDialog implements OnInit {
  meterForm: FormGroup;
  isEditMode: boolean = false;
  serials: any[] = [];

  snReferences = [
    { label: 'Short name referencing', value: 'sn' },
    { label: 'Logical name referencing', value: 'ln' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MeterConfigDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dlmsService: DlmsService
  ) {
    this.meterForm = this.fb.group({
      outstation: ['', Validators.required],
      meter_name: ['', Validators.required],
      serial_id: ['', Validators.required],
      meter_hdlc_id: [1, Validators.required],
      sn_referencing: [this.snReferences[0].value, Validators.required]
    });
  }

  ngOnInit() {
    this.serials = this.data.serials || [];

    if (this.data.meter) {
      this.isEditMode = true;
      this.meterForm.patchValue({
        outstation: this.data.meter.outstation,
        meter_name: this.data.meter.meter_name,
        serial_id: this.data.meter.serial_id,
        meter_hdlc_id: this.data.meter.meter_hdlc_id,
        sn_referencing: this.data.meter.sn_referencing
      });
    }
  }

  save() {
    if (this.meterForm.invalid) return;
    const payload = this.meterForm.value;

    if (this.isEditMode) {
      this.dlmsService.updateMeter(this.data.meter.id, payload).subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => console.error('Error updating meter', err)
      });
    } else {
      this.dlmsService.addMeter(payload).subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => {
          console.error(err);
          this.dialogRef.close(err.error?.detail || 'Error adding meter');
        }
      });
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
