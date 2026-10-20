import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, NarrationScript, ScriptLine } from './api.service';

export type Voice = 'yunxi' | 'xiaoxiao';

/**
 * 讲解播放引擎（需求 6）：加载讲解稿件、逐句播放音频、支持播放/暂停/停止、
 * 音色切换、倍速、逐句跳转与整篇进度。
 *
 * 音频缺失时回退为按字数的定时推进，保证没有 TTS 也能完整走完讲解流程。
 */
@Injectable({ providedIn: 'root' })
export class NarrationService {
  readonly script = signal<NarrationScript | null>(null);
  readonly currentIndex = signal(0);
  readonly isPlaying = signal(false);
  readonly isLoading = signal(false);
  readonly voice = signal<Voice>('yunxi');
  readonly speed = signal(1);
  readonly error = signal<string | null>(null);
  /** 当前句已播放时长（毫秒），用于句内进度显示 */
  readonly lineElapsedMs = signal(0);

  /** 展平后的所有台词，便于逐句导航 */
  readonly lines = computed<ScriptLine[]>(() => {
    const s = this.script();
    if (!s) return [];
    return s.sections.flatMap((section) => section.lines);
  });

  readonly totalLines = computed(() => this.lines().length);
  readonly currentLine = computed<ScriptLine | null>(() => this.lines()[this.currentIndex()] ?? null);

  readonly currentSectionTitle = computed(() => {
    const line = this.currentLine();
    if (!line) return '';
    const s = this.script();
    const section = s?.sections.find((x) => x.id === line.section_id);
    return section?.title ?? line.section_id;
  });

  readonly progressPercent = computed(() => {
    const total = this.totalLines();
    if (total === 0) return 0;
    return ((this.currentIndex() + 1) / total) * 100;
  });

  readonly elapsedMs = computed(() => {
    const lines = this.lines();
    let sum = 0;
    for (let i = 0; i < this.currentIndex() && i < lines.length; i++) {
      sum += this.lineDurationMs(lines[i]);
    }
    return sum + this.lineElapsedMs();
  });

  readonly totalDurationMs = computed(() => {
    const s = this.script();
    if (s && s.total_duration_ms > 0) return s.total_duration_ms;
    return this.lines().reduce((sum, line) => sum + this.lineDurationMs(line), 0);
  });

  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;

  constructor(private api: ApiService) {}

  /** 加载某个实验的讲解稿件；返回是否拿到可播放的稿件内容。 */
  async load(slug: string): Promise<boolean> {
    this.isLoading.set(true);
    this.error.set(null);
    this.stop();
    try {
      const resp = await firstValueFrom(this.api.getScript(slug));
      if (resp.code !== 0 || !resp.data) {
        this.error.set(resp.message ?? '讲解稿件加载失败');
        return false;
      }
      this.script.set(resp.data);
      this.currentIndex.set(0);
      this.lineElapsedMs.set(0);
      if (resp.data.total_lines === 0) {
        this.error.set('该实验的讲解稿件尚未生成，请在管理后台生成教学内容。');
        return false;
      }
      return true;
    } catch {
      this.error.set('无法连接后端服务，请确认后端已启动。');
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /** 开始播放当前句。 */
  play(): void {
    if (this.totalLines() === 0) return;
    this.isPlaying.set(true);
    this.error.set(null);
    this.playCurrentLine();
  }

  /** 暂停（保留当前句位置，可继续播放）。 */
  pause(): void {
    this.isPlaying.set(false);
    this.clearAudio();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.startedAt > 0) {
      this.lineElapsedMs.set(this.lineElapsedMs() + (Date.now() - this.startedAt));
      this.startedAt = 0;
    }
  }

  /** 播放/暂停切换。 */
  toggle(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** 停止并回到第一句。 */
  stop(): void {
    this.isPlaying.set(false);
    this.clearAudio();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.startedAt = 0;
    this.lineElapsedMs.set(0);
    this.currentIndex.set(0);
  }

  next(): void {
    const idx = this.currentIndex();
    if (idx >= this.totalLines() - 1) {
      this.pause();
      return;
    }
    this.goTo(idx + 1);
  }

  prev(): void {
    const idx = this.currentIndex();
    this.goTo(idx <= 0 ? 0 : idx - 1);
  }

  /** 跳转到指定句；播放中会立即换句续播。 */
  goTo(index: number): void {
    const total = this.totalLines();
    if (total === 0) return;
    const clamped = Math.min(Math.max(index, 0), total - 1);
    this.currentIndex.set(clamped);
    this.lineElapsedMs.set(0);
    if (this.isPlaying()) {
      this.playCurrentLine();
    }
  }

  setVoice(voice: Voice): void {
    if (this.voice() === voice) return;
    this.voice.set(voice);
    if (this.isPlaying()) {
      this.playCurrentLine();
    }
  }

  setSpeed(speed: number): void {
    this.speed.set(speed);
    if (this.audio) {
      this.audio.playbackRate = speed;
    }
  }

  /** 当前句的音频地址（可能为空字符串，表示该句尚未合成语音）。 */
  audioUrlFor(line: ScriptLine, voice: Voice = this.voice()): string {
    const url = voice === 'xiaoxiao' ? line.audio_xiaoxiao : line.audio_yunxi;
    return url ?? '';
  }

  hasAnyAudio(): boolean {
    return this.lines().some((line) => !!(line.audio_yunxi || line.audio_xiaoxiao));
  }

  lineDurationMs(line: ScriptLine): number {
    if (line.duration_ms > 0) return line.duration_ms;
    return this.estimateMs(line.text);
  }

  /** 中文朗读速度约 5 字/秒，据此估算时长（无音频时兜底）。 */
  estimateMs(text: string): number {
    const chars = (text ?? '').trim().length;
    if (chars === 0) return 0;
    return Math.round((chars / 5) * 1000);
  }

  // ==================== 内部实现 ====================

  private playCurrentLine(): void {
    this.clearAudio();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const line = this.currentLine();
    if (!line) return;

    const url = this.audioUrlFor(line);
    if (!url) {
      this.scheduleFallback(line);
      return;
    }

    const audio = new Audio(url);
    audio.playbackRate = this.speed();
    audio.onended = () => {
      if (this.isPlaying()) this.next();
    };
    audio.onerror = () => {
      // 音频不可用时退回定时推进，避免播放流程卡死。
      this.audio = null;
      this.scheduleFallback(line);
    };
    audio.ontimeupdate = () => {
      this.lineElapsedMs.set(Math.round(audio.currentTime * 1000));
    };
    this.audio = audio;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        this.audio = null;
        this.scheduleFallback(line);
      });
    }
  }

  /** 无音频时按估算时长推进到下一句。 */
  private scheduleFallback(line: ScriptLine): void {
    const duration = Math.max(800, this.lineDurationMs(line) / Math.max(0.5, this.speed()));
    this.startedAt = Date.now();
    this.timer = setTimeout(() => {
      this.lineElapsedMs.set(duration);
      this.startedAt = 0;
      if (this.isPlaying()) {
        this.next();
      }
    }, duration);
  }

  private clearAudio(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.ontimeupdate = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
  }
}
