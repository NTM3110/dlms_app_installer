import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { DlmsService } from '../../../services/dlms.service';

@Component({
  selector: 'app-auto-read-schedule',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './auto-read-schedule.html',
  styleUrl: './auto-read-schedule.scss'
})
export class AutoReadSchedule implements OnInit {
  scheduleForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dlmsService: DlmsService,
    private snackBar: MatSnackBar
  ) {
    this.scheduleForm = this.fb.group({
      read_time: ['00:30', Validators.required]
    });
  }

  ngOnInit() {
    this.dlmsService.getAutoReadSchedule().subscribe({
      next: (res) => { if (res && res.read_time) this.scheduleForm.patchValue(res); },
      error: (err) => console.log('Schedule not found', err)
    });
  }

  saveSchedule() {
    if (this.scheduleForm.valid) {
      this.dlmsService.updateAutoReadSchedule(this.scheduleForm.value).subscribe({
        next: () => this.snackBar.open('Schedule saved!', 'Close', { duration: 3000 }),
        error: () => this.snackBar.open('Error saving schedule', 'Close', { duration: 3000 })
      });
    }
  }
}
