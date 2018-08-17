export type GameEvent =
  | Jump
  | MoveForward
  | MoveBackward
  | StrafeLeft
  | StrafeRight
  | YawLeft
  | YawRight

interface Jump {
  kind: 'jump';
}

interface MoveForward {
  kind: 'moveForward';
  mapTo: boolean;
}

interface MoveBackward {
  kind: 'moveBackward';
  mapTo: boolean;
}

interface StrafeLeft {
  kind: 'strafeLeft';
  mapTo: boolean;
}

interface StrafeRight {
  kind: 'strafeRight';
  mapTo: boolean;
}

interface YawLeft {
  kind: 'yawLeft';
  mapTo: boolean;
}

interface YawRight {
  kind: 'yawRight';
  mapTo: boolean;
}