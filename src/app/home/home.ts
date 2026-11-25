import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberLayout } from '../shared/member-layout/member-layout';
import { LoveNote } from './love-note/love-note';

@Component({
  selector: 'app-home',
  imports: [MemberLayout, RouterLink, LoveNote],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {}
