import { TestBed } from '@angular/core/testing';

import { Dlms } from './dlms';

describe('Dlms', () => {
  let service: Dlms;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Dlms);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
