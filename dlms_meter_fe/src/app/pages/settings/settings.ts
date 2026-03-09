import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeterSerialConfig } from './meter-serial-config/meter-serial-config';
import { AutoReadSchedule } from './auto-read-schedule/auto-read-schedule';
import { CsvStorageSettings } from './csv-storage-settings/csv-storage-settings';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MeterSerialConfig,
    AutoReadSchedule,
    CsvStorageSettings
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {}
