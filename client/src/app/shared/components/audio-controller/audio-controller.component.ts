import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'audio-controller',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <div class="audio-controller" *ngIf="src">
      <audio #audioEl [src]="src" (ended)="onEnded()" (timeupdate)="onTimeUpdate()"></audio>

      <div class="audio-controls">
        <button (click)="togglePlay()" class="ctrl-btn" [class.playing]="isPlaying" title="{{ isPlaying ? '暂停' : '播放' }}">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>

        <div class="progress-wrap">
          <div class="progress-bar" (click)="seek($event)">
            <div class="progress-fill" [style.width.%]="progressPercent"></div>
          </div>
          <span class="time-label">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        </div>

        <div class="volume-control">
          <span class="volume-icon">{{ volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊' }}</span>
          <input type="range" [(ngModel)]="volume" [min]="0" [max]="1" step="0.01" class="volume-slider" />
        </div>

        <div class="speed-control">
          <select [(ngModel)]="playbackRate" (change)="onSpeedChange()" class="speed-select">
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .audio-controller { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .ctrl-btn { width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .ctrl-btn { background: #667eea; color: white; }
    .ctrl-btn.playing { background: #e53e3e; }
    .ctrl-btn:hover { transform: scale(1.1); }
    .progress-wrap { flex: 1; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .progress-bar { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; position: relative; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.1s; }
    .time-label { font-size: 0.75rem; color: #718096; white-space: nowrap; }
    .volume-control { display: flex; align-items: center; gap: 0.5rem; }
    .volume-icon { font-size: 1rem; }
    .volume-slider { width: 80px; accent-color: #667eea; }
    .speed-select { padding: 0.25rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.875rem; }
  `]
})
export class AudioControllerComponent implements OnInit, OnDestroy {
  @Input() src = '';
  @Input() autoPlay = false;

  @Output() timeUpdate = new EventEmitter<number>();
  @Output() ended = new EventEmitter<void>();

  isPlaying = false;
  currentTime = 0;
  duration = 0;
  volume = 0.8;
  playbackRate = 1;

  get progressPercent(): number {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  ngOnInit(): void {
    if (this.autoPlay) {
      this.play();
    }
  }

  ngOnDestroy(): void {
    this.pause();
  }

  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    const audio = document.querySelector(`audio[src="${this.src}"]`) as HTMLAudioElement;
    if (audio) {
      audio.play().catch(() => {});
      this.isPlaying = true;
    }
  }

  pause(): void {
    const audio = document.querySelector(`audio[src="${this.src}"]`) as HTMLAudioElement;
    if (audio) {
      audio.pause();
      this.isPlaying = false;
    }
  }

  seek(event: MouseEvent): void {
    const bar = (event.currentTarget as HTMLElement).closest('.progress-wrap')?.querySelector('.progress-bar') as HTMLElement;
    if (!bar || this.duration === 0) return;
    const rect = bar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const audio = document.querySelector(`audio[src="${this.src}"]`) as HTMLAudioElement;
    if (audio) {
      audio.currentTime = percent * this.duration;
    }
  }

  onTimeUpdate(): void {
    const audio = document.querySelector(`audio[src="${this.src}"]`) as HTMLAudioElement;
    if (audio) {
      this.currentTime = audio.currentTime;
      this.duration = audio.duration || 0;
      this.timeUpdate.emit(this.currentTime);
    }
  }

  onEnded(): void {
    this.isPlaying = false;
    this.ended.emit();
  }

  onSpeedChange(): void {
    const audio = document.querySelector(`audio[src="${this.src}"]`) as HTMLAudioElement;
    if (audio) {
      audio.playbackRate = this.playbackRate;
    }
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
