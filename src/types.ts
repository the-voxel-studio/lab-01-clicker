export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseCost: number;
  costMultiplier: number;
  cost: number;
  count: number;
  type: 'click' | 'auto';
  power: number; // For 'click': adds to clickPower. For 'auto': adds to voxelsPerSecond.
}

export interface GameState {
  voxels: number;
  totalVoxelsEarned: number;
  clickPower: number;
  voxelsPerSecond: number;
  totalClicks: number;
  upgrades: Upgrade[];
  lastTick: number;
}
