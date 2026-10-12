import { GameEngine } from './game';
import { AudioManager } from './audio';
import { Upgrade } from './types';

export class UIManager {
  private game: GameEngine;
  private audio: AudioManager;

  // DOM elements
  private voxelsCountEl!: HTMLElement;
  private vpsCountEl!: HTMLElement;
  private vpcCountEl!: HTMLElement;
  private mainVoxelEl!: HTMLElement;
  private clickParticlesContainer!: HTMLElement;
  private upgradesListEl!: HTMLElement;
  private musicToggleBtn!: HTMLElement;
  private sfxToggleBtn!: HTMLElement;
  private resetBtn!: HTMLElement;

  constructor(game: GameEngine, audio: AudioManager) {
    this.game = game;
    this.audio = audio;
  }

  public init(): void {
    this.voxelsCountEl = document.getElementById('voxels-count')!;
    this.vpsCountEl = document.getElementById('vps-count')!;
    this.vpcCountEl = document.getElementById('vpc-count')!;
    this.mainVoxelEl = document.getElementById('main-voxel')!;
    this.clickParticlesContainer = document.getElementById('particles-container')!;
    this.upgradesListEl = document.getElementById('upgrades-list')!;
    this.musicToggleBtn = document.getElementById('music-toggle')!;
    this.sfxToggleBtn = document.getElementById('sfx-toggle')!;
    this.resetBtn = document.getElementById('reset-btn')!;

    this.setupEventListeners();
    this.renderUpgrades();
    this.updateStats();
  }

  private setupEventListeners(): void {
    // Voxel Click
    this.mainVoxelEl.addEventListener('click', (e: MouseEvent) => {
      const earned = this.game.click();
      this.audio.playClickSound();
      this.spawnFloatingText(e.clientX, e.clientY, `+${GameEngine.formatNumber(earned)}`);
      this.triggerVoxelBounce();
      this.updateStats();
    });

    // Music toggle
    this.musicToggleBtn.addEventListener('click', () => {
      const isPlaying = this.audio.toggleMusic();
      this.musicToggleBtn.classList.toggle('active', isPlaying);
      this.musicToggleBtn.setAttribute(
        'title',
        isPlaying ? 'Musique : En lecture (Clique pour couper)' : 'Musique : En pause (Clique pour lancer)'
      );
      const icon = this.musicToggleBtn.querySelector('.icon');
      if (icon) {
        icon.textContent = isPlaying ? '🎵' : '🔇';
      }
    });

    // SFX / Mute toggle
    this.sfxToggleBtn.addEventListener('click', () => {
      const isMuted = this.audio.toggleMute();
      this.sfxToggleBtn.classList.toggle('muted', isMuted);
      const icon = this.sfxToggleBtn.querySelector('.icon');
      if (icon) {
        icon.textContent = isMuted ? '🔕' : '🔊';
      }
    });

    // Reset button
    this.resetBtn.addEventListener('click', () => {
      if (window.confirm('Voulez-vous réinitialiser votre progression ?')) {
        this.game.reset();
        this.renderUpgrades();
        this.updateStats();
      }
    });
  }

  public updateStats(): void {
    this.voxelsCountEl.textContent = GameEngine.formatNumber(Math.floor(this.game.state.voxels));
    this.vpsCountEl.textContent = GameEngine.formatNumber(this.game.state.voxelsPerSecond);
    this.vpcCountEl.textContent = GameEngine.formatNumber(this.game.state.clickPower);

    // Update affordability on upgrade buttons
    const buttons = this.upgradesListEl.querySelectorAll<HTMLButtonElement>('.upgrade-item');
    buttons.forEach(btn => {
      const id = btn.getAttribute('data-id');
      const upgrade = this.game.state.upgrades.find(u => u.id === id);
      if (upgrade) {
        const canAfford = this.game.state.voxels >= upgrade.cost;
        btn.classList.toggle('can-afford', canAfford);
        btn.classList.toggle('disabled', !canAfford);
      }
    });
  }

  public renderUpgrades(): void {
    this.upgradesListEl.innerHTML = '';

    this.game.state.upgrades.forEach((upgrade: Upgrade) => {
      const itemEl = document.createElement('button');
      itemEl.className = 'upgrade-item';
      itemEl.setAttribute('data-id', upgrade.id);

      const canAfford = this.game.state.voxels >= upgrade.cost;
      if (!canAfford) itemEl.classList.add('disabled');
      if (canAfford) itemEl.classList.add('can-afford');

      itemEl.innerHTML = `
        <div class="upgrade-icon">${upgrade.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${upgrade.name}</div>
          <div class="upgrade-desc">${upgrade.description}</div>
          <div class="upgrade-cost">Coût : <strong>${GameEngine.formatNumber(upgrade.cost)}</strong> voxels</div>
        </div>
        <div class="upgrade-count">x${upgrade.count}</div>
      `;

      itemEl.addEventListener('click', () => {
        if (this.game.buyUpgrade(upgrade.id)) {
          this.audio.playBuySound();
          this.renderUpgrades();
          this.updateStats();
        }
      });

      this.upgradesListEl.appendChild(itemEl);
    });
  }

  private triggerVoxelBounce(): void {
    this.mainVoxelEl.classList.remove('clicked');
    // Force reflow
    void this.mainVoxelEl.offsetWidth;
    this.mainVoxelEl.classList.add('clicked');
  }

  private spawnFloatingText(x: number, y: number, text: string): void {
    const el = document.createElement('div');
    el.className = 'floating-number';
    el.textContent = text;

    // Slight random spread around click
    const offsetX = (Math.random() - 0.5) * 40;
    el.style.left = `${x + offsetX}px`;
    el.style.top = `${y - 20}px`;

    this.clickParticlesContainer.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 900);
  }
}
