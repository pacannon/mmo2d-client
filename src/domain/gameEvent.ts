export type GameEvent =
  | Jump
  | MoveForward
  | MoveBackward
  | MoveLeft
  | MoveRight
  | RotateLeft
  | RotateRight

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

interface RotateLeft {
  kind: 'rotateLeft';
}

interface RotateRight {
  kind: 'rotateRight';
}