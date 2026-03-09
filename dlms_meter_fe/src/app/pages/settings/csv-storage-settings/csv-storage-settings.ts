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
  selector: 'app-csv-storage-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './csv-storage-settings.html',
  styleUrl: './csv-storage-settings.scss'
})
export class CsvStorageSettings implements OnInit {
  pathForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dlmsService: DlmsService,
    private snackBar: MatSnackBar
  ) {
    this.pathForm = this.fb.group({
      csv_path: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loading = true;
    this.dlmsService.getCsvStoragePath().subscribe({
      next: (res: any) => {
        if (res && res.path) {
          this.pathForm.patchValue({ csv_path: res.path });
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error fetching CSV path', err);
        this.loading = false;
      }
    });
  }

  savePath() {
    if (this.pathForm.valid) {
      this.loading = true;
      const newPath = this.pathForm.value.csv_path;
      this.dlmsService.updateCsvStoragePath(newPath).subscribe({
        next: (res: any) => {
          this.snackBar.open(res.message || 'CSV storage path updated!', 'Close', { duration: 3000 });
          this.loading = false;
        },
        error: (err: any) => {
          const errMsg = err.error?.detail || 'Error updating CSV storage path';
          this.snackBar.open(errMsg, 'Close', { duration: 5000 });
          this.loading = false;
        }
      });
    }
  }
}
