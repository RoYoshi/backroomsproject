/* The build's constants from the one definition of Level 0 and of the carried lights (level-data.cjs; vite.config.ts defines each as its
   value, so every use below is the value itself in the built client). Types only. */
type CellRect = [number, number, number, number];
type LevelRoom = { x: number; y: number; w: number; h: number; name: string; code: string };
type LightKindSpec = { label: string; range: number; arc: number; power: number; spill: number; omni: boolean; nv?: boolean };
declare const LEVEL0_COLS: number, LEVEL0_ROWS: number;
declare const LEVEL0_ROOMS: LevelRoom[];
declare const LEVEL0_CORRIDORS: CellRect[], LEVEL0_PARTITIONS: CellRect[], LEVEL0_DOORWAYS: CellRect[];
declare const LEVEL0_PITS: { x: number; y: number }[];
declare const LEVEL0_PILLAR_COLUMNS: number[], LEVEL0_PILLAR_ROWS: number[], LEVEL0_PILLAR_HALF: number, LEVEL0_PILLAR_SIZE: number;
declare const LEVEL0_SPAWN_X: number, LEVEL0_SPAWN_Y: number;
declare const LEVEL0_BLACKOUT_FIRST: number, LEVEL0_BLACKOUT_LENGTH: number, LEVEL0_BLACKOUT_LENGTH_CYCLE: number;
declare const LEVEL0_BLACKOUT_GAP: number, LEVEL0_BLACKOUT_GAP_CYCLE: number, LEVEL0_BLACKOUT_GAP_STEP: number;
declare const LIGHT_KINDS: Record<'flashlight' | 'headlamp' | 'lantern' | 'camcorder', LightKindSpec>;
