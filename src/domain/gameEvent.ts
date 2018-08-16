export type GameEvent =
  | Jump
  | MoveForward
  | MoveBackward
  | MoveLeft
  | MoveRight

interface Jump {
  kind: 'jump';
}

interface MoveForward {
  kind: 'moveForward';
}

interface MoveBackward {
  kind: 'moveBackward';
}

interface MoveLeft {
  kind: 'moveLeft';
}

interface MoveRight {
  kind: 'moveRight';
}