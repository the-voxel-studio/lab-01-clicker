import './style.css';
import { GameEngine } from './game';
import { AudioManager } from './audio';
import { UIManager } from './ui';

// Initialize core components
const game = new GameEngine();
const audio = new AudioManager();
const ui = new UIManager(game, audio);

// Boot game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  ui.init();

  // Smooth Game Loop via requestAnimationFrame
  let lastTime = performance.now();
  let saveTimer = 0;

  function gameLoop(currentTime: number): void {
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Tick passive income
    game.tick();
    ui.updateStats();

    // Auto-save every 5 seconds
    saveTimer += delta;
    if (saveTimer >= 5) {
      game.save();
      saveTimer = 0;
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  // Save on tab close/refresh
  window.addEventListener('beforeunload', () => {
    game.save();
  });
});
