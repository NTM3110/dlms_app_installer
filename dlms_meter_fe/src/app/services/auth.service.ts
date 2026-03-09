import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, delay, map } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User, LoginCredentials, LoginResponse, DEFAULT_PERMISSIONS } from '../interfaces/user.interface';

// Mock user for development
const MOCK_USER: User = {
    id: '1',
    username: 'admin',
    email: 'admin@maxicom.local',
    fullName: 'System Administrator',
    role: 'admin',
    enabled: true,
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
    permissions: DEFAULT_PERMISSIONS['admin'],
};

const MOCK_CREDENTIALS = {
    username: 'admin',
    password: 'admin',
};

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private isLoggedInSubject = new BehaviorSubject<boolean>(false);
    private currentUserSubject = new BehaviorSubject<User | null>(null);

    public isLoggedIn$ = this.isLoggedInSubject.asObservable();
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(
        private router: Router,
        private snackBar: MatSnackBar
    ) {
        this.checkSession();
    }

    public get isLoggedIn(): boolean {
        return this.isLoggedInSubject.value;
    }

    public get currentUser(): User | null {
        return this.currentUserSubject.value;
    }

    private checkSession(): void {
        const sessionActive = sessionStorage.getItem('mdm-session') === 'true';
        const storedUser = sessionStorage.getItem('mdm-user');

        if (sessionActive && storedUser) {
            try {
                const user = JSON.parse(storedUser) as User;
                this.isLoggedInSubject.next(true);
                this.currentUserSubject.next(user);
            } catch {
                this.clearSession();
            }
        }
    }

    /**
     * Login with credentials
     */
    login(credentials: LoginCredentials): Observable<LoginResponse> {
        return of(credentials).pipe(
            delay(500),
            map((creds) => {
                if (creds.username === MOCK_CREDENTIALS.username &&
                    creds.password === MOCK_CREDENTIALS.password) {
                    const user = { ...MOCK_USER, lastLogin: new Date() };
                    this.startSession(user);
                    return {
                        success: true,
                        user: user,
                        message: 'Login successful',
                    };
                }
                return {
                    success: false,
                    message: 'Invalid username or password',
                };
            })
        );
    }

    logout(): void {
        this.clearSession();
        this.router.navigate(['/login']);
        this.showMessage('Logged out', 'info');
    }

    private startSession(user: User): void {
        sessionStorage.setItem('mdm-session', 'true');
        sessionStorage.setItem('mdm-user', JSON.stringify(user));
        this.isLoggedInSubject.next(true);
        this.currentUserSubject.next(user);
    }

    private clearSession(): void {
        sessionStorage.removeItem('mdm-session');
        sessionStorage.removeItem('mdm-user');
        this.isLoggedInSubject.next(false);
        this.currentUserSubject.next(null);
    }

    public showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.snackBar.open(message, 'Close', {
            duration: 4000,
            panelClass: [`${type}-snackbar`],
            horizontalPosition: 'end',
            verticalPosition: 'top',
        });
    }
}
