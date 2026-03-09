import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { MainLayoutComponent } from './components/layout/main-layout/main-layout';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
    },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: 'settings/meter-serial', loadComponent: () => import('./pages/settings/meter-serial-config/meter-serial-config').then(m => m.MeterSerialConfig), data: { title: 'Meter & Serial Config' } },
            { path: 'settings/auto-read-schedule', loadComponent: () => import('./pages/settings/auto-read-schedule/auto-read-schedule').then(m => m.AutoReadSchedule), data: { title: 'Auto Read Schedule Config' } },
            { path: 'data/instantaneous', loadComponent: () => import('./pages/data/instantaneous/instantaneous').then(m => m.Instantaneous), data: { title: 'Real-Time Data Reading' } },
            { path: '', redirectTo: 'data/instantaneous', pathMatch: 'full' }
        ]
    },
    { path: '**', redirectTo: '' }
];
