import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-love-note',
  templateUrl: './love-note.html',
  styleUrl: './love-note.scss',
})
export class LoveNote {}
