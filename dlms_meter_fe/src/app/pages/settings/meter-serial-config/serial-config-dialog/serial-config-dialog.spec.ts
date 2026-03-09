import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SerialConfigDialog } from './serial-config-dialog';

describe('SerialConfigDialog', () => {
  let component: SerialConfigDialog;
  let fixture: ComponentFixture<SerialConfigDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SerialConfigDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(SerialConfigDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
