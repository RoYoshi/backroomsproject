/* The window members the compiled client uses: what each one is, which page script defines it (public/*.js and public/assets/*.js,
 * loaded before the bundle; world.js is the server's too), and the lineage step that started using it (src/core/client/bundle/lineage/
 * STEPS.md).  A comment names the script that defines the members below it, first; every script that writes one of them is named
 * (dev/tools/checks/window_contract.js checks it against the served scripts, and every use in the client against these declarations:
 * the gate's contracts step; FINDINGS M-005). Types only: nothing here exists at run time, and a member may be absent (the bundle checks before each use, as the shipped
 * bundle did). The other direction, window.__api (the bundle's facade for those scripts), is made in main.ts; its readers are listed in
 * src/core/client/bundle/API_CONTRACT.md. */
/* the types the members are described with (a namespace, so that no global type name is added) */
declare namespace TFB {
 export type Graphics = import('pixi.js').Graphics;
 export type Container = import('pixi.js').Container;
 export type Application = import('pixi.js').Application;
 export type Rect = import('../shared/world').Rect;
 export type Wanderer = typeof import('../shared/movement').player;
 export type Appearance = import('../shared/avatar').Appearance;
 export type Smiler = import('../shared/entity').Smiler;
 export type Corpse = import('../shared/remains').Corpse;
 export type CaptureKind = import('./death').CaptureKind;
 export type DeathSequence = import('./death').DeathSequence;
 export type DeathPlan = import('./death').DeathPlan;
 export type Victim = import('./death').Victim;
 export type DeathHearing = import('./audio').DeathHearing;
 export type Ambience = import('./audio').Ambience;
 export type PlayerView = import('./player-view').PlayerView;
 export type Subject = import('./player-view').Subject;
 export type EntityView = import('./entity-view').EntityView;
 export type SmilerView = import('./entity-view').SmilerView;
 export type Renderer = import('./render').Renderer;
 export type RevealFrom = import('./render').RevealFrom;
 export type LightOrigin = import('./render').LightOrigin;
 export type Trace = import('../shared/evidence').Trace;
 export type Point = { x: number; y: number };
 /* a recorded kill (the server's, or ents.js's for a local death): when, which kind, which Smiler slot, where the attacker struck from */
 export type KillRecord = { at: number; k: CaptureKind; slot: number; ax: number; ay: number };
 /* another player's light, as mp.js keeps it (lineage B06): where, which kind and colour, on, dead, and (B35) a dying light's power */
 export type PeerLight = { x: number; y: number; angle: number; kind: string; color: string; on?: boolean; dead?: boolean; pw?: number | string | null };
 /* the camcorder's effect on one kind of entity (cam.js's fx; lineage B11) */
 export type CamcorderFx = { onlyNV?: boolean; gain?: number; obscure?: number; distort?: number; interfere?: unknown; static?: unknown; glitch?: unknown };
 /* the light model's scratch record and sample (light.js; lineage B19) */
 export type LightSampleScratch = unknown;
 /* the Level 0 remaster (assets/l0-remaster.js; B24, B25) */
 export type Level0Remaster = { lamp(index: number, lamp: Point, top: Graphics): Graphics; built(world: Container, floor: Graphics, lampTop: Graphics, app: Application): void };
}
interface Window {
  /* world.js (owner L.O.S.T.; the server loads it too): Level 0's openings carved into the cells (B14), the ceiling lamps (B27), the
     wall faces a point is near (B02), the props drawn on the floor (B14) */
  WORLD: {
    carve(cells: Uint8Array, cols: number): void;
    lamps(rooms: (TFB.Rect & { name: string; code: string })[], floor: (x: number, y: number) => boolean, pillars: TFB.Rect[], cols: number, rows: number): TFB.Point[];
    addNear(out: TFB.Rect[], x: number, y: number): TFB.Rect[];
    drawProps(g: TFB.Graphics): void;
  };
  /* timing_policy.js (owner S.P.A.C.E.; B22): the fixed step, the most steps in one frame, a frame's time */
  TFB_TIMING?: { FIXED_DT: number; MAX_CATCHUP_STEPS: number; frameDelta(now: number, previous: number): number };
  /* camera_policy.js (owner BR-R; B22, B26): the camera's base scale for a window size */
  __cameraPolicy?: { baseScale(width: number, height: number): number };
  /* the bundle's own facade (main.ts; B05 and later): the members the bundle itself reads back */
  __api: { H: TFB.Wanderer; look: TFB.Appearance; [member: string]: unknown };
  /* the customize preview's Pixi application (main.ts, B31), for the page's two-area customize screen */
  __avatarApp?: TFB.Application;
  /* the trace found this step (main.ts, B05) */
  __c?: TFB.Trace | null;
  /* the cause of the last death (render.ts, B14), for gore.js's wounds */
  __lastCause?: TFB.CaptureKind;
  /* mp.js (owner BPP): the network (B05, B09, B12, B37): whether it is on, a step of the server's world, the trace collected, a
     respawn, joining and leaving a run, a body made, a death started, a vanish, the NEW RUN decision */
  __net?: {
    on?: boolean;
    tick(): void; collected(index: number): void; respawn(): void; join(): void; leave?(): void;
    bodyMade?(record: TFB.Corpse): void; deathStart?(death: TFB.DeathSequence): void; vanish?(at: { x: number; y: number; a: number }): void;
    nr?(approved: () => void): boolean;
  };
  /* mp.js (B03): the multiplayer seam, called every frame; assets/shadows-2d.js (BR-RoLE) wraps it, to draw its shadows after mp.js's
     hook (FINDINGS M-035) */
  __mp?(frame: { p: TFB.Wanderer; cam: TFB.Point; sc: number; run: boolean; started: boolean; light: boolean; G: unknown; q: TFB.Smiler[]; los: unknown; t: number }): void;
  /* mp.js: the other players' lights (B06), the server's Hounds (B09), the Hound killing (B09) and the Hounds and Smilers the page
     hides (B12), the bodies it hides (B12), the recorded kill (B14), the victim a kill record names (B33), the death lab (B18, B34) */
  __peerLights?: TFB.PeerLight[];
  __hounds?: ({ x: number; y: number; angle: number } | null)[];
  __killer?: number;
  __fxKill?: Set<number>;
  __fxKillS?: Set<number>;
  __hideBodies?: Set<string>;
  __kill?: TFB.KillRecord | null;
  __dvic?(kill: unknown): TFB.Victim | null | undefined;
  __dlab?: { xray?: boolean };
  /* mp.js (B35): the local dying light's own power */
  __deathLight?: { own(): number };
  /* assets/ui.js and the bundle (B12): the wanderer is hidden (after a vanish) */
  __hideSelf?: boolean;
  /* ents.js (owners BR-R and N.A.N.I.; B14 and later): the Hounds and Smilers drawn, their deaths planned and posed, the lamps a
     presence dims, a TFB.Smiler's presence and glow, the local kill's record */
  __ents?: {
    initHound(view: TFB.EntityView): void; drawHound(view: TFB.EntityView, hound: { x: number; y: number; angle: number }, time: number, dt: number): void;
    attackHound(view: TFB.EntityView, grip: number, impact: number, variant?: string, death?: unknown): void;
    initSmiler(view: TFB.SmilerView): void; drawSmiler(view: TFB.SmilerView, smiler: TFB.Smiler, time: number, dt: number, seen: number): void;
    attackSmiler(view: TFB.EntityView | TFB.SmilerView, time: number, dt: number, death: TFB.DeathSequence): void;
    smilerPresence?(seen: number, view: TFB.SmilerView): number;
    smilerGlow(ctx: CanvasRenderingContext2D, view: TFB.SmilerView, smiler: TFB.Smiler, time: number, viewer: TFB.Wanderer, scale: number): void;
    lamp(x: number, y: number, time: number): number;
    deathPlan?(death: TFB.DeathSequence, kind: TFB.CaptureKind, kill: unknown): TFB.DeathPlan | null;
    deathExtras?(g: TFB.Graphics, death: TFB.DeathSequence, t: number): unknown;
    localKill?(kind: TFB.CaptureKind, victim: TFB.Wanderer, source: TFB.Point): TFB.KillRecord;
  };
  /* ents.js (B34): the death lab's hit times */
  __dsndHits?(kind: TFB.CaptureKind): number[] | undefined;
  /* gore.js (owner G.I.B.; B08, B32): blood, wounds, remains, their caching and culling */
  __gore?: {
    fx(g: TFB.Graphics, death: TFB.DeathSequence, t: number, floor: (x: number, y: number) => boolean): void;
    corpse(g: TFB.Graphics, record: TFB.Corpse, floor: (x: number, y: number) => boolean): void;
    wounds(g: TFB.Graphics, progress: number, key: string, cause: string | undefined): void;
    cached?(view: TFB.Container, record: TFB.Corpse): void;
    cull?(record: TFB.Corpse, renderer: TFB.Renderer): boolean;
  };
  /* dphys.js (owner G.I.B.; B15, B18): a physical death takes over the clock, the frame and the remains; (B34) the death lab's camera */
  __dphys?: {
    begin(death: TFB.DeathSequence, plan: TFB.DeathPlan | null, from: { vx: number; vy: number; exhausted: unknown; eqKind: string; hat: string | undefined }): { dur: number; cam: TFB.Point } | null;
    clock(death: TFB.DeathSequence, now: number): number; frame(death: TFB.DeathSequence, t: number): boolean; remains(death: TFB.DeathSequence): object;
  };
  __dcamK?(): number;
  /* camcorder.js (owner BR-R; B11, B20): the camcorder's effects, night vision, zoom, shake, infrared, lamp gain */
  __cam?: {
    fx?(kind: 'hound' | 'smiler'): TFB.CamcorderFx | null | undefined; nv: boolean; nvRead(x: number, y: number, strength: number, distance: number): number;
    touch(fx: TFB.CamcorderFx, alpha: number): void; zoomCur: number; shakeX(t: number): number; shakeY(t: number): number;
    lampGain(): number; irDraw(revealFrom: TFB.RevealFrom, origin: TFB.LightOrigin): void; peerIR(revealFrom: TFB.RevealFrom, peer: TFB.PeerLight): void;
    tick(dt: number, raised: boolean, kind: string): void; toggled(kind: string, on: boolean): void; reset(): void;
  };
  /* light.js (owner BR-RoLE; B19): the light model: a sample, its shade, an entity's readability */
  __light?: { mk(): TFB.LightSampleScratch; sample(x: number, y: number, flash: boolean, scratch: TFB.LightSampleScratch): { total: number }; shade(total: number): number; readability(x: number, y: number, flash: boolean): number };
  /* assets/br-role.js (owner BR-RoLE; B23): the per-light compositor */
  __brRole?: { on(): boolean; draw(ctx: CanvasRenderingContext2D, scene: object): void };
  /* move.js (owner S.P.A.C.E.; B14): the movement, the steps' sound, the pace's label, the pose */
  __mv?: { step(dx: number, dy: number, sprint: boolean, dt: number): void; reset(): void; foot(audio: TFB.Ambience, surface: string): void; label(moving: number): string };
  __pose?: { apply(view: TFB.PlayerView, subject: TFB.Subject, time: number, preview: boolean): void };
  /* sfx.js (owner SPACIOUS-AUDIO; B08, B34): recorded sounds */
  __sfx?: { play(name: string, options?: object): boolean; death(kind: TFB.CaptureKind, hearing?: TFB.DeathHearing): boolean };
  /* hud.js (B07): the volume */
  __vol?: number;
  /* inventory.js (owner P.O.C.K.E.T.; B10, B11, B12): the inventory, and whether the loadout screen is open */
  __inv?: { reset(): void; has(item: string): boolean; close?(): void };
  __loadout?: unknown;
  /* assets/l0-remaster.js (owners BR-R and L.O.S.T.; B24, B25): see the bare global __l0v below */
  __l0v?: TFB.Level0Remaster;
}
/* the Level 0 remaster (assets/l0-remaster.js; B24, B25): draws each lamp into the Graphics it gives, and is told when the world is
   built. The shipped bundle reads it as a bare global name, after checking window.__l0v; so does the port. */
declare var __l0v: TFB.Level0Remaster;
