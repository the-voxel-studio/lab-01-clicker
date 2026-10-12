import { GameState, Upgrade } from './types';

const STORAGE_KEY = 'voxel_clicker_save_v1';

export const INITIAL_UPGRADES: Upgrade[] = [
  // Click upgrades
  {
    id: 'click_cursor',
    name: 'Curseur Renforcé',
    description: '+1 voxel par clic',
    icon: '👆',
    baseCost: 15,
    costMultiplier: 1.15,
    cost: 15,
    count: 0,
    type: 'click',
    power: 1,
  },
  {
    id: 'pink_hammer',
    name: 'Marteau Voxel #F60887',
    description: '+5 voxels par clic',
    icon: '🔨',
    baseCost: 100,
    costMultiplier: 1.16,
    cost: 100,
    count: 0,
    type: 'click',
    power: 5,
  },
  {
    id: 'laser_chisel',
    name: 'Burin Laser Cyber',
    description: '+25 voxels par clic',
    icon: '⚡',
    baseCost: 1100,
    costMultiplier: 1.18,
    cost: 1100,
    count: 0,
    type: 'click',
    power: 25,
  },

  // Passive Auto-miners
  {
    id: 'auto_miner',
    name: 'Drone Mineur Automatique',
    description: '+1 voxel par seconde',
    icon: '🤖',
    baseCost: 20,
    costMultiplier: 1.15,
    cost: 20,
    count: 0,
    type: 'auto',
    power: 1,
  },
  {
    id: 'pink_foundry',
    name: 'Fonderie Rose Fluo',
    description: '+8 voxels par seconde',
    icon: '🏭',
    baseCost: 150,
    costMultiplier: 1.15,
    cost: 150,
    count: 0,
    type: 'auto',
    power: 8,
  },
  {
    id: 'voxel_quarry',
    name: 'Carrière Voxel 3D',
    description: '+45 voxels par seconde',
    icon: '⛰️',
    baseCost: 1200,
    costMultiplier: 1.15,
    cost: 1200,
    count: 0,
    type: 'auto',
    power: 45,
  },
  {
    id: 'quantum_synth',
    name: 'Synthétiseur Quantique',
    description: '+260 voxels par seconde',
    icon: '🌌',
    baseCost: 12000,
    costMultiplier: 1.15,
    cost: 12000,
    count: 0,
    type: 'auto',
    power: 260,
  },
  {
    id: 'pink_matrix',
    name: 'Matrice Voxel Ultime',
    description: '+1 500 voxels par seconde',
    icon: '💖',
    baseCost: 130000,
    costMultiplier: 1.15,
    cost: 130000,
    count: 0,
    type: 'auto',
    power: 1500,
  },
];

export class GameEngine {
  public state: GameState;

  constructor() {
    this.state = this.loadState();
  }

  private createDefaultState(): GameState {
    return {
      voxels: 0,
      totalVoxelsEarned: 0,
      clickPower: 1,
      voxelsPerSecond: 0,
      totalClicks: 0,
      upgrades: JSON.parse(JSON.stringify(INITIAL_UPGRADES)),
      lastTick: Date.now(),
    };
  }

  public click(): number {
    const earned = this.state.clickPower;
    this.state.voxels += earned;
    this.state.totalVoxelsEarned += earned;
    this.state.totalClicks += 1;
    return earned;
  }

  public buyUpgrade(upgradeId: string): boolean {
    const upgrade = this.state.upgrades.find(u => u.id === upgradeId);
    if (!upgrade) return false;

    if (this.state.voxels >= upgrade.cost) {
      this.state.voxels -= upgrade.cost;
      upgrade.count += 1;
      upgrade.cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.count));

      this.recalculateStats();
      return true;
    }
    return false;
  }

  public recalculateStats(): void {
    let clickBonus = 0;
    let autoBonus = 0;

    for (const upgrade of this.state.upgrades) {
      if (upgrade.type === 'click') {
        clickBonus += upgrade.count * upgrade.power;
      } else if (upgrade.type === 'auto') {
        autoBonus += upgrade.count * upgrade.power;
      }
    }

    this.state.clickPower = 1 + clickBonus;
    this.state.voxelsPerSecond = autoBonus;
  }

  public tick(now: number = Date.now()): number {
    const dt = Math.max(0, (now - this.state.lastTick) / 1000);
    this.state.lastTick = now;

    if (this.state.voxelsPerSecond > 0 && dt > 0) {
      const generated = this.state.voxelsPerSecond * dt;
      this.state.voxels += generated;
      this.state.totalVoxelsEarned += generated;
      return generated;
    }
    return 0;
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // localStorage may fail in restricted sandbox
    }
  }

  public loadState(): GameState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<GameState>;
        const defaultState = this.createDefaultState();

        // Merge upgrades cleanly
        const mergedUpgrades = defaultState.upgrades.map(defUp => {
          const found = parsed.upgrades?.find(u => u.id === defUp.id);
          if (found) {
            return {
              ...defUp,
              count: found.count || 0,
              cost: found.cost || defUp.baseCost,
            };
          }
          return defUp;
        });

        const state: GameState = {
          voxels: typeof parsed.voxels === 'number' ? parsed.voxels : 0,
          totalVoxelsEarned: typeof parsed.totalVoxelsEarned === 'number' ? parsed.totalVoxelsEarned : 0,
          clickPower: typeof parsed.clickPower === 'number' ? parsed.clickPower : 1,
          voxelsPerSecond: typeof parsed.voxelsPerSecond === 'number' ? parsed.voxelsPerSecond : 0,
          totalClicks: typeof parsed.totalClicks === 'number' ? parsed.totalClicks : 0,
          upgrades: mergedUpgrades,
          lastTick: Date.now(),
        };

        // Recalculate derived properties
        let clickBonus = 0;
        let autoBonus = 0;
        for (const u of state.upgrades) {
          if (u.type === 'click') clickBonus += u.count * u.power;
          if (u.type === 'auto') autoBonus += u.count * u.power;
        }
        state.clickPower = 1 + clickBonus;
        state.voxelsPerSecond = autoBonus;

        return state;
      }
    } catch {
      // Return fresh on error
    }
    return this.createDefaultState();
  }

  public reset(): void {
    this.state = this.createDefaultState();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  public static formatNumber(num: number): string {
    if (num < 1000) {
      return num % 1 === 0 ? num.toString() : num.toFixed(1);
    }
    const units = ['k', 'M', 'B', 'T', 'Qa', 'Qi'];
    const order = Math.floor(Math.log10(num) / 3);
    const unitname = units[order - 1] || '';
    const val = num / Math.pow(10, order * 3);
    return `${val.toFixed(2)} ${unitname}`.trim();
  }
}
