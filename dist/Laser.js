//@ts-ignore Import module
import { nanoid } from "https://cdnjs.cloudflare.com/ajax/libs/nanoid/3.3.4/nanoid.min.js";
class Laser {
    _damage = 0.1;
    _position;
    _directionVector;
    _sourcePlayerID;
    _isOn = false;
    _gauge = 100;
    maxGauge = 100;
    id = nanoid(20);
    get damage() {
        return this._damage;
    }
    get gauge() {
        return this._gauge;
    }
    get isOn() {
        return this._isOn;
    }
    set isOn(n) {
        this._isOn = n;
    }
    get sourcePlayerID() {
        return this._sourcePlayerID;
    }
    get position() {
        return this._position;
    }
    get directionVector() {
        return this._directionVector;
    }
    constructor(player) {
        this._directionVector = player.directionVector;
        this._position = player.position;
        this._sourcePlayerID = player.id;
    }
    adjustToPlayer(p) {
        this._position = p.position;
        this._directionVector = p.directionVector;
    }
    useFuel() {
        this._gauge -= 1;
        if (this._gauge <= 0) {
            this._gauge = 0;
            this.isOn = false;
        }
    }
    regenerateFuel() {
        this._gauge += 1;
    }
}
export { Laser };
//# sourceMappingURL=Laser.js.map