import { TestBed } from '@angular/core/testing';

<<<<<<< HEAD
<<<<<<< HEAD:src/app/service/toast/toast.service.spec.ts
=======
>>>>>>> 421f82e246547c2b835bfb8cd633b66e13b3ba30
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
<<<<<<< HEAD
=======
import { BoardService } from './board.service';

describe('BoardService', () => {
  let service: BoardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BoardService);
>>>>>>> 421f82e246547c2b835bfb8cd633b66e13b3ba30:src/app/service/board/board.service.spec.ts
=======
>>>>>>> 421f82e246547c2b835bfb8cd633b66e13b3ba30
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
