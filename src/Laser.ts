import { Vector, Position } from "./Vector.js";
//@ts-ignore Import module
import { nanoid } from "https://cdnjs.cloudflare.com/ajax/libs/nanoid/3.3.4/nanoid.min.js";
import { Player } from "./Player.js";

class Laser {
  protected _damage: number = 0.1
  protected _position: Position
  protected _directionVector: Vector
  protected _sourcePlayerID: string
  protected _isOn: boolean = false;
  readonly id: string = nanoid(20);
  public get damage(): number {
    return this._damage
  }

  public get isOn(): boolean {
    return this._isOn
  }
  public get sourcePlayerID(): string {
    return this._sourcePlayerID;
  }
  public get position(): Position {
    return this._position
  }

  public get directionVector(): Vector {
    return this._directionVector
  }
  constructor(
    player: Player
  ) { 
    this._directionVector = player.directionVector
    this._position = player.position;
    this._sourcePlayerID = player.id
  }


  public adjustToPlayer(p: Player) {
    this._position = p.position;
    this._directionVector = p.directionVector;
  }


  public toggleLaser(): void {
    this._isOn = !this._isOn
  }
}


export { Laser }